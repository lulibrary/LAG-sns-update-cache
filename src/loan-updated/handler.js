const extractMessageData = require('../extract-message-data')

module.exports.handle = (event, context, callback) => {
  let loanData

  const almaCache = require('../cache-from-env')

  Promise.resolve()
    .then(() => {
      loanData = extractMessageData(event)
      return almaCache.handleLoanUpdate(loanData.item_loan)
    })
    .then(() => {
      callback(null, `Request ${loanData.item_loan.loan_id} successfully updated`)
    })
    .catch(callback)
}
