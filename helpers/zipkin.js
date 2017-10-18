var CLSContext = require('zipkin-context-cls');
var {Tracer} = require('zipkin');
var {restInterceptor} = require('zipkin-instrumentation-cujojs-rest');
var {recorder} = require('./recorder');

var ctxImpl = new CLSContext('zipkin');
var tracer = new Tracer({ctxImpl, recorder});

module.exports = {
  restInterceptor, tracer, serviceName: 'front-end'
}
