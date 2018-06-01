const Request = require('@lulibrary/lag-alma-utils/src/request')

// Helper method for SNS Handler Lambdas to write new Request data to the cache
module.exports = (requestData, resourceData) => {
  const requestID = requestData.user_request.request_id
  const requestCacheTable = resourceData.requestTable.name
  const eventRequest = new Request({ id: requestID, tableName: requestCacheTable, region: resourceData.requestTable.region })

  return eventRequest
    .populate(requestData.user_request)
    .save()
}
