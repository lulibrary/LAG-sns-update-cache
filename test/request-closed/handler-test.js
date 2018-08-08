const AWS_MOCK = require('aws-sdk-mock')

const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()

const uuid = require('uuid/v4')
const _pick = require('lodash.pick')

// DynamoDB
const dynamoose = require('dynamoose')
dynamoose.local()
dynamoose.AWS.config.update({
  region: 'eu-west-2'
})
const AWS = require('aws-sdk')

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-2', endpoint: 'http://127.0.0.1:8000' })

const Schemas = require('@lulibrary/lag-alma-utils')
const Queue = require('@lulibrary/lag-utils/src/queue')

// Module under test
let RequestClosedHandler

// Test info
let UserModel
let RequestModel

let testRequestTable, testUserTable
const testQueueName = 'userQueueName'
const testQueueOwner = 'userQueueOwner'
const testQueueUrl = 'userQueueURL'

let mocks = []

const handle = (event, ctx) => new Promise((resolve, reject) => {
  RequestClosedHandler.handle(event, ctx, (err, data) => {
    return err ? reject(err) : resolve(data)
  })
})

describe('Loan returned lambda handler tests', () => {
  describe('end to end tests', () => {
    before(() => {
      testRequestTable = process.env.RequestCacheTableName
      testUserTable = process.env.UserCacheTableName

      UserModel = Schemas.UserSchema(testUserTable)
      RequestModel = Schemas.RequestSchema(testRequestTable)
      process.env.UsersQueueName = testQueueName
      process.env.UsersQueueOwner = testQueueOwner

      RequestClosedHandler = require('../../src/request-closed/handler')
    })

    afterEach(() => {
      sandbox.restore()
      mocks.forEach(mock => AWS_MOCK.restore(mock))
      mocks = []
    })

    after(() => {
      delete process.env.UsersQueueName
      delete process.env.UsersQueueOwner
    })

    it('should callback with an error if extractMessageData throws an error', () => {
      return handle({}, null).should.eventually.be.rejectedWith('Could not parse SNS message')
    })

    it('should delete an existing loan record from the database', () => {
      let testRequestID = uuid()
      let testUserID = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'deleteLoanFromUser').resolves(true)
      sandbox.stub(Queue.prototype, 'sendMessage').resolves()

      const requestData = {
        user_request: {
          user_primary_id: testUserID,
          request_id: testRequestID,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(requestData)
          }
        }]
      }

      const runTest = () => {
        return handle(input, null)
          .then(() => {
            return checkExists()
          })
      }

      const checkExists = () => {
        return docClient.get({
          TableName: testRequestTable,
          Key: {
            request_id: testRequestID
          }
        }).promise()
          .then((data) => {
            data.should.deep.equal({})
          })
      }

      const existing = {
        user_id: testUserID,
        request_id: testRequestID,
        title: testTitle,
        due_date: '1970-01-01T00:00:01'
      }

      return RequestModel.create(existing)
        .then(() => {
          return runTest()
        })
    })

    it('should update a user record if it already exists', () => {
      sandbox.stub(Date, 'now').returns(0)

      let testRequestID = uuid()
      let testUserID = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'deleteLoan').resolves(true)

      const requestData = {
        user_request: {
          user_primary_id: testUserID,
          request_id: testRequestID,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(requestData)
          }
        }]
      }

      const runTest = () => {
        return handle(input, null)
          .then(() => {
            return checkUpdated()
          })
      }

      const checkUpdated = () => {
        return docClient.get({
          TableName: testUserTable,
          Key: {
            primary_id: testUserID
          }
        }).promise()
          .then((data) => {
            _pick(data.Item, [
              'primary_id',
              'request_ids',
              'expiry_date'
            ]).should.deep.equal({
              primary_id: testUserID,
              request_ids: [],
              expiry_date: 7200
            })
          })
      }

      return UserModel.create({
        primary_id: testUserID,
        request_ids: [testRequestID]
      })
        .then(() => {
          return runTest()
        })
    })

    it('should send the user ID to SQS if the user does not exist', () => {
      let testRequestID = uuid()
      let testUserID = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'deleteLoan').resolves(true)
      const sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      const requestData = {
        user_request: {
          user_primary_id: testUserID,
          request_id: testRequestID,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(requestData)
          }
        }]
      }

      return handle(input, null)
        .then(() => {
          sendMessageStub.should.have.been.calledWith(testUserID)
        })
    })

    it('should callback with an error if the Cache fails to update', () => {
      const testUserID = uuid()
      const testRequestID = uuid()
      const testTitle = uuid()

      const sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      const requestData = {
        user_request: {
          user_primary_id: testUserID,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(requestData)
          }
        }]
      }

      return handle(input, null)
        .should.eventually.be.rejectedWith(`Failed to delete Request ${undefined} for User ${testUserID} in Cache`)
    })
  })
})
