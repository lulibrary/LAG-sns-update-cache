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
let LoanUpdatedHandler

// Test info
let UserModel
let LoanModel

let testLoanTable, testUserTable

const testQueueName = 'userQueueName'
const testQueueOwner = 'userQueueOwner'
const testQueueUrl = 'userQueueURL'

let mocks = []

const createUser = (userID) => {
  return new UserModel({
    primary_id: userID
  }).save()
}

const handle = (event, ctx) => new Promise((resolve, reject) => {
  LoanUpdatedHandler.handle(event, ctx, (err, data) => {
    return err ? reject(err) : resolve(data)
  })
})

describe('Loan updated lambda handler tests', () => {
  describe('end to end tests', () => {
    before(() => {
      testLoanTable = process.env.LoanCacheTableName
      testUserTable = process.env.UserCacheTableName

      console.log(process.env.LoanCacheTableName)

      UserModel = Schemas.UserSchema(testUserTable)
      LoanModel = Schemas.LoanSchema(testLoanTable)
      process.env.UsersQueueName = testQueueName
      process.env.UsersQueueOwner = testQueueOwner

      LoanUpdatedHandler = require('../../src/loan-updated/handler')
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
        LoanUpdatedHandler.handle({}, null, (err, data) => {
          err ? reject(err) : resolve(data)
        })
      }).should.eventually.be.rejectedWith('Could not parse SNS message')
    })

    it('should create a new loan record in the database', () => {
      let testLoanID = uuid()
      let testUserID = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'addLoanToUser').resolves(true)

      const loanData = {
        item_loan: {
          user_id: testUserID,
          loan_id: testLoanID,
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
        return handle(input, null)
          .then(() => {
            return checkExists()
          })
      }

      const checkExists = () => {
        return docClient.get({
          TableName: testLoanTable,
          Key: {
            loan_id: testLoanID
          }
        }).promise()
          .then((data) => {
            data.Item.should.deep.equal({
              user_id: testUserID,
              loan_id: testLoanID,
              title: testTitle,
              due_date: '1970-01-01T00:00:01',
              expiry_date: 1
            })
          })
      }

      return LoanModel.delete(testLoanID)
        .then(() => {
          return createUser(testUserID)
        })
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
          LoanUpdatedHandler.handle(input, null, (err, data) => {
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
              'loan_ids',
              'expiry_date'
            ]).should.deep.equal({
              primary_id: testUserId,
              loan_ids: [testLoanId],
              expiry_date: 7200
            })
          })
      }

      return new UserModel({
        primary_id: testUserId,
        loan_ids: [],
        request_ids: []
      }).save()
        .then(() => {
          return runTest()
        })
    })

    it('should overwrite a loan record in the database', () => {
      let testLoanId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'addLoanToUser').resolves(true)
      sandbox.stub(Queue.prototype, 'sendMessage').resolves()

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
          LoanUpdatedHandler.handle(input, null, (err, data) => {
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

      const inititalTestLoan = {
        loan_id: testLoanId,
        user_id: testUserId,
        title: `an-old-incorrect-title-${uuid()}`,
        author: `an-old-incorrect-author-${uuid()}`
      }

      return LoanModel.create(inititalTestLoan)
        .then(() => {
          return runTest()
        })
    })

    it('should send the user ID to SQS if the user does not exist', () => {
      let testLoanId = uuid()
      let testUserId = uuid()
      const testTitle = uuid()

      // sandbox.stub(Cache.prototype, 'updateLoan').resolves(true)
      const sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

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
        LoanUpdatedHandler.handle(input, null, (err, data) => {
          return err ? reject(err) : resolve(data)
        })
      })
        .then(() => {
          sendMessageStub.should.have.been.calledWith(testUserId)
        })
    })
  })
})
