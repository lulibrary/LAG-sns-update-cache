const sinon = require('sinon')
const sandbox = sinon.sandbox.create()

const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const uuid = require('uuid/v4')

const rewire = require('rewire')
let wires = []

const Queue = require('@lulibrary/lag-utils/src/queue')
const Schemas = require('@lulibrary/lag-alma-utils')

const tableMap = new Map([
  ['user', 'userTable'],
  ['loan', 'loanTable'],
  ['request', 'requestTable']
])

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
      let testCache = new Cache(tableMap)
      testCache.usersQueue.should.be.an.instanceOf(Queue)
    })

    it('should call createModel with the key and value of each property of the supplied object', () => {
      let tables = new Map([
        ['user', 'userTable'],
        ['loan', 'loanTable'],
        ['test', 'testTable']
      ])

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

      let testCache = new Cache(new Map())

      testCache.createModelByType('loan', 'loanTable')
      loanSchemaStub.should.have.been.calledOnce
      loanSchemaStub.should.have.been.calledWith('loanTable')
    })
  })

  describe('addRequestToUser tests', () => {
    it('should call get on the user model', () => {
      let testCache = new Cache(tableMap)
      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      userGetStub.resolves({
        addRequest: () => {
          return {
            save: () => true
          }
        }
      })

      return testCache.addRequestToUser('a user', 'a request').then(() => {
        userGetStub.should.have.been.calledOnce
        userGetStub.should.have.been.calledWith('a user')
      })
    })

    it('should call addRequest on the user if the user is found', () => {
      let testCache = new Cache(tableMap)

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let addRequestStub = sandbox.stub()
      addRequestStub.returns({
        save: () => Promise.resolve(true)
      })
      userGetStub.resolves({
        addRequest: addRequestStub
      })

      return testCache.addRequestToUser('a user', 'a request').then(() => {
        addRequestStub.should.have.been.calledOnce
        addRequestStub.should.have.been.calledWith('a request')
      })
    })

    it('should call sendMessage on the queue if the user is not found', () => {
      let testCache = new Cache(tableMap)

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let sendMessageStub = sandbox.stub(testCache.usersQueue, 'sendMessage')

      userGetStub.resolves()

      return testCache.addRequestToUser('a user', 'a request').then(() => {
        sendMessageStub.should.have.been.calledOnce
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })
  })

  describe('addLoanToUser tests', () => {
    it('should call get on the user model', () => {
      let testCache = new Cache(tableMap)

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      userGetStub.resolves({
        addLoan: () => {
          return {
            save: () => true
          }
        }
      })

      return testCache.addLoanToUser('a user', 'a loan').then(() => {
        userGetStub.should.have.been.calledOnce
        userGetStub.should.have.been.calledWith('a user')
      })
    })

    it('should call addLoan on the user if the user is found', () => {
      let testCache = new Cache(tableMap)

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let addLoanStub = sandbox.stub()
      addLoanStub.returns({
        save: () => Promise.resolve(true)
      })
      userGetStub.resolves({
        addLoan: addLoanStub
      })

      return testCache.addLoanToUser('a user', 'a loan').then(() => {
        addLoanStub.should.have.been.calledOnce
        addLoanStub.should.have.been.calledWith('a loan')
      })
    })

    it('should call sendMessage on the queue if the user is not found', () => {
      let testCache = new Cache(tableMap)

      let userGetStub = sandbox.stub(testCache.models.UserModel, 'get')
      let sendMessageStub = sandbox.stub(testCache.usersQueue, 'sendMessage')

      userGetStub.resolves()

      return testCache.addLoanToUser('a user', 'a loan').then(() => {
        sendMessageStub.should.have.been.calledOnce
        sendMessageStub.should.have.been.calledWith('a user')
      })
    })
  })

  describe('updateLoan tests', () => {
    it('should call LoanModel with new', () => {
      let testCache = new Cache(tableMap)

      let LoanModelStub = sandbox.stub(testCache.models, 'LoanModel')
      LoanModelStub.returns({
        save: () => true
      })

      testCache.updateLoan('loandata')
      LoanModelStub.should.have.been.calledWithNew
      LoanModelStub.should.have.been.calledWith('loandata')
    })

    it('should call Loan#save', () => {
      let testCache = new Cache(tableMap)

      let saveStub = sandbox.stub(testCache.models.LoanModel.prototype, 'save')
      saveStub.resolves(true)

      testCache.updateLoan('loandata').then(() => {
        saveStub.should.have.been.calledOnce
      })
    })
  })

  describe('handle loan update tests', () => {
    it('should call updateLoan', () => {
      let testCache = new Cache(tableMap)

      let updateLoanStub = sandbox.stub(testCache, 'updateLoan')
      updateLoanStub.resolves(true)

      sandbox.stub(testCache, 'addLoanToUser').resolves(true)

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

    it('should call addLoanToUser', () => {
      let testCache = new Cache(tableMap)

      sandbox.stub(testCache, 'updateLoan').resolves(true)

      let addLoanToUserStub = sandbox.stub(testCache, 'addLoanToUser').resolves(true)

      return testCache.handleLoanUpdate({
        user_id: 'a user',
        loan_id: 'a loan'
      }).then(() => {
        addLoanToUserStub.should.have.been.calledWith('a user', 'a loan')
      })
    })
  })

  describe('updateUserItem method tests', () => {
    it('should call user#addLoan for parameters ["add", "loan"]', () => {
      let testCache = new Cache(tableMap)

      const itemID = uuid()

      const getUserStub = sandbox.stub(testCache.models.UserModel, 'get')
      const addLoanStub = sandbox.stub()
      addLoanStub.returns({
        save: () => true
      })
      getUserStub.resolves({
        addLoan: addLoanStub
      })

      testCache.updateUserItem('testUser', itemID, 'add', 'loan').then(() => {
        addLoanStub.should.have.been.calledOnce
        addLoanStub.should.have.been.calledWith(itemID)
      })
    })

    it('should call user#addRequest for parameters ["add", "request"]', () => {
      let testCache = new Cache(tableMap)

      const itemID = uuid()

      const getUserStub = sandbox.stub(testCache.models.UserModel, 'get')
      const addRequestStub = sandbox.stub()
      addRequestStub.returns({
        save: () => true
      })
      getUserStub.resolves({
        addRequest: addRequestStub
      })

      testCache.updateUserItem('testUser', itemID, 'add', 'request').then(() => {
        addRequestStub.should.have.been.calledOnce
        addRequestStub.should.have.been.calledWith(itemID)
      })
    })

    it('should call user#addRequest for parameters ["delete", "loan"]', () => {
      let testCache = new Cache(tableMap)

      const itemID = uuid()

      const getUserStub = sandbox.stub(testCache.models.UserModel, 'get')
      const deleteLoanStub = sandbox.stub()
      deleteLoanStub.returns({
        save: () => true
      })
      getUserStub.resolves({
        deleteLoan: deleteLoanStub
      })

      testCache.updateUserItem('testUser', itemID, 'delete', 'loan').then(() => {
        deleteLoanStub.should.have.been.calledOnce
        deleteLoanStub.should.have.been.calledWith(itemID)
      })
    })

    it('should call user#addRequest for parameters ["add", "request"]', () => {
      let testCache = new Cache(tableMap)

      const itemID = uuid()

      const getUserStub = sandbox.stub(testCache.models.UserModel, 'get')
      const deleteRequestStub = sandbox.stub()
      deleteRequestStub.returns({
        save: () => true
      })
      getUserStub.resolves({
        deleteRequest: deleteRequestStub
      })

      testCache.updateUserItem('testUser', itemID, 'delete', 'request').then(() => {
        deleteRequestStub.should.have.been.calledOnce
        deleteRequestStub.should.have.been.calledWith(itemID)
      })
    })

    it('should call Queue#sendMessage if no user item is found', () => {
      let testCache = new Cache(tableMap)

      const userID = uuid()

      sandbox.stub(testCache.models.UserModel, 'get').resolves()
      const sendMessageStub = sandbox.stub(Queue.prototype, 'sendMessage')
      sendMessageStub.resolves()

      testCache.updateUserItem(userID, 'testItem', 'delete', 'request').then(() => {
        sendMessageStub.should.have.been.calledWith(userID)
      })
    })
  })

  describe('deleteLoanFromUser tests', () => {
    it('should call updateUserItem with parameters ["delete", "loan"]', () => {
      let testCache = new Cache(tableMap)

      const userID = uuid()
      const loanID = uuid()

      const updateUserItemStub = sandbox.stub(testCache, 'updateUserItem')
      updateUserItemStub.resolves()

      testCache.deleteLoanFromUser(userID, loanID)
      updateUserItemStub.should.have.been.calledWithExactly(userID, loanID, 'delete', 'loan')
    })

    it('should call updateUserItem with parameters ["delete", "loan"]', () => {
      let testCache = new Cache(tableMap)

      const userID = uuid()
      const requestID = uuid()

      const updateUserItemStub = sandbox.stub(testCache, 'updateUserItem')
      updateUserItemStub.resolves()

      testCache.deleteRequestFromUser(userID, requestID)
      updateUserItemStub.should.have.been.calledWithExactly(userID, requestID, 'delete', 'request')
    })
  })

  describe('deleteLoan method tests', () => {
    it('should call delete on the Loan model', () => {
      let testCache = new Cache(tableMap)

      const loanID = uuid()

      const deleteStub = sandbox.stub(testCache.models.LoanModel, 'delete')
      deleteStub.returns()

      testCache.deleteLoan(loanID)
      deleteStub.should.have.been.calledWithExactly(loanID)
    })
  })

  describe('handleLoanReturned method tests', () => {
    it('should call updateLoan with the loan ID', () => {
      let testCache = new Cache(tableMap)

      const testItemLoan = {
        loan_id: uuid(),
        user_id: uuid()
      }

      sandbox.stub(testCache, 'deleteLoanFromUser').resolves()
      const deleteLoanStub = sandbox.stub(testCache, 'deleteLoan')
      deleteLoanStub.resolves()

      testCache.handleLoanReturned(testItemLoan)
        .then(() => {
          deleteLoanStub.should.have.been.calledWithExactly(testItemLoan.loan_id)
        })
    })

    it('should call deleteLoanFromUser with the user ID and loan ID', () => {
      let testCache = new Cache(tableMap)

      const testItemLoan = {
        loan_id: uuid(),
        user_id: uuid()
      }

      const updateUserStub = sandbox.stub(testCache, 'deleteLoanFromUser')
      sandbox.stub(testCache, 'deleteLoan').resolves()
      updateUserStub.resolves()

      testCache.handleLoanReturned(testItemLoan)
        .then(() => {
          updateUserStub.should.have.been.calledWithExactly(testItemLoan.user_id, testItemLoan.loan_id)
        })
    })
  })

  describe('callOperationOnUser method tests', () => {
    it('should call the operation correctly for valid inputs', () => {
      let testCache = new Cache(tableMap)

      let addLoanStub = sandbox.stub()
      addLoanStub.returns({
        save: () => Promise.resolve(true)
      })

      const testUser = {
        addLoan: addLoanStub
      }

      testCache.callOperationOnUser(testUser, 'add', 'loan', 'a loan').then(() => {
        addLoanStub.should.have.been.calledOnce
        addLoanStub.should.have.been.calledWith('a loan')
      })
    })

    it('should throw an error if the operation is valid but the item type is not', () => {
      let testCache = new Cache(tableMap)

      const testUser = {}

      expect(() => testCache.callOperationOnUser(testUser, 'add', 'INVALID', 'a loan')).to.throw('Invalid item type INVALID')
    })

    it('should throw an error if the operation is not valid', () => {
      let testCache = new Cache(tableMap)

      const testUser = {}

      expect(() => testCache.callOperationOnUser(testUser, 'INVALID', 'loan', 'a loan')).to.throw('Invalid operation INVALID')
    })
  })
})
