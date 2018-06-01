const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// Helper method for SNS Handler Lambdas to write new Loan data to the cache
module.exports = (loanData, loanCacheTable, region) => {
  const loanID = loanData.item_loan.loan_id
  const eventLoan = new Loan({ id: loanID, tableName: loanCacheTable, region })

  return eventLoan
    .populate(loanData.item_loan)
    .addExpiryDate('due_date')
    .save()
}
