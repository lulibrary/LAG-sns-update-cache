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

  almaCache.handleLoanReturned(loanData.item_loan)
    .then(() => {
      callback(null, generateSuccessMessage(loanData.item_loan.loan_id))
    })
    .catch(callback)

  // Promise.resolve()
  //   .then(() => {
  //     return almaCache.handleLoanReturned(loanData.item_loan)
  //   })
  //   .then(() => {
  //     callback(null, `Loan ${loanData.item_loan.loan_id} successfully removed from cache`)
  //   })
  //   .catch(callback)
}

const generateSuccessMessage = (id) => {
  return `Loan ${id} successfully removed from cache`
}

// const myMethod = (event, context, callback) => {
//   return LoanEvents.handleLoanReturned(event, callback)
// }

// const testhandle = (event, context, callback) => {
//   try {
//     let loanData = extractMessageData(event)
//   } catch (error) {
//     callback(null, null)
//     return
//   }

//   almaCache.handleLoanReturned(loanData.item_loan).then(() => {
//     callback(null, generateSuccessMessage(id))
//   }).catch(() => {
//     callback(null, null)
//   })
// }
