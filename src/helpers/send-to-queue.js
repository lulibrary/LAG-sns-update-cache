const Queue = require('@lulibrary/lag-utils/src/queue')

// Helper method for SNS Handler Lambdas to send messages to a Queue
module.exports = (message, queueName, queueOwner) => {
  const messageQueue = new Queue(queueName, queueOwner)

  return messageQueue.getQueueUrl()
    .then(() => {
      return messageQueue.sendMessage(message)
    })
}
