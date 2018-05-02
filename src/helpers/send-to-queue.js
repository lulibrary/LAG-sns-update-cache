const Queue = require('@lulibrary/lag-utils/src/queue')

module.exports = (message, queueName, queueOwner) => {
  const messageQueue = new Queue(queueName, queueOwner)

  return messageQueue.getQueueUrl()
    .then(() => {
      return messageQueue.sendMessage(message)
    })
}
