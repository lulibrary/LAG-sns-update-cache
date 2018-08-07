const Schemas = require('@lulibrary/lag-alma-utils')
const Queue = require('@lulibrary/lag-utils/src/queue')

const CacheItem = require('./cache-item')

class CacheUser extends CacheItem {
  constructor () {
    super({
      schema: Schemas.UserSchema,
      tableName: process.env.UserCacheTableName
    })
    this.queue = new Queue({ url: process.env.UsersQueueURL })
  }

  addLoan (userID, loanID) {
    return this._callOnuser(userID, 'addLoan', loanID)
  }

  addRequest (userID, requestID) {
    return this._callOnuser(userID, 'addRequest', requestID)
  }

  deleteLoan (userID, loanID) {
    return this._callOnuser(userID, 'deleteLoan', loanID)
  }

  deleteRequest (userID, requestID) {
    return this._callOnuser(userID, 'deleteRequest', requestID)
  }

  _callOnuser (userID, methodName, ...args) {
    return this.Model.getValid(userID)
      .then(user => {
        return user
          ? user[methodName](...args).save()
          : this.queue.sendMessage(userID)
      })
  }
}

module.exports = CacheUser
