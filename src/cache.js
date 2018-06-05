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

  updateUserWithLoan (userID, loanID) {
    return this.models.UserModel.get(userID)
      .then(user => {
        return user
          ? user.addLoan(loanID)
          : this.usersQueue.sendMessage(userID)
      })
  }

  updateUserWithRequest (userID, requestID) {
    return this.models.UserModel.get(userID)
      .then(user => {
        return user
          ? user.addRequest(requestID)
          : this.usersQueue.sendMessage(userID)
      })
  }

  updateLoan (userLoan) {
    return new this.models.LoanModel(userLoan).save()
  }

  handleLoanUpdate (userLoan) {
    return Promise.all([
      this.updateLoan(userLoan),
      this.updateUserWithLoan(userLoan.user_id, userLoan.loan_id)
    ])
  }
}

module.exports = Cache
