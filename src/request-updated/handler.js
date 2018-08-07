const extractMessageData = require('../extract-message-data')
const almaCache = require('../cache-from-env')
const CacheRequest = require('../cache-request')
const CacheUser = require('../cache-user')

module.exports.handle = (event, context, callback) => {
  // try {
  //   const requestData = extractMessageData(event)
  //   almaCache.handleRequestUpdate(requestData.user_request)
  //     .then(() => callback(null, generateSuccessMessage(requestData.user_request.request_id)))
  //     .catch(e => {
  //       console.log(e)
  //       callback(e)
  //     })
  // } catch (e) {
  //   console.log(e)
  //   callback(e)
  // }

  try {
    const requestData = extractMessageData(event)
    Promise.all([
      new CacheRequest().create(requestData.user_request),
      new CacheUser().addRequest(requestData.user_request.user_primary_id, requestData.user_request.request_id)
    ])
      .then(() => {
        callback(null, generateSuccessMessage(requestData.user_request.request_id))
      })
  } catch (e) {
    callback(e)
  }
}

const generateSuccessMessage = (id) => {
  return `Request ${id} successfully updated in cache`
}
