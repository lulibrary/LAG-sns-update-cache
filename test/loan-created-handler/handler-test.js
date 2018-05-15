const sinon = require('sinon')
const sandbox = sinon.sandbox.create()
const AWS_MOCK = require('aws-sdk-mock')

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
const should = chai.should()
const expect = chai.expect

const TestEvents = {
  LoanCreated: require('./events/loan-created-event.json')
}

const rewire = require('rewire')

// For use when the User and Loan classes are exported by the Utils entry point
// const Utils = require('@lulibrary/lag-alma-utils')

const User = require('@lulibrary/lag-alma-utils/src/user')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')

const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const UnsupportedEventError = require('../../src/unsupported-event-error')

// Module under test
const LoanUpdated = rewire('../../src/loan-created/handler')

// Test data
const LoanCreatedEvent = require('./events/loan-created-event.json')

describe('loan updated lambda tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is valid', (done) => {
      // stub calls to User and Loan class
      sandbox.stub(Loan.prototype, 'save').resolves(true)
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').resolves(true)

      LoanUpdated.handle(TestEvents.LoanCreated, null, (err, data) => {
        should.not.exist(err)
        data.should.equal('Loan 18263808770001221 successfully updated with event LOAN_CREATED')
        done()
      })
    })

    it('should callback with an error if updateLoan is rejected', (done) => {
      // stub calls made by updateUser, ensure it resolves
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').resolves(true)

      // Stub calls made by updateLoan, ensure it rejects
      sandbox.stub(Loan.prototype, 'save').rejects(new Error('Update Loan failed'))

      LoanUpdated.handle(TestEvents.LoanCreated, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Update Loan failed')
        done()
      })
    })

    it('should callback with an error if updateLoan is rejected', (done) => {
      // stub calls made by updateUser, ensure it rejects
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').rejects(new Error('Update User failed'))

      // Stub calls made by updateLoan, ensure it resolves
      sandbox.stub(Loan.prototype, 'save').resolves(true)

      LoanUpdated.handle(TestEvents.LoanCreated, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Update User failed')
        done()
      })
    })

    it('should callback with an error if extractMessageData throws an error', (done) => {
      const testMessage = {
        Records: [{}]
      }

      LoanUpdated.handle(testMessage, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Could not parse SNS message')
        done()
      })
    })

    it('should be rejected with an error if the event type is not LOAN_CREATED', (done) => {
      const testEvent = {
        Records: [{
          Sns: {
            Message: JSON.stringify({
              event: {
                value: 'NOT_A_VALID_EVENT'
              }
            })
          }
        }]
      }

      LoanUpdated.handle(testEvent, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(UnsupportedEventError)
        err.message.should.equal('Event type NOT_A_VALID_EVENT is not supported')
        done()
      })
    })
  })

  describe('extract message data tests', () => {
    it('should return parses JSON if the input is valid', () => {
      const testMessage = {
        Records: [{
          Sns: {
            Message: '{"event":"test event","loan_id":"a loan","user_id":"a user"}'
          }
        }]
      }

      const expected = {
        event: 'test event',
        loan_id: 'a loan',
        user_id: 'a user'
      }

      expect(() => LoanUpdated.__get__('extractMessageData')(testMessage)).to.not.throw()
      LoanUpdated.__get__('extractMessageData')(testMessage).should.deep.equal(expected)
    })

    it('should throw an error if the JSON is malformed', () => {
      const testMessage = {
        Records: [{
          Sns: {
            Message: '{event":"test event","loan_id":"a loan","user_id":"a user"}'
          }
        }]
      }

      expect(() => LoanUpdated.__get__('extractMessageData')(testMessage)).to.throw('Could not parse SNS message')
    })

    it('should throw an error if there is no message', () => {
      const testMessage = {
        Records: [{}]
      }

      expect(() => LoanUpdated.__get__('extractMessageData')(testMessage)).to.throw('Could not parse SNS message')
    })
  })

  describe('end to end tests', () => {
    before(() => {
      process.env.UserCacheTableName = 'a user cache table'
      process.env.LoanCacheTableName = 'a loan cache table'

      process.env.UsersQueueName = 'a queue name'
      process.env.UsersQueueOwner = 'a queue owner'

      process.env.AWS_REGION = 'eu-west-2'
    })

    after(() => {
      delete process.env.UserCacheTableName
      delete process.env.LoanCacheTableName

      delete process.env.UsersQueueName
      delete process.env.UsersQueueOwner

      delete process.env.AWS_REGION
    })

    afterEach(() => {
      AWS_MOCK.restore('DynamoDB.DocumentClient')
      AWS_MOCK.restore('SQS')
    })

    it('should call DynamoDB put correctly for the Users table', (done) => {
      let testUserID = 'LBAAJH'
      let testUserLoanIDs = ['loan-1', 'loan-2']

      sandbox.stub(Loan.prototype, 'populate').returns({
        addExpiryDate: () => {
          return { save: () => { return Promise.resolve(true) } }
        }
      })

      let putStub = sandbox.stub()
      putStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB.DocumentClient', 'put', putStub)

      AWS_MOCK.mock('DynamoDB.DocumentClient', 'get', { Item: { user_id: testUserID, loan_ids: testUserLoanIDs, request_ids: [] } })

      const expected = {
        Item: {
          user_id: 'LBAAJH',
          loan_ids: ['loan-1', 'loan-2', '18263808770001221'],
          request_ids: []
        },
        TableName: 'a user cache table'
      }

      LoanUpdated.handle(LoanCreatedEvent, {}, (err, data) => {
        should.not.exist(err)
        putStub.should.have.been.calledWith(expected)
        done()
      })
    })

    it('should call DynamoDB put correctly for the Loans table', (done) => {
      sandbox.stub(User.prototype, 'getData').resolves()
      sandbox.stub(User.prototype, 'addLoan').returns({
        save: sandbox.stub(User.prototype, 'save').resolves()
      })

      let putStub = sandbox.stub()
      putStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB.DocumentClient', 'put', putStub)

      const expected = {
        Item: {
          renewable: false,
          loan_status: 'ACTIVE',
          due_date: '2018-02-23T14:10:06Z',
          item_barcode: '12345',
          user_id: 'LBAAJH',
          loan_id: '18263808770001221',
          process_status: 'NORMAL',
          mms_id: '9919045950001221',
          title: 'Journey',
          author: 'Trip, A',
          description: 'book',
          call_number: 'owncopy',
          expiry_date: 1519395006
        },
        TableName: 'a loan cache table'
      }

      LoanUpdated.handle(LoanCreatedEvent, {}, (err, data) => {
        should.not.exist(err)
        putStub.should.have.been.calledWith(expected)
        done()
      })
    })

    it('should call SQS publish correctly if the user does not exist in the database', (done) => {
      let testUserID = 'LBAAJH'
      let testQueueURL = 'http://test.queue.url'
      sandbox.stub(Loan.prototype, 'populate').returns({
        addExpiryDate: () => {
          return { save: () => { return Promise.resolve(true) } }
        }
      })

      sandbox.stub(User.prototype, 'getData').rejects(new ItemNotFoundError('No item found'))

      AWS_MOCK.mock('SQS', 'getQueueUrl', { QueueUrl: testQueueURL })

      let sendMessageStub = sandbox.stub()
      sendMessageStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('SQS', 'sendMessage', sendMessageStub)

      const expected = {
        QueueUrl: testQueueURL,
        MessageBody: testUserID
      }

      LoanUpdated.handle(LoanCreatedEvent, {}, (err, data) => {
        should.not.exist(err)
        sendMessageStub.should.have.been.calledWith(expected)
        done()
      })
    })
  })
})
