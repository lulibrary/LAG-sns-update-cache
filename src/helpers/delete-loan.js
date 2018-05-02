const Loan = require('@lulibrary/lag-alma-utils/src/loan')

module.exports = (loanID) => {
  const EventLoan = new Loan({ id: loanID, tableName: process.env.LoanCacheTableName, region: process.env.AWS_REGION })
  return EventLoan.delete()
}
