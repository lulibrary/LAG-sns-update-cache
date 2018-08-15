const extractMessageData = require('../extract-message-data')
const CacheLoan = require('../cache-loan')
const CacheUser = require('../cache-user')

module.exports.handle = (event, context, callback) => {
  try {
    const loanData = extractMessageData(event)
    Promise.all([
      new CacheLoan().create(loanData.item_loan),
      new CacheUser().addLoan(loanData.item_loan.user_id, loanData.item_loan.loan_id)
    ])
      .then(() => {
        callback(null, generateSuccessMessage(loanData.item_loan.loan_id))
      })
      .catch(e => {
        console.log(e)
        callback(new Error(`Failed to update Loan ${loanData.item_loan.loan_id} for User ${loanData.item_loan.user_id} in Cache`))
      })
  } catch (e) {
    callback(e)
  }
}

const generateSuccessMessage = (id) => {
  return `Loan ${id} successfully updated in cache`
}
