/* eslint-env browser */
var {BatchRecorder} = require('zipkin');
var {HttpLogger} = require('zipkin-transport-http');

// Send spans to Zipkin asynchronously over HTTP
var zipkinBaseUrl = process.env.ZIPKIN;
var recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: `${zipkinBaseUrl}/api/v1/spans`
  })
});

module.exports.recorder = recorder;