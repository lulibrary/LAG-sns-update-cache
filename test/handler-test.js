const chai = require('chai')

chai.should()

describe('handler tests', () => {
  it('should return true', () => {
    let test = true
    test.should.equal(true)
  })
})
