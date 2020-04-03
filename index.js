const get = require('lodash.get');

export default gtrace = trace => (fastify, options, done) => {
  const isMonitoringEnabled = trace;

  fastify.addHook('onRequest', (req, reply, done) => {
    if (isMonitoringEnabled) {
      trace.runInRootSpan(
        {
          name: get(req.raw, 'client.parser.incoming.originalUrl', 'URL Undetected Request'),
        },
        span => {
          req.rootSpan = span;
          req.onRequestSpan = req.rootSpan.createChildSpan({name: 'onRequest'});
          done();
        },
      );
    } else {
      done();
    }
  });

  fastify.addHook('preHandler', (req, reply, done) => {
    if (req.onRequestSpan) {
      req.onRequestSpan.endSpan();
    }

    if (req.rootSpan) {
      req.onPreHandlerSpan = req.rootSpan.createChildSpan({name: 'preHandler'});
    }
    done();
  });

  fastify.addHook('preValidation', (req, reply, done) => {
    if (req.onPreHandlerSpan) {
      req.onPreHandlerSpan.endSpan();
    }

    if (req.rootSpan) {
      req.preValidation = req.rootSpan.createChildSpan({name: 'preValidation'});
    }
    done();
  });

  fastify.addHook('preSerialization', (req, reply, payload, done) => {
    if (req.preValidation) {
      req.preValidation.endSpan();
    }

    if (req.rootSpan) {
      req.preSerialization = req.rootSpan.createChildSpan({name: 'preSerialization'});
    }
    done();
  });

  fastify.addHook('onError', (req, reply, error, done) => {
    if (req.preSerialization) {
      req.preSerialization.endSpan();
    }

    if (req.rootSpan) {
      req.onError = req.rootSpan.createChildSpan({name: 'onError'});
    }
    done();
  });

  fastify.addHook('onSend', (req, reply, payload, done) => {
    if (req.onError) {
      req.onError.endSpan();
    }

    if (req.rootSpan) {
      req.onSend = req.rootSpan.createChildSpan({name: 'onSend'});
    }
    done();
  });

  fastify.addHook('onResponse', (req, reply, done) => {
    if (req.onSend) {
      req.onSend.endSpan();
    }

    if (req.rootSpan) {
      req.rootSpan.endSpan();
    }
    done();
  });

  done();
};
