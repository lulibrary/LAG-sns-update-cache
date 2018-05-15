const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// Helper method for SNS Handler Lambdas to delete Loans from the cache
module.exports = (loanID) => {
  const EventLoan = new Loan({ id: loanID, tableName: process.env.LoanCacheTableName, region: process.env.AWS_REGION })
  return EventLoan.delete()
}
