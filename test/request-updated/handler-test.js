const AWS_MOCK = require('aws-sdk-mock')
const AWS = require('aws-sdk')

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
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-2', endpoint: 'http://127.0.0.1:8000' })

const Schemas = require('@lulibrary/lag-alma-utils')
const Queue = require('@lulibrary/lag-utils/src/queue')

// const Cache = require('../../src/cache')

// Module under test
let RequestUpdatedHandler

// Test info
let UserModel
let RequestModel

let testRequestTable, testUserTable

const testQueueName = 'userQueueName'
const testQueueOwner = 'userQueueOwner'
const testQueueUrl = 'userQueueURL'

let mocks = []

describe('Request updated lambda handler tests', () => {
  describe('end to end tests', () => {
    before(() => {
      testRequestTable = process.env.RequestCacheTableName
      testUserTable = process.env.UserCacheTableName

      console.log(process.env.RequestCacheTableName)

      UserModel = Schemas.UserSchema(testUserTable)
      RequestModel = Schemas.RequestSchema(testRequestTable)
      process.env.UsersQueueName = testQueueName
      process.env.UsersQueueOwner = testQueueOwner

      RequestUpdatedHandler = require('../../src/request-updated/handler')
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
      return new Promise((resolve, reject) => {
        RequestUpdatedHandler.handle({}, null, (err, data) => {
          err ? reject(err) : resolve(data)
        })
      }).should.eventually.be.rejectedWith('Could not parse SNS message')
    })

    it('should create a new request record in the database', () => {
      let testRequestId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'addRequestToUser').resolves(true)
      sandbox.stub(Queue.prototype, 'sendMessage').resolves()

      const requestData = {
        user_request: {
          user_primary_id: testUserId,
          request_id: testRequestId,
          title: testTitle
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
        return new Promise((resolve, reject) => {
          RequestUpdatedHandler.handle(input, null, (err, data) => {
            return err ? reject(err) : resolve(data)
          })
        })
          .then(() => {
            return checkExists()
          })
      }

      const checkExists = () => {
        return docClient.get({
          TableName: testRequestTable,
          Key: {
            request_id: testRequestId
          }
        }).promise()
          .then((data) => {
            _pick(data.Item, [
              'user_primary_id',
              'request_id',
              'title'
            ]).should.deep.equal({
              user_primary_id: testUserId,
              request_id: testRequestId,
              title: testTitle
            })
          })
      }

      return RequestModel.delete(testRequestId)
        .then(() => {
          return runTest()
        })
    })

    it('should update a user record if it already exists', () => {
      sandbox.stub(Date, 'now').returns(0)

      let testRequestId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      const requestData = {
        user_request: {
          user_primary_id: testUserId,
          request_id: testRequestId,
          title: testTitle
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
        return new Promise((resolve, reject) => {
          RequestUpdatedHandler.handle(input, null, (err, data) => {
            return err ? reject(err) : resolve(data)
          })
        })
          .then(() => {
            return checkUpdated()
          })
      }

      const checkUpdated = () => {
        return docClient.get({
          TableName: testUserTable,
          Key: {
            primary_id: testUserId
          }
        }).promise()
          .then((data) => {
            _pick(data.Item, [
              'primary_id',
              'request_ids',
              'expiry_date'
            ]).should.deep.equal({
              primary_id: testUserId,
              request_ids: [testRequestId],
              expiry_date: 7200
            })
          })
      }

      return UserModel.create({
        primary_id: testUserId,
        request_ids: [],
        loan_ids: []
      })
        .then(() => {
          return runTest()
        })
    })

    it('should overwrite a request record in the database', () => {
      let testRequestId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'addRequestToUser').resolves(true)
      sandbox.stub(Queue.prototype, 'sendMessage').resolves()

      const requestData = {
        user_request: {
          user_primary_id: testUserId,
          request_id: testRequestId,
          title: testTitle
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
        return new Promise((resolve, reject) => {
          RequestUpdatedHandler.handle(input, null, (err, data) => {
            return err ? reject(err) : resolve(data)
          })
        })
          .then(() => {
            return checkExists()
          })
      }

      const checkExists = () => {
        return docClient.get({
          TableName: testRequestTable,
          Key: {
            request_id: testRequestId
          }
        }).promise()
          .then((data) => {
            _pick(data.Item, [
              'user_primary_id',
              'request_id',
              'title'
            ]).should.deep.equal({
              user_primary_id: testUserId,
              request_id: testRequestId,
              title: testTitle
            })
          })
      }

      const inititalTestRequest = {
        request_id: testRequestId,
        user_primary_id: testUserId,
        title: `an-old-incorrect-title-${uuid()}`,
        author: `an-old-incorrect-author-${uuid()}`
      }

      return RequestModel.create(inititalTestRequest)
        .then(() => {
          return runTest()
        })
    })

    it('should send the user ID to SQS if the user does not exist', () => {
      let testRequestId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'updateRequest').resolves(true)
      const sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      const requestData = {
        user_request: {
          user_primary_id: testUserId,
          request_id: testRequestId,
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

      return new Promise((resolve, reject) => {
        RequestUpdatedHandler.handle(input, null, (err, data) => {
          return err ? reject(err) : resolve(data)
        })
      })
        .then(() => {
          sendMessageStub.should.have.been.calledWith(testUserId)
        })
    })
  })
})
