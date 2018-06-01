const User = require('@lulibrary/lag-alma-utils/src/user')
const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const sendToQueue = require('./send-to-queue')

// Helper method for SNS Handler Lambdas to add a new Loan to a User in the cache
// or send the user ID to a message Queue for bulk updating if it is not in the cache
module.exports = (userID, field, value, resourceData) => {
  const eventUser = new User(userID, resourceData.userTable.name, resourceData.userTable.region)

  return eventUser.getData()
    .then(() => addValueToUser(eventUser, field, value))
    .catch(e => {
      if (e instanceof ItemNotFoundError) {
        return sendToQueue(userID, resourceData.userQueue.name, resourceData.userQueue.owner)
      } else {
        throw e
      }
    })
}

const addValueToUser = (user, field, value) => {
  switch (field) {
    case 'loan':
      return user.addLoan(value).save()
    case 'request':
      return user.addRequest(value).save()
    default:
      throw new Error('Cannot add to this field')
  }
}
