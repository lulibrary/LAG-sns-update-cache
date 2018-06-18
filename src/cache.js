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
    this.usersQueue = new Queue({
      name: process.env.UsersQueueName,
      owner: process.env.UsersQueueOwner,
      url: process.env.UsersQueueURL
    })
    this.models = {}
    Object.keys(tables).forEach((type) => this.createModelByType(type, tables[type]))
  }

  createModelByType (type, tableName) {
    let modelSchema = schemasByType.get(type)
    let modelName = modelNamesByType.get(type)
    this.models[modelName] = modelSchema(tableName)
  }

  updateUserWithLoan (userID, loanID) {
    return this.updateUserWithItem(userID, loanID, 'loan')
  }

  updateUserWithRequest (userID, requestID) {
    return this.updateUserWithItem(userID, requestID, 'request')
  }

  updateUserWithItem (userID, itemID, itemType) {
    return this.models.UserModel.get(userID)
      .then(user => {
        if (user) {
          switch (itemType) {
            case 'loan':
              return user.addLoan(itemID).save()
            case 'request':
              return user.addRequest(itemID).save()
          }
        } else {
          return this.usersQueue.sendMessage(userID)
        }
      })
  }

  updateLoan (itemLoan) {
    return new this.models.LoanModel(itemLoan).save()
  }

  handleLoanUpdate (itemLoan) {
    return Promise.all([
      this.updateLoan(itemLoan),
      this.updateUserWithLoan(itemLoan.user_id, itemLoan.loan_id)
    ])
  }
}

module.exports = Cache
