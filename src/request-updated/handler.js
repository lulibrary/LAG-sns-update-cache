const extractMessageData = require('../extract-message-data')
const almaCache = require('../cache-from-env')

module.exports.handle = (event, context, callback) => {
  try {
    const requestData = extractMessageData(event)
    almaCache.handleRequestUpdate(requestData.user_request)
      .then(() => callback(null, generateSuccessMessage(requestData.user_request.request_id)))
      .catch(callback)
  } catch (e) {
    callback(e)
  }
}

const generateSuccessMessage = (id) => {
  return `Request ${id} successfully updated in cache`
}
