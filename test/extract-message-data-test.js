const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

// Module under test
const extractMessageData = require('../src/extract-message-data')

describe('extract message data tests', () => {
  it('should not throw an error if the event contains a valid JSON message string', () => {
    const testEvent = {
      Records: [{
        Sns: { Message: JSON.stringify({
          valid: 'json',
          message: 'event',
          yes: true
        })}
      }]
    }

    expect(() => extractMessageData(testEvent)).to.not.throw()
  })

  it('should return the parsed JSON if it parses successfully', () => {
    const testEvent = {
      Records: [{
        Sns: { Message: JSON.stringify({
          valid: 'json',
          message: 'event',
          yes: true
        })}
      }]
    }

    extractMessageData(testEvent).should.deep.equal({
      valid: 'json',
      message: 'event',
      yes: true
    })
  })

  it('should throw an error if the event has no Records parameter', () => {
    const testEvent = { NotRecords: true }

    expect(() => extractMessageData(testEvent)).to.throw('Could not parse SNS message')
  })

  it('should throw an error if event.Record is not an array', () => {
    const testEvent = { Records: { array: false } }

    expect(() => extractMessageData(testEvent)).to.throw('Could not parse SNS message')
  })

  it('should throw an error if event.Record[0] does not contain an Sns parameter', () => {
    const testEvent = { Records: [{ NotSns: true }] }

    expect(() => extractMessageData(testEvent)).to.throw('Could not parse SNS message')
  })

  it('should throw an error if event.Record[0].Sns does not contain a Message parameter', () => {
    const testEvent = { Records: [{ Sns: { NotMessage: true } }] }

    expect(() => extractMessageData(testEvent)).to.throw('Could not parse SNS message')
  })

  it('should throw an error if event.Record[0].Sns.Message is not parseable JSON', () => {
    const testEvent = { Records: [{ Sns: { Message: 'this is not parseable JSON' } }] }

    expect(() => extractMessageData(testEvent)).to.throw('Could not parse SNS message')
  })
})
