const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB({ endpoint: 'http://127.0.0.1:8000', region: 'eu-west-2' })

const DynamoLocal = require('dynamodb-local')
DynamoLocal.configureInstaller({
  installPath: './dynamodblocal'
})

const DynamoLocalPort = 8000

process.env.AWS_ACCESS_KEY_ID = 'key'
process.env.AWS_SECRET_ACCESS_KEY = 'key2'

module.exports = {
  launch: () => {
    return DynamoLocal.launch(DynamoLocalPort)
      .then(() => {
        console.log('DynamoDB Local started')
      })
      .then(() => {
        return new Promise(resolve => {
          setTimeout(resolve, 1000)
        })
      })
  },
  create: (tables) => {
    let promises = []
    tables.forEach(table => {
      promises.push(
        dynamo.createTable({
          AttributeDefinitions: [
            {
              AttributeName: table.key,
              AttributeType: 'S'
            }
          ],
          KeySchema: [
            {
              AttributeName: table.key,
              KeyType: 'HASH'
            }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          },
          TableName: table.name
        })
          .promise()
          .then(() => {
            console.log(`Table ${table.name} created with key ${table.key}`)
          })
      )
    })
    return Promise.all(promises)
  },
  stop: () => {
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    return DynamoLocal.stop(DynamoLocalPort)
  }
}
