const sinon = require('sinon')
const sandbox = sinon.sandbox.create()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()

const rewire = require('rewire')
let wires = []

const Queue = require('@lulibrary/lag-utils/src/queue')
const Schemas = require('@lulibrary/lag-alma-utils')

// Module under test
const Cache = rewire('../src/cache')

describe('cache tests', () => {
  afterEach(() => {
    sandbox.restore()
    wires.forEach(wire => wire())
    wires = []
  })

  describe('constructor tests', () => {
    it('should create a queue object on the Cache', () => {
      let testCache = new Cache({})
      testCache.usersQueue.should.be.an.instanceOf(Queue)
    })

    it('should call createModel with the key and value of each property of the supplied object', () => {
      let tables = {
        user: 'userTable',
        loan: 'loanTable',
        test: 'testTable'
      }

      let createModelStub = sandbox.stub(Cache.prototype, 'createModelByType')

      let testCache = new Cache(tables)
      createModelStub.should.have.been.calledWithExactly('user', 'userTable')
      createModelStub.should.have.been.calledWithExactly('loan', 'loanTable')
      createModelStub.should.have.been.calledWithExactly('test', 'testTable')
    })
  })

  describe('createModelByType tests', () => {
    it('should call the correct method for the schema', () => {
      let loanSchemaStub = sandbox.stub()
      wires.push(Cache.__set__(
        'schemasByType',
        new Map([['loan', loanSchemaStub]])
      ))

      let testCache = new Cache({})

      testCache.createModelByType('loan', 'loanTable')
      loanSchemaStub.should.have.been.calledOnce
      loanSchemaStub.should.have.been.calledWith('loanTable')
    })
  })

  describe('updateUsersWithRequest tests', () => {
    it('should call get on the user model', () => {
      let testCache = new Cache({
        user: 'userTable'
      })
      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      userGetStub.resolves({
        addRequest: () => true
      })

      return testCache.updateUserWithRequest('a user', 'a request').then(() => {
        userGetStub.should.have.been.calledOnce
        userGetStub.should.have.been.calledWith('a user')
      })
    })

    it('should call addRequest on the user if the user is found', () => {
      let testCache = new Cache({
        user: 'userTable'
      })

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let addRequestStub = sandbox.stub()
      userGetStub.resolves({
        addRequest: addRequestStub
      })

      return testCache.updateUserWithRequest('a user', 'a request').then(() => {
        addRequestStub.should.have.been.calledOnce
        addRequestStub.should.have.been.calledWith('a request')
      })
    })

    it('should call sendMessage on the queue if the user is not found', () => {
      let testCache = new Cache({
        user: 'userTable'
      })

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let sendMessageStub = sandbox.stub(testCache.usersQueue, 'sendMessage')

      userGetStub.resolves()

      return testCache.updateUserWithRequest('a user', 'a request').then(() => {
        sendMessageStub.should.have.been.calledOnce
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })
  })

  describe('updateUsersWithLoan tests', () => {
    it('should call get on the user model', () => {
      let testCache = new Cache({
        user: 'userTable'
      })
      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      userGetStub.resolves({
        addLoan: () => true
      })

      return testCache.updateUserWithLoan('a user', 'a loan').then(() => {
        userGetStub.should.have.been.calledOnce
        userGetStub.should.have.been.calledWith('a user')
      })
    })

    it('should call addRequest on the user if the user is found', () => {
      let testCache = new Cache({
        user: 'userTable'
      })

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let addLoanStub = sandbox.stub()
      userGetStub.resolves({
        addLoan: addLoanStub
      })

      return testCache.updateUserWithLoan('a user', 'a loan').then(() => {
        addLoanStub.should.have.been.calledOnce
        addLoanStub.should.have.been.calledWith('a loan')
      })
    })

    it('should call sendMessage on the queue if the user is not found', () => {
      let testCache = new Cache({
        user: 'userTable'
      })

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let sendMessageStub = sandbox.stub(testCache.usersQueue, 'sendMessage')

      userGetStub.resolves()

      return testCache.updateUserWithLoan('a user', 'a loan').then(() => {
        sendMessageStub.should.have.been.calledOnce
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })
  })

  describe('updateLoan tests', () => {
    it('should call LoanModel with new', () => {
      const testCache = new Cache({
        loan: 'loanTable'
      })

      let LoanModelStub = sandbox.stub(testCache.models, 'LoanModel')
      LoanModelStub.returns({
        save: () => true
      })

      testCache.updateLoan('loandata')
      LoanModelStub.should.have.been.calledWithNew
      LoanModelStub.should.have.been.calledWith('loandata')
    })

    it('should call Loan#save', () => {
      const testCache = new Cache({
        loan: 'loanTable'
      })

      let saveStub = sandbox.stub(testCache.models.LoanModel.prototype, 'save')
      saveStub.resolves(true)

      testCache.updateLoan('loandata').then(() => {
        saveStub.should.have.been.calledOnce
      })
    })
  })

  describe('handle loan update tests', () => {
    it('should call updateLoan', () => {
      const testCache = new Cache({
        loan: 'loanTable'
      })

      let updateLoanStub = sandbox.stub(testCache, 'updateLoan')
      updateLoanStub.resolves(true)

      sandbox.stub(testCache, 'updateUserWithLoan').resolves(true)

      return testCache.handleLoanUpdate({
        user_id: 'a user',
        loan_id: 'a loan'
      }).then(() => {
        updateLoanStub.should.have.been.calledWith({
          user_id: 'a user',
          loan_id: 'a loan'
        })
      })
    })

    it('should call updateUserWithLoan', () => {
      const testCache = new Cache({
        loan: 'loanTable'
      })

      sandbox.stub(testCache, 'updateLoan').resolves(true)

      let updateUserWithLoanStub = sandbox.stub(testCache, 'updateUserWithLoan').resolves(true)

      return testCache.handleLoanUpdate({
        user_id: 'a user',
        loan_id: 'a loan'
      }).then(() => {
        updateUserWithLoanStub.should.have.been.calledWith('a user', 'a loan')
      })
    })
  })
})
