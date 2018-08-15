const extractMessageData = require('../extract-message-data')
const CacheRequest = require('../cache-request')
const CacheUser = require('../cache-user')

module.exports.handle = (event, context, callback) => {
  try {
    const requestData = extractMessageData(event)
    Promise.all([
      new CacheRequest().create(requestData.user_request),
      new CacheUser().addRequest(requestData.user_request.user_primary_id, requestData.user_request.request_id)
    ])
      .then(() => {
        callback(null, generateSuccessMessage(requestData.user_request.request_id))
      })
      .catch(e => {
        console.log(e)
        callback(new Error(`Failed to update Request ${requestData.user_request.request_id} for User ${requestData.user_request.user_primary_id} in Cache`))
      })
  } catch (e) {
    callback(e)
  }
}

const generateSuccessMessage = (id) => {
  return `Request ${id} successfully updated in cache`
}
