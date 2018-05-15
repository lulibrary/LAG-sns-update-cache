'use strict'

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const validateEvent = require('../validate-event')
const extractMessageData = require('../extract-message-data')

const updateRequest = require('../helpers/update-request')
const updateUser = require('../helpers/update-user')

const supportedEvents = ['REQUEST_CREATED']

module.exports.handle = (event, context, callback) => {
  let requestData

  let resourceData = getResourceData()

  Promise.resolve()
    .then(() => {
      requestData = extractMessageData(event)
      validateEvent(requestData.event.value, supportedEvents)
    })
    .then(() => {
      return Promise.all([
        updateRequest(requestData, resourceData),
        updateUser(requestData.user_request.user_primary_id, 'request', requestData.user_request.request_id, resourceData)
      ])
    })
    .then(() => {
      callback(null, `Request ${requestData.user_request.request_id} successfully updated with event ${requestData.event.value}`)
    }).catch(e => {
      callback(e)
    })
}

const getResourceData = () => {
  return {
    region: process.env.AWS_REGION,
    requestTable: {
      name: process.env.RequestCacheTableName,
      region: process.env.AWS_REGION
    },
    userTable: {
      name: process.env.UserCacheTableName,
      region: process.env.AWS_REGION
    },
    userQueue: {
      name: process.env.UsersQueueName,
      owner: process.env.UsersQueueOwner
    }
  }
}
