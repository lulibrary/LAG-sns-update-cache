const extractMessageData = require('../extract-message-data')
const almaCache = require('../cache-from-env')

module.exports.handle = (event, context, callback) => {
  try {
    const loanData = extractMessageData(event)
    almaCache.handleLoanReturned(loanData.item_loan)
      .then(() => callback(null, generateSuccessMessage(loanData.item_loan.loan_id)))
      .catch(callback)
  } catch (e) {
    callback(e)
  }
}

const generateSuccessMessage = (id) => {
  return `Loan ${id} successfully removed from cache`
}
