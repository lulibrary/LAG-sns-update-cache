const sinon = require('sinon')
const sandbox = sinon.sandbox.create()
const AWS_MOCK = require('aws-sdk-mock')

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
const should = chai.should()

const rewire = require('rewire')

// Classes used by module
const UnsupportedEventError = require('../../src/unsupported-event-error')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// Module under test
const LoanReturned = rewire('../../src/loan-returned/handler')

// Test data
const LoanReturnedEvent = require('./events/loan-returned-event.json')

describe('loan returned handler tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is properly formed', () => {
      sandbox.stub(Loan.prototype, 'delete').resolves(true)

      LoanReturned.handle(LoanReturnedEvent, null, (err, data) => {
        should.not.exist(err)
        data.should.equal(`Loan 18263808770001221 successfully updated with event LOAN_RETURNED. Loan has been removed from cache`)
      })
    })

    it('should callback with an error if extractMessageData throws an error', (done) => {
      const testMessage = {
        Records: [{}]
      }

      LoanReturned.handle(testMessage, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Could not parse SNS message')
        done()
      })
    })

    it('should be rejected with an error if the event type is not LOAN_RETURNED', (done) => {
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

      LoanReturned.handle(testEvent, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(UnsupportedEventError)
        err.message.should.equal('Event type NOT_A_VALID_EVENT is not supported')
        done()
      })
    })
  })

  describe('end to end tests', () => {
    before(() => {
      process.env.LoanCacheTableName = 'a loan cache table'
      process.env.AWS_REGION = 'eu-west-2'
    })

    after(() => {
      delete process.env.LoanCacheTableName
      delete process.env.AWS_REGION
    })

    afterEach(() => {
      AWS_MOCK.restore('DynamoDB.DocumentClient')
    })

    it('should call DynamoDB delete on the loan cache table with the correct loan ID', (done) => {
      const deleteStub = sandbox.stub()
      deleteStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB.DocumentClient', 'delete', deleteStub)

      LoanReturned.handle(LoanReturnedEvent, null, (err, data) => {
        should.not.exist(err)

        deleteStub.should.have.been.calledWith({
          TableName: 'a loan cache table',
          Key: {
            loan_id: '18263808770001221'
          }
        })
        done()
      })
    })
  })

  describe('deleteLoanFromCache method tests', () => {
    it('should call Loan#delete exactly once', () => {
      const deleteStub = sandbox.stub(Loan.prototype, 'delete')
      deleteStub.resolves(true)

      return LoanReturned.__get__('deleteLoanFromCache')('a loan').then(() => {
        deleteStub.should.have.been.calledOnce
      })
    })

    it('should be fulfilled if Loan#delete is fulfilled', () => {
      sandbox.stub(Loan.prototype, 'delete').resolves(true)

      return LoanReturned.__get__('deleteLoanFromCache')('a loan').should.eventually.be.fulfilled
    })

    it('should be rejected if Loan#delete is rejected', () => {
      sandbox.stub(Loan.prototype, 'delete').rejects(new Error('Database error'))

      return LoanReturned.__get__('deleteLoanFromCache')('a loan').should.eventually.be.rejectedWith('Database error')
        .instanceOf(Error)
    })
  })
})
