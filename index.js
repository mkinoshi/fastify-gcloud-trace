const fp = require('fastify-plugin')
const get = require('lodash.get')
const UNSAMPLED_ROOT = 'UNSAMPLED'

const labels = {
  HTTP_METHOD_LABEL_KEY: '/http/method',
  HTTP_RESPONSE_CODE_LABEL_KEY: '/http/status_code',
  HTTP_SOURCE_IP: '/http/source/ip'
}

const customLabels = {
  STATUS_CODE: 'status_code'
}

function isRealSpan (span) {
  return get(span, 'type', UNSAMPLED_ROOT) !== UNSAMPLED_ROOT
}

function buildRootOption (req, tracePluginOptions) {
  const urlForHttp = get(req.raw, 'client.parser.incoming.originalUrl', null)
  const urlForHttp2 = get(req.headers, ':path', null)
  const url = urlForHttp || urlForHttp2
  const methodForHttp = get(req.raw, 'client.parser.incoming.method', null)
  const methodForHttp2 = get(req.headers, ':method', null)
  const method = methodForHttp || methodForHttp2

  return {
    name: tracePluginOptions.nameOverride ? tracePluginOptions.nameOverride(req) : url,
    url,
    method
  }
}

function isInvalidRootOption (options, reply) {
  if (!options.url || typeof options.url !== 'string') {
    reply.log.error('The url that is passed to rootSpanOption is not string')
    return true
  }

  if (!options.method || typeof options.method !== 'string') {
    reply.log.error('The method that is passed to rootSpanOption is not string')
    return true
  }

  return false
}

function startTracer (traceApiOptions) {
  let tracer
  try {
    tracer = require('@google-cloud/trace-agent').start(traceApiOptions || {})
  } catch (e) {
    tracer = require('@google-cloud/trace-agent').get(traceApiOptions || {})
  }
  return tracer
}

function initializeGtrace () {
  return {
    rootSpan: null,
    onRequestSpan: null,
    parsingSpan: null,
    validationSpan: null,
    handlerSpan: null,
    serializationSpan: null,
    onErrorSpan: null,
    onSendSpan: null
  }
}

function plugin (fastify, options, next) {
  const { traceApiOptions, tracePluginOptions = { enabled: true } } = options
  const trace = tracePluginOptions.enabled ? startTracer(traceApiOptions || {}) : null

  const gtrace = initializeGtrace()
  fastify.decorateRequest('gtrace', gtrace)
  fastify.addHook('onRequest', (req, reply, done) => {
    if (trace) {
      const rootSpanOption = buildRootOption(req, tracePluginOptions || {})
      if (isInvalidRootOption(rootSpanOption, reply)) {
        done()
        return
      }

      trace.runInRootSpan(rootSpanOption, span => {
        if (isRealSpan(span)) {
          req.gtrace.rootSpan = span
          req.gtrace.rootSpan.addLabel(labels.HTTP_METHOD_LABEL_KEY, rootSpanOption.method)
          req.gtrace.rootSpan.addLabel(labels.HTTP_SOURCE_IP, req.ip)

          req.gtrace.onRequestSpan = req.gtrace.rootSpan.createChildSpan({ name: 'onRequest' })
        }
        done()
      })
    } else {
      done()
    }
  })

  fastify.addHook('preParsing', (req, reply, done) => {
    if (req.gtrace.onRequestSpan) {
      req.gtrace.onRequestSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.parsingSpan = req.gtrace.rootSpan.createChildSpan({ name: 'Parsing' })
    }
    done()
  })

  fastify.addHook('preValidation', (req, reply, done) => {
    if (req.gtrace.parsingSpan) {
      req.gtrace.parsingSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.validationSpan = req.gtrace.rootSpan.createChildSpan({ name: 'Validation' })
    }
    done()
  })

  fastify.addHook('preHandler', (req, reply, done) => {
    if (req.gtrace.validationSpan) {
      req.gtrace.validationSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.handlerSpan = req.gtrace.rootSpan.createChildSpan({ name: 'Handler' })
    }
    done()
  })

  fastify.addHook('preSerialization', (req, reply, payload, done) => {
    if (req.gtrace.handlerSpan) {
      req.gtrace.handlerSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.serializationSpan = req.gtrace.rootSpan.createChildSpan({ name: 'Serialization' })
    }
    done()
  })

  fastify.addHook('onError', (req, reply, error, done) => {
    if (req.gtrace.parsingSpan) {
      req.gtrace.parsingSpan.endSpan()
    }

    if (req.gtrace.validationSpan) {
      req.gtrace.validationSpan.endSpan()
    }

    if (req.gtrace.handlerSpan) {
      req.gtrace.handlerSpan.endSpan()
    }

    if (req.gtrace.serializationSpan) {
      req.gtrace.serializationSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.onErrorSpan = req.gtrace.rootSpan.createChildSpan({ name: 'onError' })
    }
    done()
  })

  fastify.addHook('onSend', (req, reply, payload, done) => {
    if (req.gtrace.onErrorSpan) {
      req.gtrace.onErrorSpan.endSpan()
    }

    if (req.gtrace.serializationSpan) {
      req.gtrace.serializationSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.onSendSpan = req.gtrace.rootSpan.createChildSpan({ name: 'onSend' })
    }
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    if (req.gtrace.onSendSpan) {
      req.gtrace.onSendSpan.endSpan()
    }

    if (req.gtrace.rootSpan) {
      req.gtrace.rootSpan.addLabel(labels.HTTP_RESPONSE_CODE_LABEL_KEY, reply.statusCode) // It is used internally on Stackdriver, but does not show under label for some reason
      req.gtrace.rootSpan.addLabel(customLabels.STATUS_CODE, reply.statusCode)
      req.gtrace.rootSpan.endSpan()
    }
    done()
  })

  next()
}

module.exports = fp(plugin, {
  fastify: '>= 2.0.0',
  name: 'fastify-gcloud-trace'
})
