const Schemas = require('@lulibrary/lag-alma-utils')

const CacheItem = require('./cache-item')

class CacheLoan extends CacheItem {
  constructor () {
    super({
      schema: Schemas.LoanSchema,
      tableName: process.env.LoanCacheTableName
    })
  }
}

module.exports = CacheLoan
