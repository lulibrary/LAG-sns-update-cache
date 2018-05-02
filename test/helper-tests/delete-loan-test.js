const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()

const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// module under test
const deleteLoan = require('../../src/helpers/delete-loan')

describe('delete loan tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  it('should call Loan#delete exactly once', () => {
    const deleteStub = sandbox.stub(Loan.prototype, 'delete')
    deleteStub.resolves(true)

    return deleteLoan('a loan').then(() => {
      deleteStub.should.have.been.calledOnce
    })
  })

  it('should be fulfilled if Loan#delete is fulfilled', () => {
    sandbox.stub(Loan.prototype, 'delete').resolves(true)

    return deleteLoan('a loan').should.eventually.be.fulfilled
  })

  it('should be rejected if Loan#delete is rejected', () => {
    sandbox.stub(Loan.prototype, 'delete').rejects(new Error('Database error'))

    return deleteLoan('a loan').should.eventually.be.rejectedWith('Database error')
      .instanceOf(Error)
  })
})
