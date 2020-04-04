# fastify-gcloud-trace

Google Cloud Trace API Connector for Fastify

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/) [![Build Status](https://travis-ci.com/mkinoshi/fastify-gcloud-trace.svg?branch=master)](https://travis-ci.org/fastify/fastify-plugin)

`fastify-gcloud-trace` is a plugin that connects your application with Stackdriver Trace API for [Fastify](https://github.com/fastify/fastify). It is build on top of [Stackdriver Trace](https://github.com/googleapis/cloud-trace-nodejs) package, so you can configure Stackdriver Trace API by passing options to `traceApiOptions`.

This plugin measures how long each event takes in one request, and generates trace results. Here is an example trace result that you can find on Google Cloud Console:

![IMAGE](https://user-images.githubusercontent.com/10353744/78461526-240e8e00-76a0-11ea-81f6-08acae83ebef.png)

## Install

```js
npm i fastify-gcloud-trace --save
```

or

```js
yarn add fastify-gcloud-trace
```

## Usage

Register the plugin with your project in the following way and that's it!

```js
const fastify = require('fastify')();

// Please register this plugin at the beginning unless there is a specific reason not to.
fastify.register(
  require('fastify-gcloud-trace')({
    traceApiOptions: {
      // Pass options for Stackdriver Trace API
      ignoreMethods: ['OPTIONS'],
    },
  }),
);

fastify.listen(3000, err => {
  if (err) throw err;
});
```

This plugin attaches a Trace object to each request, and the object is accessible as `rootSpan` in a request object. Therefore, you can access the trace instance in your application code, and perform all functionalities defined in the Stackdriver Trace API. For example, you can create a childSpan in the following way. It is important to note that `rootSpan` is only defined when traceAPI generates a "traced" root span, so your application code has to handle the case where `rootSpan` is `null`. You can find the different types of span [here](https://googleapis.dev/nodejs/trace/latest/classes/UntracedRootSpanData.html).

```js
fastify.get('/foo', (req, reply) => {
  const span = req.rootSpan
    ? req.rootSpan.createChildSpan({name: 'Perform Heavy Calculation'})
    : null;
  // Do something
  if (span) {
    span.endSpan();
  }
  reply.send({hello: 'world'});
});
```

## Options

This is the list of available options.

- `traceApiOptions` - The options for the Trace API. The details are [here](https://googleapis.dev/nodejs/trace/latest/).
- `tracePluginOptions`:
  - `enabled` - If it is `true`, it generates a trace. The default value is `true`.
  - `nameOverride` - You can pass a function to overide a name for a trace. The function should take a [Request](https://www.fastify.io/docs/latest/Request/) as an argument.

## Limitations

It only supports StackDriver Trace API right now. If there is enough demand, I would also build support for [OpenCensus](https://opencensus.io/exporters/supported-exporters/node.js/) packages unless Google adds automatic support for Fasify.

## License Licensed under [MIT](./LICENSE).
