const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB({ endpoint: 'http://127.0.0.1:8000', region: 'eu-west-2' })

const uuid = require('uuid/v4')

const DynamoLocal = require('dynamodb-local')
DynamoLocal.configureInstaller({
  installPath: './dynamodblocal'
})

const DynamoLocalPort = 8000

const DB = {
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
    return DynamoLocal.stop(DynamoLocalPort)
  }
}

const testUserTable = `userTable_${uuid()}`
const testLoanTable = `loanTable_${uuid()}`
const testRequestTable = `requestTable_${uuid()}`

before(function () {
  process.env.LoanCacheTableName = testLoanTable
  process.env.UserCacheTableName = testUserTable

  console.log('creating keys')

  process.env.AWS_ACCESS_KEY_ID = uuid()
  process.env.AWS_SECRET_ACCESS_KEY = uuid()

  this.timeout(10000)
  return DB.launch()
    .then(() => {
      return DB.create([
        {
          name: testUserTable,
          key: 'primary_id'
        },
        {
          name: testLoanTable,
          key: 'loan_id'
        },
        {
          name: testRequestTable,
          key: 'loan_id'
        }
      ])
    })
})

after(() => {
  delete process.env.LoanCacheTableName
  delete process.env.UserCacheTableName

  delete process.env.AWS_ACCESS_KEY_ID
  delete process.env.AWS_SECRET_ACCESS_KEY

  DB.stop()
})
