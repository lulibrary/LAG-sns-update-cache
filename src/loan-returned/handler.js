const extractMessageData = require('../extract-message-data')

module.exports.handle = (event, context, callback) => {
  let loanData

  const almaCache = require('../cache-from-env')

  Promise.resolve()
    .then(() => {
      loanData = extractMessageData(event)
      return almaCache.handleLoanReturned(loanData.item_loan)
    })
    .then(() => {
      callback(null, `Loan ${loanData.item_loan.loan_id} successfully removed from cache`)
    })
    .catch(callback)
}
