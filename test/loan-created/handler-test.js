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

// DynamoDB
const DynamoLocal = require('../dynamodb-local')
const dynamoose = require('dynamoose')
dynamoose.local()
dynamoose.AWS.config.update({
  region: 'eu-west-2'
})
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-2', endpoint: 'http://127.0.0.1:8000' })

const Schemas = require('@lulibrary/lag-alma-utils')

const Cache = require('../../src/cache')

// Module under test
const LoanCreatedHandler = require('../../src/loan-created/handler')

// Test info
let UserModel
let LoanModel

const testUserTable = 'userTable'
const testLoanTable = 'loanTable'
const testQueueName = 'userQueueName'
const testQueueOwner = 'userQueueOwner'
const testQueueUrl = 'userQueueURL'

let mocks = []

describe('Loan created lambda handler tests', () => {
  describe('end to end tests', () => {
    before(function () {
      process.env.LoanCacheTableName = testLoanTable
      process.env.UserCacheTableName = testUserTable
      process.env.UsersQueueName = testQueueName
      process.env.UsersQueueOwner = testQueueOwner

      UserModel = Schemas.UserSchema(testUserTable)
      LoanModel = Schemas.LoanSchema(testLoanTable)

      this.timeout(10000)
      return DynamoLocal.launch()
        .then(() => {
          return DynamoLocal.create([
            {
              name: testUserTable,
              key: 'primary_id'
            },
            {
              name: testLoanTable,
              key: 'loan_id'
            }
          ])
        })
    })

    afterEach(() => {
      sandbox.restore()
      mocks.forEach(mock => AWS_MOCK.restore(mock))
      mocks = []
    })

    after(() => {
      DynamoLocal.stop()
      delete process.env.LoanCacheTableName
      delete process.env.UserCacheTableName
      delete process.env.UsersQueueName
      delete process.env.UsersQueueOwner
    })

    it('should create a a new loan record in the database', () => {
      let testLoanId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      sandbox.stub(Cache.prototype, 'updateUserWithLoan').resolves(true)

      const loanData = {
        item_loan: {
          user_id: testUserId,
          loan_id: testLoanId,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(loanData)
          }
        }]
      }

      const runTest = () => {
        return new Promise((resolve, reject) => {
          LoanCreatedHandler.handle(input, null, (err, data) => {
            return err ? reject(err) : resolve(data)
          })
        })
          .then(() => {
            return checkExists()
          })
      }

      const checkExists = () => {
        return docClient.get({
          TableName: testLoanTable,
          Key: {
            loan_id: testLoanId
          }
        }).promise()
          .then((data) => {
            data.Item.should.deep.equal({
              user_id: testUserId,
              loan_id: testLoanId,
              title: testTitle,
              due_date: '1970-01-01T00:00:01',
              expiry_date: 1
            })
          })
      }

      return LoanModel.delete(testLoanId)
        .then(() => {
          return runTest()
        })
    })

    it('should update a user record if it already exists', () => {
      sandbox.stub(Date, 'now').returns(0)

      let testLoanId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      const loanData = {
        item_loan: {
          user_id: testUserId,
          loan_id: testLoanId,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(loanData)
          }
        }]
      }

      const runTest = () => {
        return new Promise((resolve, reject) => {
          LoanCreatedHandler.handle(input, null, (err, data) => {
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
            data.Item.should.deep.equal({
              primary_id: testUserId,
              loan_ids: [testLoanId],
              request_ids: [],
              expiry_date: 7200
            })
          })
      }

      return UserModel.create({
        primary_id: testUserId,
        loan_ids: [],
        request_ids: []
      })
        .then(() => {
          return runTest()
        })
    })

    it('should send the user ID to SQS if the user does not exist', () => {
      let testLoanId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      sandbox.stub(Cache.prototype, 'updateLoan').resolves(true)
      const sendMessageStub = sandbox.stub()
      sendMessageStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('SQS', 'sendMessage', sendMessageStub)
      AWS_MOCK.mock('SQS', 'getQueueUrl', {
        QueueUrl: testQueueUrl
      })
      mocks.push('SQS')

      const loanData = {
        item_loan: {
          user_id: testUserId,
          loan_id: testLoanId,
          title: testTitle,
          due_date: '1970-01-01T00:00:01'
        }
      }

      const input = {
        Records: [{
          Sns: {
            Message: JSON.stringify(loanData)
          }
        }]
      }

      return new Promise((resolve, reject) => {
        LoanCreatedHandler.handle(input, null, (err, data) => {
          return err ? reject(err) : resolve(data)
        })
      })
        .then(() => {
          sendMessageStub.should.have.been.calledWith({
            MessageBody: testUserId,
            QueueUrl: testQueueUrl
          })
        })
    })
  })
})
