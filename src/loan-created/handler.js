'use strict'

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const User = require('@lulibrary/lag-alma-utils/src/user')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')

module.exports.handle = (event, context, callback) => {
  const loanData = extractMessageData(event)

  Promise.all([
    updateLoan(loanData),
    updateUser(loanData)
  ]).then(() => {
    callback(null, `Loan ${loanData.item_loan.loan_id} successfully updated with event ${loanData.event.value}`)
  }).catch(e => {
    callback(e)
  })
}

const extractMessageData = (event) => {
  try {
    return JSON.parse(event.Records[0].Sns.Message)
  } catch (e) {
    throw new Error('Cannot parse SNS message')
  }
}

const updateLoan = (loanData) => {
  const loanID = loanData.item_loan.loan_id
  const loanCacheTable = process.env.LoanCacheTableName
  const eventLoan = new Loan(loanID, loanCacheTable, process.env.AWS_REGION)

  return eventLoan
    .populate(loanData.item_loan)
    .addExpiryDate()
    .save()
}

const updateUser = (loanData) => {
  const loanID = loanData.item_loan.loan_id
  const userID = loanData.item_loan.user_id
  const userCacheTable = process.env.UserCacheTableName
  const eventUser = new User(userID, userCacheTable, process.env.AWS_REGION)

  return eventUser.getData()
    .then(() => {
      return eventUser.addLoan(loanID).save()
    })
    .catch(e => {
      if (e.message === 'No matching record found') {
        console.log('Must update cache with full user data')
      } else {
        throw e
      }
    })
}
