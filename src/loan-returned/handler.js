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
    .catch(e => {
      callback(e)
    })
}
