const extractMessageData = require('../extract-message-data')
const Cache = require('../cache')

module.exports.handle = (event, context, callback) => {
  let loanData

  let almaCache = new Cache({
    loan: process.env.LoanCacheTableName,
    user: process.env.UserCacheTableName
  })

  Promise.resolve()
    .then(() => {
      loanData = extractMessageData(event)
      return almaCache.handleLoanUpdate(loanData.item_loan)
    })
    .then(() => {
      callback(null, `Loan ${loanData.item_loan.loan_id} successfully updated`)
    })
    .catch(callback)
}
