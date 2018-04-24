class UnsupportedEventError extends Error {
  constructor (...args) {
    super(...args)
    Error.captureStackTrace(this, UnsupportedEventError)
  }
}

module.exports = UnsupportedEventError
