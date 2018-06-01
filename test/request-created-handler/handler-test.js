const sinon = require('sinon')
const sandbox = sinon.sandbox.create()
const AWS_MOCK = require('aws-sdk-mock')

const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB({ endpoint: 'http://127.0.0.1:8000', region: 'eu-west-2' })
const docClient = new AWS.DynamoDB.DocumentClient({ endpoint: 'http://127.0.0.1:8000', region: 'eu-west-2' })

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
const should = chai.should()

const rewire = require('rewire')

const DynamoLocal = require('../dynamodb-local')
require('dynamoose').local()

// For use when the User and Request classes are exported by the Utils entry point
// const Utils = require('@lulibrary/lag-alma-utils')

const Schemas = require('@lulibrary/lag-alma-utils')

const UnsupportedEventError = require('../../src/unsupported-event-error')
const Queue = require('@lulibrary/lag-utils/src/queue')

const testUserTable = 'userCacheTable'
const testRequestTable = 'requestCacheTable'
process.env.UserCacheTableName = 'userCacheTable'
process.env.RequestCacheTableName = 'requestCacheTable'

// Module under test
const RequestCreated = rewire('../../src/request-created/handler')

// Test data
const TestEvents = {
  RequestCreated: require('./events/request-created-event.json')
}

let wires = []

describe('request updated lambda tests', () => {
  before(function () {
    this.timeout(10000)
    return DynamoLocal.launch()
      .then(() => {
        return DynamoLocal.create([
          {
            name: testUserTable,
            key: 'primary_id'
          },
          {
            name: testRequestTable,
            key: 'request_id'
          }
        ])
      })
  })

  after(() => {
    DynamoLocal.stop()
  })

  afterEach(() => {
    sandbox.restore()
    wires.forEach(wire => wire())
    wires = []
  })

  describe('SNS event tests', () => {
    it('should callback with a success message if the event is valid', (done) => {
      const updateUserStub = sandbox.stub()
      updateUserStub.resolves(true)
      wires.push(RequestCreated.__set__('updateUser', updateUserStub))

      const updateRequestStub = sandbox.stub()
      updateRequestStub.resolves(true)
      wires.push(RequestCreated.__set__('updateRequest', updateRequestStub))

      RequestCreated.handle(TestEvents.RequestCreated, null, (err, data) => {
        should.not.exist(err)
        data.should.equal('Request 83013520000121 successfully updated with event REQUEST_CREATED')
        done()
      })
    })

    it('should callback with an error if updateRequest is rejected', (done) => {
      const updateUserStub = sandbox.stub()
      updateUserStub.resolves(true)
      wires.push(RequestCreated.__set__('updateUser', updateUserStub))

      const updateRequestStub = sandbox.stub()
      updateRequestStub.rejects(new Error('Update Request failed'))
      wires.push(RequestCreated.__set__('updateRequest', updateRequestStub))

      RequestCreated.handle(TestEvents.RequestCreated, null, (err, data) => {
        should.not.exist(data)
        err.should.be.an.instanceOf(Error)
        err.message.should.equal('Update Request failed')
        done()
      })
    })

    it('should callback with an error if updateRequest is rejected', (done) => {
      const updateUserStub = sandbox.stub()
      updateUserStub.rejects(new Error('Update User failed'))
      wires.push(RequestCreated.__set__('updateUser', updateUserStub))

      const updateRequestStub = sandbox.stub()
      updateRequestStub.resolves(true)
      wires.push(RequestCreated.__set__('updateRequest', updateRequestStub))

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

    it('should be rejected with an error if the event type is not REQUEST_CREATED', () => {
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

      return new Promise((resolve, reject) => {
        RequestCreated.handle(testEvent, null, (err, data) => {
          err ? reject(err) : resolve(data)
        })
      })
        .should.eventually.be.rejectedWith('Event type NOT_A_VALID_EVENT is not supported')
        .and.should.eventually.be.an.instanceOf(UnsupportedEventError)
    })
  })

  describe('end to end tests', function () {
    this.timeout(5000)

    before(() => {
      process.env.AWS_REGION = 'eu-west-2'
    })

    after(() => {
      delete process.env.AWS_REGION
    })

    afterEach(() => {
      AWS_MOCK.restore('SQS')
    })

    it('should update an item in the Users table', () => {
      const updateRequestStub = sandbox.stub()
      updateRequestStub.resolves(true)
      wires.push(RequestCreated.__set__('updateRequest', updateRequestStub))

      let testUserID = 'testuser'

      const testItemParams = {
        Item: {
          primary_id: {
            S: 'testuser'
          },
          request_ids: {
            SS: ['request-1', 'request-2']
          }
        },
        TableName: testUserTable
      }

      return dynamo.putItem(testItemParams).promise()
        .then(() => {
          return new Promise((resolve, reject) => {
            RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
              err ? reject(err) : resolve(data)
            })
          })
        })
        .then(() => {
          return dynamo.getItem({
            Key: {
              primary_id: {
                S: testUserID
              }
            },
            TableName: testUserTable
          }).promise()
        })
        .then((res) => {
          res.Item.request_ids.SS.should.include('83013520000121')
        })
    })

    it('should call DynamoDB put correctly for the Requests table', () => {
      const updateUserStub = sandbox.stub()
      updateUserStub.resolves(true)
      wires.push(RequestCreated.__set__('updateUser', updateUserStub))

      let putStub = sandbox.stub()
      putStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('DynamoDB', 'putItem', putStub)

      const expected = {
        title: 'Test title',
        request_id: '83013520000121',
        request_type: 'HOLD',
        pickup_location: 'Burns',
        pickup_location_type: 'LIBRARY',
        pickup_location_library: 'BURNS',
        material_type: { value: 'BK', desc: 'Book' },
        request_status: 'NOT_STARTED',
        place_in_queue: '1',
        request_date: '2013-11-12Z',
        user_primary_id: 'testuser'
      }

      return new Promise((resolve, reject) => {
        RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
          err ? reject(err) : resolve(data)
        })
      })
        .then(() => {
          return docClient.get({
            Key: {
              request_id: '83013520000121'
            },
            TableName: testRequestTable
          }).promise()
        })
        .then((res) => {
          res.Item.should.deep.equal(expected)
        })
    })

    it('should call SQS publish correctly if the user does not exist in the database', () => {
      process.env.UsersQueueName = 'a queue name'
      process.env.UsersQueueOwner = 'a queue owner'

      let testUserID = 'testuser'
      let testQueueURL = 'http://test.queue.url'

      const updateRequestStub = sandbox.stub()
      updateRequestStub.resolves(true)
      wires.push(RequestCreated.__set__('updateRequest', updateRequestStub))

      AWS_MOCK.mock('SQS', 'getQueueUrl', { QueueUrl: testQueueURL })

      let sendMessageStub = sandbox.stub()
      sendMessageStub.callsArgWith(1, null, true)
      AWS_MOCK.mock('SQS', 'sendMessage', sendMessageStub)

      const expected = {
        QueueUrl: testQueueURL,
        MessageBody: testUserID
      }

      return docClient.delete({ Key: { primary_id: 'testuser' }, TableName: testUserTable })
        .promise()
        .then(() => {
          return new Promise((resolve, reject) => {
            RequestCreated.handle(TestEvents.RequestCreated, {}, (err, data) => {
              err ? reject(err) : resolve(data)
            })
          })
        })
        .then((data) => {
          sendMessageStub.should.have.been.calledWith(expected)
        })
    })
  })
})
