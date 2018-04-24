const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const UnsupportedEventError = require('../src/unsupported-event-error')

// Module under test
const validateEvent = require('../src/validate-event')

describe('validate event tests', () => {
  it('should throw an UnsupportedEvent Error if the event is not in the array', () => {
    const testEvent = 'NOT_VALID'
    const testSupported = ['LOAN_CREATED']

    expect(() => validateEvent(testEvent, testSupported)).to.throw(UnsupportedEventError, `Event type ${testEvent} is not supported`)
  })

  it('should not throw an error if the event is in the array', () => {
    const testEvent = 'LOAN_CREATED'
    const testSupported = ['LOAN_CREATED']

    expect(() => validateEvent(testEvent, testSupported)).to.not.throw()
  })
})
