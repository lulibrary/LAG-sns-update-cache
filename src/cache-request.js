const Schemas = require('@lulibrary/lag-alma-utils')

const CacheItem = require('./cache-item')

class CacheRequest extends CacheItem {
  constructor () {
    super({
      schema: Schemas.RequestSchema,
      tableName: process.env.RequestCacheTableName
    })
  }
}

module.exports = CacheRequest
