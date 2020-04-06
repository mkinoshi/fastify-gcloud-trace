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
  } catch {
    tracer = require('@google-cloud/trace-agent').get(traceApiOptions || {})
  }
  return tracer
}

function plugin (fastify, options, next) {
  const { traceApiOptions, tracePluginOptions = { enabled: true } } = options
  const trace = tracePluginOptions.enabled ? startTracer(traceApiOptions || {}) : null

  fastify.decorateRequest('rootSpan', '')
  fastify.addHook('onRequest', (req, reply, done) => {
    if (trace) {
      const rootSpanOption = buildRootOption(req, tracePluginOptions || {})
      if (isInvalidRootOption(rootSpanOption, reply)) {
        done()
        return
      }

      trace.runInRootSpan(rootSpanOption, span => {
        if (isRealSpan(span)) {
          req.rootSpan = span
          req.rootSpan.addLabel(labels.HTTP_METHOD_LABEL_KEY, rootSpanOption.method)
          req.rootSpan.addLabel(labels.HTTP_SOURCE_IP, req.ip)

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

    if (req.rootSpan) {
      req.parsing = req.rootSpan.createChildSpan({ name: 'Parsing' })
    }
    done()
  })

  fastify.addHook('preValidation', (req, reply, done) => {
    if (req.parsing) {
      req.parsing.endSpan()
    }

    if (req.rootSpan) {
      req.validation = req.rootSpan.createChildSpan({ name: 'Validation' })
    }
    done()
  })

  fastify.addHook('preHandler', (req, reply, done) => {
    if (req.validation) {
      req.validation.endSpan()
    }

    if (req.rootSpan) {
      req.handler = req.rootSpan.createChildSpan({ name: 'Handler' })
    }
    done()
  })

  fastify.addHook('preSerialization', (req, reply, payload, done) => {
    if (req.handler) {
      req.handler.endSpan()
    }

    if (req.rootSpan) {
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

    if (req.rootSpan) {
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

    if (req.rootSpan) {
      req.onSend = req.rootSpan.createChildSpan({ name: 'onSend' })
    }
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    if (req.onSend) {
      req.onSend.endSpan()
    }

    if (req.rootSpan) {
      req.rootSpan.addLabel(labels.HTTP_RESPONSE_CODE_LABEL_KEY, reply.statusCode) // It is used internally on Stackdriver, but does not show under label for some reason
      req.rootSpan.addLabel(customLabels.STATUS_CODE, reply.statusCode)
      req.rootSpan.endSpan()
    }
    done()
  })

  next()
}

module.exports = fp(plugin, {
  fastify: '>= 2.0.0',
  name: 'fastify-gcloud-trace'
})
