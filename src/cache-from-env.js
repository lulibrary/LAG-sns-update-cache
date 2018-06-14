const Cache = require('./cache')

let tables = new Map([
  ['loan', process.env.LoanCacheTableName],
  ['request', process.env.RequestCacheTableName],
  ['user', process.env.UserCacheTableName]
])

module.exports = new Cache(tables)
