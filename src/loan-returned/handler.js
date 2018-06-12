const extractMessageData = require('../extract-message-data')
const Cache = require('../cache')

module.exports.handle = (event, context, callback) => {
  let loanData

  const almaCache = Cache.createInstance()

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
