const t = require('tap')
const rewire = require('rewire')
const gtrace = rewire('../')

const isRealSpan = gtrace.__get__('isRealSpan')
const buildRootOption = gtrace.__get__('buildRootOption')
const isInvalidRootOption = gtrace.__get__('isInvalidRootOption')

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

t.test('buildRootOption() with correct request and no tracePluginOptions', t => {
  const dummyRequest = {
    raw: {
      client: {
        parser: {
          incoming: {
            originalUrl: '/test/123',
            method: 'GET'
          }
        }
      }
    }
  }
  t.equal(
    buildRootOption(dummyRequest, {}).name,
    '/test/123',
    'buildRootOption() has url for its name'
  )
  t.equal(
    buildRootOption(dummyRequest, {}).url,
    '/test/123',
    'buildRootOption() has url for its url'
  )
  t.equal(
    buildRootOption(dummyRequest, {}).method,
    'GET',
    'buildRootOption() has GET for its method'
  )
  t.end()
})

t.test('buildRootOption() with correct request and tracePluginOptions to override name', t => {
  const dummyRequest = {
    raw: {
      client: {
        parser: {
          incoming: {
            originalUrl: '/test/123',
            method: 'GET'
          }
        }
      }
    }
  }
  const tracePluginOptions = {
    nameOverride: req => 'test tracer name'
  }
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).name,
    'test tracer name',
    'buildRootOption() has url for its name'
  )
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).url,
    '/test/123',
    'buildRootOption() has url for its url'
  )
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).method,
    'GET',
    'buildRootOption() has GET for its method'
  )
  t.end()
})

t.test('buildRootOption() with incorrect request and tracePluginOptions to override name', t => {
  const dummyRequest = {
    raw: {
      client: {
        parser: {
          incomings: {
            originalUrl: '/test/123',
            method: 'GET'
          }
        }
      }
    }
  }
  const tracePluginOptions = {
    nameOverride: req => 'test tracer name'
  }
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).name,
    'test tracer name',
    'buildRootOption() has url for its name'
  )
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).url,
    null,
    'buildRootOption() has url for its url'
  )
  t.equal(
    buildRootOption(dummyRequest, tracePluginOptions).method,
    null,
    'buildRootOption() has GET for its method'
  )
  t.end()
})

t.test('isInvalidRootOption() when valid option is passed', t => {
  const option = {
    url: '/test/123',
    method: 'GET'
  }
  t.equal(isInvalidRootOption(option), false, 'isInvalidRootOption() should return false')
  t.end()
})

t.test('isInvalidRootOption() when invalid url option is passed', t => {
  const option = {
    url: null,
    method: 'GET'
  }
  t.equal(isInvalidRootOption(option), true, 'isInvalidRootOption() should return true')
  t.end()
})

t.test('isInvalidRootOption() when invalid method option is passed', t => {
  const option = {
    url: '/test/123',
    method: { method: 'GET' }
  }
  t.equal(isInvalidRootOption(option), true, 'isInvalidRootOption() should return true')
  t.end()
})
