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

// For use when the User and Request classes are exported by the Utils entry point
// const Utils = require('@lulibrary/lag-alma-utils')

const User = require('@lulibrary/lag-alma-utils/src/user')
const Request = require('@lulibrary/lag-alma-utils/src/request')

const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const UnsupportedEventError = require('../../src/unsupported-event-error')
const Queue = require('@lulibrary/lag-utils/src/queue')

// Module under test
const RequestCreated = rewire('../../src/request-created/handler')

// Test data
const TestEvents = {
  RequestCreated: require('./events/request-created-event.json')
}

describe('request updated lambda tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is valid', (done) => {
      // stub calls to User and Request class
      sandbox.stub(Request.prototype, 'save').resolves(true)
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').resolves(true)

      RequestCreated.handle(TestEvents.RequestCreated, null, (err, data) => {
        should.not.exist(err)
        data.should.equal('Request 83013520000121 successfully updated with event REQUEST_CREATED')
        done()
      })
    })

    it('should callback with an error if updateRequest is rejected', (done) => {
      // stub calls made by updateUser, ensure it resolves
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').resolves(true)

      // Stub calls made by updateRequest, ensure it rejects
      sandbox.stub(Request.prototype, 'save').rejects(new Error('Update Request failed'))

      RequestCreated.handle(TestEvents.RequestCreated, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Update Request failed')
        done()
      })
    })

    it('should callback with an error if updateRequest is rejected', (done) => {
      // stub calls made by updateUser, ensure it rejects
      sandbox.stub(User.prototype, 'getData').resolves(true)
      sandbox.stub(User.prototype, 'save').rejects(new Error('Update User failed'))

      // Stub calls made by updateRequest, ensure it resolves
      sandbox.stub(Request.prototype, 'save').resolves(true)

      RequestCreated.handle(TestEvents.RequestCreated, null, (err, data) => {
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

      RequestCreated.handle(testMessage, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Could not parse SNS message')
        done()
      })
    })

    it('should be rejected with an error if the event type is not REQUEST_CREATED', (done) => {
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

      RequestCreated.handle(testEvent, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(UnsupportedEventError)
        err.message.should.equal('Event type NOT_A_VALID_EVENT is not supported')
        done()
      })
    })
  })

  describe('update user method tests', () => {
    it('should call the getData method', () => {
      // stub calls to User class
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      let addRequestStub = sandbox.stub(User.prototype, 'addRequest')
      let saveStub = sandbox.stub(User.prototype, 'save')

      getDataStub.resolves(true)
      addRequestStub.returns({
        save: saveStub
      })
      saveStub.resolves(true)

      return RequestCreated.__get__('updateUser')({ user_request: { user_id: 'a user', request_id: 'a request' } })
        .then(() => {
          getDataStub.should.have.been.calledOnce
        })
    })

    it('should call the addRequest method with the request id if a matching record is found', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.returns(Promise.resolve())

      let addRequestStub = sandbox.stub(User.prototype, 'addRequest')
      addRequestStub.returns(Promise.resolve())

      return RequestCreated.__get__('updateUser')({ user_request: { user_id: 'a user', request_id: 'a request' } })
        .catch(e => {
          addRequestStub.should.have.been.calledWith('a request')
        })
    })

    it('should be rejected with an error if getData is rejected', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.rejects(new Error('DynamoDB broke'))

      return RequestCreated.__get__('updateUser')({ user_request: { user_id: 'a user', request_id: 'a request' } })
        .should.eventually.be.rejectedWith('DynamoDB broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should call sendMessage on Queue if no user record is found', () => {
      let getDataStub = sandbox.stub(User.prototype, 'getData')
      getDataStub.rejects(new ItemNotFoundError('No matching user record exists'))
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves('')
      let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      return RequestCreated.__get__('updateUser')({ user_request: { user_id: 'a user', request_id: 'a request' } })
        .then(() => {
          sendMessageStub.should.have.been.calledOnce
        })
    })
  })

  describe('update request method tests', () => {
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

      return RequestCreated.__get__('updateRequest')({ user_request: { request_id: 'a request', author: 'an author' } })
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

      return RequestCreated.__get__('sendUserToQueue')('').then(() => {
        getQueueUrlStub.should.have.been.calledOnce
      })
    })

    it('should be rejected with an error if Queue#getQueueUrl is rejected', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').rejects(new Error('SQS broke'))

      return RequestCreated.__get__('sendUserToQueue')('a user').should.eventually.be.rejectedWith('SQS broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should call Queue#sendMessage with the correct user ID', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      let sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')

      return RequestCreated.__get__('sendUserToQueue')('a user').then(() => {
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })

    it('should be rejected with an error if Queue#sendMessage is rejected', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      sandbox.stub(Queue.prototype, 'sendMessage').rejects(new Error('SQS broke'))

      return RequestCreated.__get__('sendUserToQueue')('a user').should.eventually.be.rejectedWith('SQS broke')
        .and.should.eventually.be.an.instanceOf(Error)
    })

    it('should be fulfilled if Queue#sendMessage is fulfilled', () => {
      sandbox.stub(Queue.prototype, 'getQueueUrl').resolves()
      sandbox.stub(Queue.prototype, 'sendMessage').resolves(true)

      return RequestCreated.__get__('sendUserToQueue')('a user').should.eventually.be.fulfilled
    })
  })

  describe('end to end tests', () => {
    before(() => {
      process.env.UserCacheTableName = 'a user cache table'
      process.env.RequestCacheTableName = 'a request cache table'

      process.env.AWS_REGION = 'eu-west-2'
    })

    after(() => {
      delete process.env.UserCacheTableName
      delete process.env.RequestCacheTableName

      delete process.env.UsersQueueName
      delete process.env.UsersQueueOwner

      delete process.env.AWS_REGION
    })

    afterEach(() => {
      AWS_MOCK.restore('DynamoDB.DocumentClient')
      AWS_MOCK.restore('SQS')
    })

    it('should call DynamoDB put correctly for the Users table', (done) => {
      let testUserID = 'testuser'
      let testUserRequestIDs = ['request-1', 'request-2']

      sandbox.stub(Request.prototype, 'populate').returns({
        save: () => { return Promise.resolve(true) }
      })

      let putStub = sandbox.stub()
      putStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB.DocumentClient', 'put', putStub)

      AWS_MOCK.mock('DynamoDB.DocumentClient', 'get', { Item: { user_id: testUserID, request_ids: testUserRequestIDs, loan_ids: [] } })

      const expected = {
        Item: {
          user_id: 'testuser',
          request_ids: ['request-1', 'request-2', '83013520000121'],
          loan_ids: []
        },
        TableName: 'a user cache table'
      }

      RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
        should.not.exist(err)
        putStub.should.have.been.calledWith(expected)
        done()
      })
    })

    it('should call DynamoDB put correctly for the Requests table', (done) => {
      sandbox.stub(User.prototype, 'getData').resolves()
      sandbox.stub(User.prototype, 'addRequest').returns({
        save: sandbox.stub(User.prototype, 'save').resolves()
      })

      let putStub = sandbox.stub()
      putStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB.DocumentClient', 'put', putStub)

      const expected = {
        Item: {
          title: 'Test title',
          author: null,
          description: null,
          comment: null,
          request_id: '83013520000121',
          request_type: 'HOLD',
          pickup_location: 'Burns',
          pickup_location_type: 'LIBRARY',
          pickup_location_library: 'BURNS',
          material_type: { value: 'BK', desc: 'Book' },
          request_status: 'NOT_STARTED',
          place_in_queue: 1,
          request_date: '2013-11-12Z',
          user_primary_id: 'testuser' },
        TableName: 'a request cache table'
      }

      RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
        should.not.exist(err)
        putStub.should.have.been.calledWith(expected)
        done()
      })
    })

    it('should call SQS publish correctly if the user does not exist in the database', (done) => {
      process.env.UsersQueueName = 'a queue name'
      process.env.UsersQueueOwner = 'a queue owner'

      let testUserID = 'testuser'
      let testQueueURL = 'http://test.queue.url'
      sandbox.stub(Request.prototype, 'populate').returns({
        save: () => { return Promise.resolve(true) }
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

      RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
        should.not.exist(err)
        sendMessageStub.should.have.been.calledWith(expected)
        done()
      })
    })
  })
})
