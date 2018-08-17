# LAG-sns-update-cache
A serverless application on AWS Lambda for processing Alma data on SNS topics, which writes the data to DynamoDB

This service is built on the [serverless](https://serverless.com/) framework.

The service is intended to handle messages on the eight SNS topics created by [alma-webhook-handler](https://github.com/lulibrary/alma-webhook-handler). These are topics for Alma webhook events, with a topic for each of the events `LOAN_CREATED`, `LOAN_RENEWED`, `LOAN_DUE_DATE`, `LOAN_RETURNED`, `REQUEST_CREATED`, `REQUEST_CANCELED`, `REQUEST_CLOSED` AND `REQUEST_PLACED_ON_SHELF`. Messages being published to these topics trigger the ambdas in this service.

The service consists of four AWS Lambda functions, `loan-updated`, `loan-returned`, `request-updated` and `request-closed`.

### loan-updated
The `loan-updated` handler is invoked by messages on the `LOAN_CREATED`, `LOAN_RENEWED` and `LOAN_DUE_DATE` topics. The handler takes the Loan data from the message, and writes it directly to DynamoDB as a `Loan` record. The handler will also check DynamoDB for a `User` matching the `user_id`, and if found, add the `loan_id` of the Loan to the `loan_ids` field on the User. If no matching User is found, the handler will send a message of the user ID to an SQS Queue, to queue that user for updating by the [LAG-bulk-update-cache](https://github.com/lulibrary/LAG-bulk-update-cache) service.

### loan-returned
The `loan-returned` handler is invoked by messages on the `LOAN_RETURNED` topic. The handler will take the loan ID from the message, and attempt to delete the corresponding Loan from DynamoDB. It will also attempt to delete the loan ID from the corresponding User record, or send the user ID to the Users SQS Queue if no matching user exists.

### request-updated
The `request-updated` handler is invoked by messages on the `REQUEST_CREATED` and `REQUEST_PLACED_ON_SHELF` topics. The handler takes Request data from the message, writes it directly to DynamoDB, and performs the same process as `loan-updated` for adding the request ID to the matching User, sending the user ID to the users Queue if the user record does not exist.

### request-closed
The `request-closed` handler is invoked by messages on the `REQUEST_CANCELED` and `REQUEST_CLOSED` topics. The handler takes request IDs from messages, and deletes matching requests from DynamoDB. It also attempts to delete the request ID from the corresponding User, sending the user ID to the users Queue if the user record does not exist.

## Usage

The service can be deployed using the command
`sls deploy --stage <STAGE> --region <REGION>`

There are two valid stages defined in the `serverless.yml` configuration file. These are `stg` and `prod`. Environment variables for the topic names and ARNs for each topic should be set for the given stage. These are all of the form `<EVENT_TYPE>_TOPIC_ARN_<STAGE>`. The full list of environment variables is:

Topic | Staging | Production
--- | --- | ---
Loan Created | `LOAN_CREATED_TOPIC_ARN_STG` | `LOAN_CREATED_TOPIC_ARN_PROD`
Loan Due Date | `LOAN_DUE_DATE_TOPIC_ARN_STG` | `LOAN_DUE_DATE_TOPIC_ARN_PROD`
Loan Renewed | `LOAN_RENEWED_TOPIC_ARN_STG` | `LOAN_RENEWED_TOPIC_ARN_PROD`
Loan Returned | `LOAN_RETURNED_TOPIC_ARN_STG` | `LOAN_RETURNED_TOPIC_ARN_PROD`
Request Created | `REQUEST_CREATED_TOPIC_ARN_STG` | `REQUEST_CREATED_TOPIC_ARN_PROD`
Request Placed on Shelf | `REQUEST_PLACED_ON_SHELF_TOPIC_ARN_STG` | `REQUEST_PLACED_ON_SHELF_TOPIC_ARN_PROD`
Request Closed | `REQUEST_CLOSED_TOPIC_ARN_STG` | `REQUEST_CLOSED_TOPIC_ARN_PROD`
Request Canceled | `REQUEST_CANCELED_TOPIC_ARN_STG` | `REQUEST_CANCELED_TOPIC_ARN_PROD`

Deploying the service will create the four lambdas with subscriptions to the specified topics. It will also create a DynamoDB table for each of `Users`, `Loans` and `Requests`, and an SQS `Users` Queue and associated dead letter queue, set up with a default redrive policy on the `Users` queue to push messages to the DLQ after three failed receives. By default the DLQ will retain messages for two weeks.

## Associated Services

There are four services that make up the Alma caching stack. These are:

- [alma-webhook-handler](https://github.com/lulibrary/alma-webhook-handler)       -   passes Alma webhook data to SNS topics :
- [LAG-sns-update-cache](https://github.com/lulibrary/LAG-sns-update-cache)       -   writes webhook data from SNS topics to  DynanoDB
- [LAG-bulk-update-cache](https://github.com/lulibrary/LAG-bulk-update-cache)     -   updates DynamoDB with data from Alma API for queued records
- [LAG-api-gateway](https://github.com/lulibrary/LAG-api-gateway)                 -   provides a REST API for cached Alma data with fallback to Alma API

There are also 3 custom packages on which these depend. These are:
- [LAG-Utils](https://github.com/lulibrary/LAG-Utils)                             -   utility library for AWS services
- [LAG-Alma-Utils](https://github.com/lulibrary/LAG-Alma-Utils)                   -   utility library for DynamoDB cache schemas
- [node-alma-api-wrapper](https://github.com/lulibrary/node-alma-api-wrapper)     -   utility library for querying Alma API


## Development
Contributions to this service or any of the associated services and packages are welcome.
