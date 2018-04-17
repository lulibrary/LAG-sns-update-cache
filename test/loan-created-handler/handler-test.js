const AWS_MOCK = require('aws-sdk-mock')
const sinon = require('sinon')
const sandbox = sinon.sandbox.create()

const chai = require('chai')
const sinon_chai = require('sinon-chai')
chai.use(sinon_chai)
const should = chai.should()
const expect = chai.expect

const TestEvents = {
  LoanCreated: require('./events/loan-created-event.json')
}

const ExpectedPuts = {
  LoanCreated: require('./events/loan-created-expected.json')
}

const rewire = require('rewire')
const Utils = require('@lulibrary/lag-alma-utils')

const User = require('@lulibrary/lag-alma-utils/src/user')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// Module under test
const LoanUpdated = rewire('../../src/loan-created/handler')

describe('loan updated lambda tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is valid', (done) => {
      sandbox.stub(Loan.prototype, 'save').resolves(true)
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').resolves(true)

      LoanUpdated.handle(TestEvents.LoanCreated, null, (err, data) => {
        data.should.equal('Loan 18263808770001221 successfully updated with event LOAN_CREATED')
        done()
      })
    })
  })

  describe('update user tests', () => {
    it('should call the getData method', () => {
      getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.returns(Promise.resolve())

      LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan'} })
        .catch(e => {})
      getDataStub.should.have.been.calledOnce
    })

    it('should call the addLoan method with the loan id', () => {
      getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.returns(Promise.resolve())

      addLoanStub = sandbox.stub(User.prototype, 'addLoan')
      addLoanStub.returns(Promise.resolve())

      return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan'} })
        .catch(e => {
          addLoanStub.should.have.been.calledWith('a loan')
        })
    })

    // describe('', () => {
    //   let messageStub = sandbox.stub()
    //   let urlStub = sinon.stub()

    //   before(() => {
    //     messageStub.callsArgWith(1, null, true)
    //     urlStub.callsArgWith(1, null, { QueueUrl: 'a queue' })
    //     AWS_MOCK.mock('SQS', 'getQueueUrl', urlStub)
    //     AWS_MOCK.mock('SQS', 'sendMessage', messageStub)
    //     AWS_MOCK.mock('DynamoDB.DocumentClient', 'get', {})
    //   })

    //   it('should call SQS sendMessage if no user record is found in the cache', () => {
    //     return LoanUpdated.__get__('updateUser')({ item_loan: { user_id: 'a user', loan_id: 'a loan'} })
    //       .then((data) => {
    //         messageStub.should.have.been.calledWith({
    //           MessageBody: 'a user',
    //           QueueUrl: 'a queue'
    //         })
    //       })
    //   })

    //   after(() => {
    //     AWS_MOCK.restore('SQS')
    //     AWS_MOCK.restore('DynamoDB')
    //   })
    // })
  })

  describe('update loan method', () => {
  })
})
