const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()

const User = require('@lulibrary/lag-alma-utils/src/user')
const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const Queue = require('@lulibrary/lag-utils/src/queue')

// Module under test
const updateUser = require('../../src/helpers/update-user')

const ctx = {
  userTable: {
    name: 'a table',
    region: 'a region'
  },
  userQueue: {
    name: 'a queue',
    owner: 'an owner'
  },
  region: 'a region'
}

describe('update user method tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

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

    return updateUser('a user', 'loan', 'a loan', ctx)
      .then(() => {
        getDataStub.should.have.been.calledOnce
      })
  })

  it('should call the addLoan method with the loan id if a matching record is found', () => {
    let getDataStub = sandbox.stub(User.prototype, 'getData')
    getDataStub.returns(Promise.resolve())

    let addLoanStub = sandbox.stub(User.prototype, 'addLoan')
    addLoanStub.returns(Promise.resolve())

    return updateUser('a user', 'loan', 'a loan', ctx)
      .catch(e => {
        addLoanStub.should.have.been.calledWith('a loan')
      })
  })

  it('should call the addRequest method with the request id if a matching record is found', () => {
    let getDataStub = sandbox.stub(User.prototype, 'getData')
    getDataStub.returns(Promise.resolve())

    let addRequestStub = sandbox.stub(User.prototype, 'addRequest')
    addRequestStub.returns(Promise.resolve())

    return updateUser('a user', 'request', 'a request', ctx)
      .catch(e => {
        addRequestStub.should.have.been.calledWith('a request')
      })
  })

  it('should be rejected with an error if getData is rejected', () => {
    let getDataStub = sandbox.stub(User.prototype, 'getData')
    getDataStub.rejects(new Error('DynamoDB broke'))

    return updateUser('a user', 'loan', 'a loan', ctx)
      .should.eventually.be.rejectedWith('DynamoDB broke')
      .and.should.eventually.be.an.instanceOf(Error)
  })

  it('should call sendMessage on Queue if no user record is found', () => {
    let getDataStub = sandbox.stub(User.prototype, 'getData')
    getDataStub.rejects(new ItemNotFoundError('No matching user record exists'))
    sandbox.stub(Queue.prototype, 'getQueueUrl').resolves('')
    let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

    return updateUser('a user', 'loan', 'a loan', ctx)
      .then(() => {
        sendMessageStub.should.have.been.calledOnce
      })
  })
})
