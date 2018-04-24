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
const Queue = require('@lulibrary/lag-utils/src/queue')

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

    it('should be rejected with an error if the event type is not LOAN_CREATED', () => {
      const testEvent = {
        Records: [{
          Sns: {
            Message: JSON.stringify({
              item_loan: {
                event: {
                  value: 'NOT_A_VALID_EVENT'
                }
              }
            })
          }
        }]
      }

      LoanUpdated.handle(testEvent, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(UnsupportedEventError)
        err.message.should.equal('Event type NOT_A_VALID_EVENT is not supported')
      })
    })
  })

  describe('update user method tests', () => {
    it('should call the getData method', () => {
      // stub calls to User class
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      let addLoanStub = sandbox.stub(User.prototype, 'addLoan')
      let saveStub = sandbox.stub(User.prototype, 'save')

      getDataStub.resolves(true)
      addLoanStub.returns({
        save: saveStub
      })
      saveStub.resolves(true)

      return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan' } })
        .then(() => {
          getDataStub.should.have.been.calledOnce
        })
    })

    it('should call the addLoan method with the loan id if a matching record is found', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.returns(Promise.resolve())

      let addLoanStub = sandbox.stub(User.prototype, 'addLoan')
      addLoanStub.returns(Promise.resolve())

      return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan' } })
        .catch(e => {
          addLoanStub.should.have.been.calledWith('a loan')
        })
    })

    it('should be rejected with an error if getData is rejected', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.rejects(new Error('DynamoDB broke'))

      return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan' } })
        .should.eventually.be.rejectedWith('DynamoDB broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should call sendMessage on Queue if no user record is found', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.rejects(new ItemNotFoundError('No matching user record exists'))
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves('')
      let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan' } })
        .then(() => {
          sendMessageStub.should.have.been.calledOnce
        })
    })
  })

  describe('update loan method tests', () => {
    it('should call the populate method with the correct parameters', () => {
      // stub calls to Loan class
      const populateStub = sandbox.stub(Loan.prototype, 'populate')
      const addExpiryStub = sandbox.stub(Loan.prototype, 'addExpiryDate')

      // chain stubs together
      populateStub.returns({
        addExpiryDate: addExpiryStub
      })

      addExpiryStub.returns({
        save: sandbox.stub(Loan.prototype, 'save').resolves(true)
      })

      const expected = {
        loan_id: 'a loan',
        user_id: 'a user'
      }

      return LoanUpdated.__get__('updateLoan')({ item_loan: { loan_id: 'a loan', user_id: 'a user' } })
        .then(() => {
          populateStub.should.have.been.calledWith(expected)
        })
    })
  })

  describe('send user to Queue method tests', () => {
    before(() => {
      process.env.UsersQueueName = 'a queue'
      process.env.UsersQueueOwner = 'an owner'
    })

    after(() => {
      delete process.env.UsersQueueName
      delete process.env.UsersQueueOwner
    })

    it('should call Queue#getQueueUrl', () => {
      let getQueueUrlStub = sandbox.stub(Queue.prototype, 'getQueueUrl')
      getQueueUrlStub.resolves('')
      sandbox.stub(Queue.prototype, 'sendMessage').resolves()

      return LoanUpdated.__get__('sendUserToQueue')('').then(() => {
        getQueueUrlStub.should.have.been.calledOnce
      })
    })

    it('should be rejected with an error if Queue#getQueueUrl is rejected', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').rejects(new Error('SQS broke'))

      return LoanUpdated.__get__('sendUserToQueue')('a user').should.eventually.be.rejectedWith('SQS broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should call Queue#sendMessage with the correct user ID', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      return LoanUpdated.__get__('sendUserToQueue')('a user').then(() => {
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })

    it('should be rejected with an error if Queue#sendMessage is rejected', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      sandbox.stub(Queue.prototype, 'sendMessage').rejects(new Error('SQS broke'))

      return LoanUpdated.__get__('sendUserToQueue')('a user').should.eventually.be.rejectedWith('SQS broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should be fulfilled if Queue#sendMessage is fulfilled', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      sandbox.stub(Queue.prototype, 'sendMessage').resolves(true)

      return LoanUpdated.__get__('sendUserToQueue')('a user').should.eventually.be.fulfilled
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
      process.env.UsersQueueName = 'a queue name'
      process.env.UsersQueueOwner = 'a queue owner'

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
