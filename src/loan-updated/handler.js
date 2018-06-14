const extractMessageData = require('../extract-message-data')
const almaCache = require('../cache-from-env')

module.exports.handle = (event, context, callback) => {
  let loanData

  try {
    loanData = extractMessageData(event)
  } catch (e) {
    callback(e)
    return
  }

  almaCache.handleLoanUpdate(loanData.item_loan)
    .then(() => {
      callback(null, generateSuccessMessage(loanData.item_loan.loan_id))
    })
    .catch(callback)
}

const generateSuccessMessage = (id) => {
  return `Loan ${id} successfully updated in cache`
}
