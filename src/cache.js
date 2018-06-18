const Schemas = require('@lulibrary/lag-alma-utils')
const Queue = require('@lulibrary/lag-utils/src/queue')

const schemasByType = new Map([
  ['loan', Schemas.LoanSchema],
  ['request', Schemas.RequestSchema],
  ['user', Schemas.UserSchema]
])

const modelNamesByType = new Map([
  ['loan', 'LoanModel'],
  ['request', 'RequestModel'],
  ['user', 'UserModel']
])

class Cache {
  constructor (tables) {
    this.usersQueue = new Queue({ name: process.env.UsersQueueName, owner: process.env.UsersQueueOwner })
    this.models = {}
    tables.forEach((tableName, type) => tableName ? this.createModelByType(type, tableName) : null)
  }

  createModelByType (type, tableName) {
    let modelSchema = schemasByType.get(type)
    let modelName = modelNamesByType.get(type)
    this.models[modelName] = modelSchema(tableName)
  }

  updateUserItem (userID, itemID, operation, itemType) {
    return this.models.UserModel.get(userID)
      .then(user => {
        if (user) {
          return this.callOperationOnUser(user, operation, itemType, itemID)
        } else {
          return this.usersQueue.sendMessage(userID)
        }
      })
  }

  callOperationOnUser (user, operation, itemType, itemID) {
    const userMethods = {
      'add': {
        'loan': user.addLoan,
        'request': user.addRequest
      },
      'delete': {
        'loan': user.deleteLoan,
        'request': user.deleteRequest
      }
    }

    if (userMethods[operation] && userMethods[operation][itemType]) {
      return userMethods[operation][itemType].call(user, itemID).save()
    } else if (userMethods[operation]) {
      throw new Error(`Invalid item type ${itemType}`)
    } else {
      throw new Error(`Invalid operation ${operation}`)
    }
  }

  addLoanToUser (userID, loanID) {
    return this.updateUserItem(userID, loanID, 'add', 'loan')
  }

  addRequestToUser (userID, requestID) {
    return this.updateUserItem(userID, requestID, 'add', 'request')
  }

  deleteLoanFromUser (userID, loanID) {
    return this.updateUserItem(userID, loanID, 'delete', 'loan')
  }

  deleteRequestFromUser (userID, requestID) {
    return this.updateUserItem(userID, requestID, 'delete', 'request')
  }

  updateLoan (itemLoan) {
    return new this.models.LoanModel(itemLoan).save()
  }

  deleteLoan (loanID) {
    return this.models.LoanModel.delete(loanID)
  }

  handleLoanReturned (itemLoan) {
    return Promise.all([
      this.deleteLoan(itemLoan.loan_id),
      this.deleteLoanFromUser(itemLoan.user_id, itemLoan.loan_id)
    ])
  }

  handleLoanUpdate (itemLoan) {
    return Promise.all([
      this.updateLoan(itemLoan),
      this.addLoanToUser(itemLoan.user_id, itemLoan.loan_id)
    ])
  }
}

module.exports = Cache
