class CacheItem {
  constructor (config) {
    this.Model = config.schema(config.tableName)
  }

  create (data) {
    return new this.Model(data).save()
  }

  delete (id) {
    return this.Model.delete(id)
  }
}

module.exports = CacheItem
