const fp = require('fastify-plugin')
const get = require('lodash.get')

const UNSAMPLED_ROOT = 'UNSAMPLED'

function isRealSpan (span) {
  return get(span, 'type', UNSAMPLED_ROOT) !== UNSAMPLED_ROOT
}

function buildRootOption (req, tracePluginOptions) {
  const url = get(req.raw, 'client.parser.incoming.originalUrl', null)
  const method = get(req.raw, 'client.parser.incoming.method', null)

  return {
    name: tracePluginOptions.nameOverride ? tracePluginOptions.nameOverride(req) : url,
    url,
    method
  }
}

function isInvalidRootOption (options) {
  if (!options.url || typeof options.url !== 'string') {
    console.warn('The url that is passed to rootSpanOption is not string')
    return true
  }

  if (!options.method || typeof options.method !== 'string') {
    console.warn('The method that is passed to rootSpanOption is not string')
    return true
  }

  return false
}

function plugin (fastify, options, next) {
  let trace = null
  const { traceApiOptions, tracePluginOptions } = options
  trace = require('@google-cloud/trace-agent').start(traceApiOptions || {})

  fastify.addHook('onRequest', (req, reply, done) => {
    if (trace) {
      const rootSpanOption = buildRootOption(req, tracePluginOptions || {})
      if (isInvalidRootOption(rootSpanOption)) {
        done()
        return
      }
      trace.runInRootSpan(rootSpanOption, span => {
        if (isRealSpan(span)) {
          req.rootSpan = span
          req.isRealSpan = true
          req.onRequestSpan = req.rootSpan.createChildSpan({ name: 'onRequest' })
        }
        done()
      })
    } else {
      done()
    }
  })

  fastify.addHook('preParsing', (req, reply, done) => {
    if (req.onRequestSpan) {
      req.onRequestSpan.endSpan()
    }

    if (req.isRealSpan) {
      req.parsing = req.rootSpan.createChildSpan({ name: 'Parsing' })
    }
    done()
  })

  fastify.addHook('preValidation', (req, reply, done) => {
    if (req.parsing) {
      req.parsing.endSpan()
    }

    if (req.isRealSpan) {
      req.validation = req.rootSpan.createChildSpan({ name: 'Validation' })
    }
    done()
  })

  fastify.addHook('preHandler', (req, reply, done) => {
    if (req.validation) {
      req.validation.endSpan()
    }

    if (req.isRealSpan) {
      req.handler = req.rootSpan.createChildSpan({ name: 'Handler' })
    }
    done()
  })

  fastify.addHook('preSerialization', (req, reply, payload, done) => {
    if (req.handler) {
      req.handler.endSpan()
    }

    if (req.isRealSpan) {
      req.serialization = req.rootSpan.createChildSpan({ name: 'Serialization' })
    }
    done()
  })

  fastify.addHook('onError', (req, reply, error, done) => {
    if (req.parsing) {
      req.parsing.endSpan()
    }

    if (req.validation) {
      req.validation.endSpan()
    }

    if (req.handler) {
      req.handler.endSpan()
    }

    if (req.serialization) {
      req.serialization.endSpan()
    }

    if (req.isRealSpan) {
      req.onError = req.rootSpan.createChildSpan({ name: 'onError' })
    }
    done()
  })

  fastify.addHook('onSend', (req, reply, payload, done) => {
    if (req.onError) {
      req.onError.endSpan()
    }

    if (req.serialization) {
      req.serialization.endSpan()
    }

    if (req.isRealSpan) {
      req.onSend = req.rootSpan.createChildSpan({ name: 'onSend' })
    }
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    if (req.onSend) {
      req.onSend.endSpan()
    }

    if (req.isRealSpan) {
      req.rootSpan.endSpan()
    }
    done()
  })

  next()
}

module.exports = fp(plugin, {
  fastify: '>= 1.0.0',
  name: 'fastify-gcloud-trace'
})
