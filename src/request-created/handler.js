'use strict'

const Schemas = require('@lulibrary/lag-alma-utils')

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const validateEvent = require('../validate-event')
const extractMessageData = require('../extract-message-data')
const Queue = require('@lulibrary/lag-utils/src/queue')

const supportedEvents = ['REQUEST_CREATED']

const UserModel = Schemas.UserSchema(process.env.UserCacheTableName)
const RequestModel = Schemas.RequestSchema(process.env.RequestCacheTableName)

module.exports.handle = (event, context, callback) => {
  let requestData

  Promise.resolve()
    .then(() => {
      requestData = extractMessageData(event)
      validateEvent(requestData.event.value, supportedEvents)
    })
    .then(() => {
      return Promise.all([
        updateRequest(requestData.user_request),
        updateUser(requestData.user_request.user_primary_id, requestData.user_request.request_id)
      ])
    })
    .then(() => {
      callback(null, `Request ${requestData.user_request.request_id} successfully updated with event ${requestData.event.value}`)
    }).catch(e => {
      callback(e)
    })
}

const updateUser = (userID, requestID) => {
  return UserModel.get(userID)
    .then((user) => {
      return user
        ? user.addRequest(requestID).save()
        : new Queue(process.env.UsersQueueName, process.env.UsersQueueOwner)
          .sendMessage(userID)
    })
}

const updateRequest = (requestData) => new RequestModel(requestData).save()
