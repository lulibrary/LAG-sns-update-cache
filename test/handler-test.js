const chai = require('chai')

const should = chai.should()

const handler = require('../src/handler')

describe('handler tests', () => {
  it('should return a 200 response', () => {
    handler.handle(null, null, (err, res) => {
      should.not.exist(err)
      res.statusCode.should.equal(200)
    })
  })
})
