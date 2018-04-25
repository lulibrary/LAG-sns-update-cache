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

const rewire = require('rewire')

const UnsupportedEventError = require('../../src/unsupported-event-error')

// Module under test
const LoanReturned = rewire('../../src/loan-returned/handler')

// Test data
const LoanReturnedEvent = require('./events/loan-returned-event.json')

describe('loan returned handler tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is properly formed')

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
    })

    after(() => {
      delete process.env.LoanCacheTableName
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
          loan_id: '18263808770001221'
        })
        done()
      })
    })
  })
})
