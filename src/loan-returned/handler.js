'use strict'

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const User = require('@lulibrary/lag-alma-utils/src/user')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')
const Queue = require('@lulibrary/lag-utils/src/queue')

const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const validateEvent = require('../validate-event')
const extractMessageData = require('../extract-message-data')

const supportedEvents = ['LOAN_RETURNED']

module.exports.handle = (event, context, callback) => {
  let loanData

  Promise.resolve()
    .then(() => {
      loanData = extractMessageData(event)
      validateEvent(loanData.event.value, supportedEvents)
    })
    .then(() => {
      return deleteLoanFromCache(loanData.item_loan.loan_id)
    })
    .then(() => {
      callback(null, `Loan ${loanData.item_loan.loan_id} successfully updated with event ${loanData.event.value}. Loan has been removed from cache`)
    })
    .catch(e => {
      callback(e)
    })
}

const deleteLoanFromCache = (loanID) => {
  const EventLoan = new Loan({ id: loanID, tableName: process.env.LoanCacheTableName, region: process.env.AWS_REGION })
  return EventLoan.delete()
}
