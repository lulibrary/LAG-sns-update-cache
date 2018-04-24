const UnsupportedEventError = require('./unsupported-event-error')

const validateEvent = (event, supportedEvents) => {
  if (!supportedEvents.includes(event)) {
    throw new UnsupportedEventError(`Event type ${event} is not supported`)
  }
}

module.exports = validateEvent
