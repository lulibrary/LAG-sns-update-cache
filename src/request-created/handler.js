'use strict'

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const User = require('@lulibrary/lag-alma-utils/src/user')
const Request = require('@lulibrary/lag-alma-utils/src/request')
const Queue = require('@lulibrary/lag-utils/src/queue')

const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const validateEvent = require('../validate-event')
const extractMessageData = require('../extract-message-data')

const updateRequest = require('../helpers/update-request')

const supportedEvents = ['REQUEST_CREATED']

module.exports.handle = (event, context, callback) => {
  let requestData

  Promise.resolve()
    .then(() => {
      requestData = extractMessageData(event)
      validateEvent(requestData.event.value, supportedEvents)
    })
    .then(() => {
      return Promise.all([
        updateRequest(requestData),
        updateUser(requestData)
      ])
    })
    .then(() => {
      callback(null, `Request ${requestData.user_request.request_id} successfully updated with event ${requestData.event.value}`)
    }).catch(e => {
      callback(e)
    })
}

const updateUser = (requestData) => {
  const requestID = requestData.user_request.request_id
  const userID = requestData.user_request.user_primary_id
  const userCacheTable = process.env.UserCacheTableName
  const eventUser = new User(userID, userCacheTable, process.env.AWS_REGION)

  return eventUser.getData()
    .then(() => {
      return eventUser.addRequest(requestID).save()
    })
    .catch(e => {
      if (e instanceof ItemNotFoundError) {
        return sendUserToQueue(userID)
      } else {
        throw e
      }
    })
}

const sendUserToQueue = (userID) => {
  const usersQueue = new Queue(process.env.UsersQueueName, process.env.UsersQueueOwner)

  return usersQueue.getQueueUrl()
    .then(() => {
      return usersQueue.sendMessage(userID)
    })
}
