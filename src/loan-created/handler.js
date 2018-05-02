'use strict'

// const AlmaUtils = require('@lulibrary/lag-alma-utils/src/')
const User = require('@lulibrary/lag-alma-utils/src/user')
const Loan = require('@lulibrary/lag-alma-utils/src/loan')
const Queue = require('@lulibrary/lag-utils/src/queue')

const ItemNotFoundError = require('@lulibrary/lag-utils/src/item-not-found-error')
const validateEvent = require('../validate-event')
const extractMessageData = require('../extract-message-data')

const updateLoan = require('../helpers/update-loan')
const updateUser = require('../helpers/update-user')

const supportedEvents = ['LOAN_CREATED']

module.exports.handle = (event, context, callback) => {
  let loanData

  const queueData = {
    name: process.env.UsersQueueName,
    owner: process.env.UsersQueueOwner
  }

  Promise.resolve()
    .then(() => {
      loanData = extractMessageData(event)
      validateEvent(loanData.event.value, supportedEvents)
    })
    .then(() => {
      return Promise.all([
        updateLoan(loanData, process.env.LoanCacheTableName, process.env.AWS_REGION),
        updateUser(loanData, queueData)
      ])
    })
    .then(() => {
      callback(null, `Loan ${loanData.item_loan.loan_id} successfully updated with event ${loanData.event.value}`)
    }).catch(e => {
      callback(e)
    })
}
