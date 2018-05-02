const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()

const Queue = require('@lulibrary/lag-utils/src/queue')

// Module under test
const sendToQueue = require('../../src/helpers/send-to-queue')

describe('send user to Queue method tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  it('should call Queue#getQueueUrl', () => {
    let getQueueUrlStub = sandbox.stub(Queue.prototype, 'getQueueUrl')
    getQueueUrlStub.resolves('')
    sandbox.stub(Queue.prototype, 'sendMessage').resolves()

    return sendToQueue('', 'a queue', 'an owner').then(() => {
      getQueueUrlStub.should.have.been.calledOnce
    })
  })

  it('should be rejected with an error if Queue#getQueueUrl is rejected', () => {
    sandbox.stub(Queue.prototype, 'getQueueUrl').rejects(new Error('SQS broke'))

    return sendToQueue('a user', 'a queue', 'an owner').should.eventually.be.rejectedWith('SQS broke')
      .and.should.eventually.be.an.instanceOf(Error)
  })

  it('should call Queue#sendMessage with the correct user ID', () => {
    sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
    let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

    return sendToQueue('a user', 'a queue', 'an owner').then(() => {
      sendMessageStub.should.have.been.calledWith('a user')
    })
  })

  it('should be rejected with an error if Queue#sendMessage is rejected', () => {
    sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
    sandbox.stub(Queue.prototype, 'sendMessage').rejects(new Error('SQS broke'))

    return sendToQueue('a user', 'a queue', 'an owner').should.eventually.be.rejectedWith('SQS broke')
      .and.should.eventually.be.an.instanceOf(Error)
  })

  it('should be fulfilled if Queue#sendMessage is fulfilled', () => {
    sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
    sandbox.stub(Queue.prototype, 'sendMessage').resolves(true)

    return sendToQueue('a user').should.eventually.be.fulfilled
  })
})
