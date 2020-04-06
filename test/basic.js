const t = require('tap')
const rewire = require('rewire')
const split = require('split2')
const request = require('request')
const Fastify = require('fastify')
const gtrace = rewire('../')

const isRealSpan = gtrace.__get__('isRealSpan')

t.test('isRealSpan()', t => {
  t.equal(isRealSpan({}), false, 'isRealSpan() should return false if span is empty')
  t.equal(
    isRealSpan({ type: 'UNSAMPLED' }),
    false,
    'isRealSpan() should return false if span has UNSAMPLED type'
  )
  t.equal(
    isRealSpan({ type: 'SAMPLED' }),
    true,
    'isRealSpan() should return true if span has SAMPLED type'
  )
  t.end()
})

t.test('When you use http for GET method', t => {
  const stream = split(JSON.parse)
  const fastify = Fastify({
    logger: {
      level: 'error',
      stream
    }
  })

  fastify.register(gtrace)
  fastify.get('/user', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen(0, err => {
    t.error(err)
    t.tearDown(() => fastify.close())

    request(
      {
        method: 'GET',
        url: `http://0.0.0.0:${fastify.server.address().port}/user`
      },
      (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.end()
      }
    )

    stream.on('data', log => {
      t.notMatch(log.msg, 'The url that is passed to rootSpanOption is not string')
      t.notMatch(log.msg, 'The method that is passed to rootSpanOption is not string')
    })
  })
})

t.test('When you use http for POST method', t => {
  const stream = split(JSON.parse)
  const fastify = Fastify({
    logger: {
      level: 'error',
      stream
    }
  })

  t.tearDown(() => fastify.close())

  fastify.register(gtrace)
  fastify.post('/user', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen(0, err => {
    t.error(err)
    t.tearDown(() => fastify.close())

    request(
      {
        method: 'POST',
        url: `http://0.0.0.0:${fastify.server.address().port}/user`
      },
      (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.end()
      }
    )

    stream.on('data', log => {
      t.notMatch(log.msg, 'The url that is passed to rootSpanOption is not string')
      t.notMatch(log.msg, 'The method that is passed to rootSpanOption is not string')
    })
  })
})
