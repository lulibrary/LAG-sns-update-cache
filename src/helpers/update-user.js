const User = require('@lulibrary/lag-alma-utils/src/user')
const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const sendToQueue = require('./send-to-queue')

module.exports = (loanData, queueData) => {
  const loanID = loanData.item_loan.loan_id
  const userID = loanData.item_loan.user_id
  const userCacheTable = process.env.UserCacheTableName
  const eventUser = new User(userID, userCacheTable, process.env.AWS_REGION)

  return eventUser.getData()
    .then(() => {
      return eventUser.addLoan(loanID).save()
    })
    .catch(e => {
      if (e instanceof ItemNotFoundError) {
        return sendToQueue(userID, queueData.name, queueData.owner)
      } else {
        throw e
      }
    })
}