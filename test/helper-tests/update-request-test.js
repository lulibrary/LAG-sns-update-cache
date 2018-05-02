const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()
const expect = chai.expect

const Request = require('@lulibrary/lag-alma-utils/src/request')

// Module under test
const updateRequest = require('../../src/helpers/update-request')

describe('update request method tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  it('should call the populate method with the correct parameters', () => {
    // stub calls to Request class
    const populateStub = sandbox.stub(Request.prototype, 'populate')

    // chain stubs together
    populateStub.returns({
      save: sandbox.stub(Request.prototype, 'save').resolves(true)
    })

    const expected = {
      request_id: 'a request',
      author: 'an author'
    }

    return updateRequest({ user_request: { request_id: 'a request', author: 'an author' } })
      .then(() => {
        populateStub.should.have.been.calledWith(expected)
      })
  })

  it('should call Request#save', () => {
    sandbox.stub(Request.prototype, 'populate').returns(
      new Request({id: 'a request', tableName: 'a table', region: 'a region'})
    )

    const saveStub = sandbox.stub(Request.prototype, 'save')
    saveStub.resolves(true)

    return updateRequest({ user_request: { request_id: 'a request', user_id: 'a user' } }, 'a table', 'a region')
      .then(() => {
        saveStub.should.have.been.calledOnce
      })
  })

  it('should throw an error if Request#populate throws an error', () => {
    sandbox.stub(Request.prototype, 'populate').throws(new Error('populate failed'))
    const saveStub = sandbox.stub(Request.prototype, 'save')

    const testRequest = {
      user_request: {
        request_id: 'a request',
        user_id: 'a user'
      }
    }

    expect(() => updateRequest(testRequest, 'a table', 'a region')).to.throw('populate failed')
    saveStub.should.not.have.been.called
  })
})
