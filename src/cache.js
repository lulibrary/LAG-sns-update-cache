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
    this.usersQueue = new Queue(process.env.UsersQueueName, process.env.UsersQueueOwner)
    this.models = {}
    Object.keys(tables).forEach((type) => this.createModelByType(type, tables[type]))
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
          return {
            'add': {
              'loan': user.addLoan,
              'request': user.addRequest
            },
            'delete': {
              'loan': user.deleteLoan,
              'request': user.deleteRequest
            }
          }[operation][itemType].call(user, itemID).save()
        } else {
          return this.usersQueue.sendMessage(userID)
        }
      })
  }

  updateUserWithAddLoan (userID, loanID) {
    return this.updateUserItem(userID, loanID, 'add', 'loan')
  }

  updateUserWithAddRequest (userID, requestID) {
    return this.updateUserItem(userID, requestID, 'add', 'request')
  }

  updateUserWithDeleteLoan (userID, loanID) {
    return this.updateUserItem(userID, loanID, 'delete', 'loan')
  }

  updateUserWithDeleteRequest (userID, requestID) {
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
      this.updateUserWithDeleteLoan(itemLoan.user_id, itemLoan.loan_id)
    ])
  }

  handleLoanUpdate (itemLoan) {
    return Promise.all([
      this.updateLoan(itemLoan),
      this.updateUserWithAddLoan(itemLoan.user_id, itemLoan.loan_id)
    ])
  }
}

module.exports = Cache
