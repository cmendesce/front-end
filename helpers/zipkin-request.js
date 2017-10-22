var CLSContext = require('zipkin-context-cls');
var {recorder} = require("./recorder");
var ctxImpl = new CLSContext("zipkin");
const fetch = require("node-fetch");
const {Tracer} = require('zipkin');
const wrapFetch = require('zipkin-instrumentation-fetch');

const tracer = new Tracer({ctxImpl, recorder});
module.exports = wrapFetch(fetch, {tracer, remoteServiceName: 'front-end'});
