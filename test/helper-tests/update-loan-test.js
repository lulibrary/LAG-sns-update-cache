const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const chai = require('chai')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()
const expect = chai.expect

const Loan = require('@lulibrary/lag-alma-utils/src/loan')

// Module under test
const updateLoan = require('../../src/helpers/update-loan')

describe('update loan method tests', () => {
  afterEach(() => {
    sandbox.restore()
  })

  it('should call Loan#populate with the correct parameters', () => {
    // stub calls to Loan class
    const populateStub = sandbox.stub(Loan.prototype, 'populate')
    const addExpiryStub = sandbox.stub(Loan.prototype, 'addExpiryDate')

    // chain stubs together
    populateStub.returns({
      addExpiryDate: addExpiryStub
    })

    addExpiryStub.returns({
      save: sandbox.stub(Loan.prototype, 'save').resolves(true)
    })

    const expected = {
      loan_id: 'a loan',
      user_id: 'a user'
    }

    return updateLoan({ item_loan: { loan_id: 'a loan', user_id: 'a user' } }, 'a table', 'a region')
      .then(() => {
        populateStub.should.have.been.calledWith(expected)
      })
  })

  it('should call Loan#save', () => {
    sandbox.stub(Loan.prototype, 'populate').returns({
      addExpiryDate: () => new Loan({id: 'a loan', tableName: 'a table', region: 'a region'})
    })

    const saveStub = sandbox.stub(Loan.prototype, 'save')
    saveStub.resolves(true)

    return updateLoan({ item_loan: { loan_id: 'a loan', user_id: 'a user' } }, 'a table', 'a region')
      .then(() => {
        saveStub.should.have.been.calledOnce
      })
  })

  it('should throw an error if Loan#populate throws an error', () => {
    sandbox.stub(Loan.prototype, 'populate').throws(new Error('populate failed'))
    const addExpiryStub = sandbox.stub(Loan.prototype, 'addExpiryDate')

    const testLoan = {
      item_loan: {
        loan_id: 'a loan',
        user_id: 'a user'
      }
    }

    expect(() => updateLoan(testLoan, 'a table', 'a region')).to.throw('populate failed')
    addExpiryStub.should.not.have.been.called
  })
})
