const Request = require('@lulibrary/lag-alma-utils/src/request')

// Helper method for SNS Handler Lambdas to write new Request data to the cache
module.exports = (requestData) => {
  const requestID = requestData.user_request.request_id
  const requestCacheTable = process.env.RequestCacheTableName
  const eventRequest = new Request({ id: requestID, tableName: requestCacheTable, region: process.env.AWS_REGION })

  return eventRequest
    .populate(requestData.user_request)
    .save()
}
