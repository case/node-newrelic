'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , http   = require('http')
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("built-in http module instrumentation", function () {
  var agent
    , transaction
    , fetchedStatusCode
    , fetchedBody
    ;

  var PAYLOAD = JSON.stringify({msg : 'ok'});

  var PAGE = '<html>' +
             '<head><title>test response</title></head>' +
             '<body><p>I heard you like HTML.</p></body>' +
             '</html>';

  before(function (done) {
    agent = helper.instrumentMockedAgent();

    var external = http.createServer(function (request, response) {
      expect(agent.getTransaction()).not.equal(undefined);

      response.writeHead(200,
                         {'Content-Length' : PAYLOAD.length,
                          'Content-Type'   : 'application/json'});
      response.end(PAYLOAD);
    });

    var server = http.createServer(function (request, response) {
      expect(agent.getTransaction()).not.equal(undefined);

      var req = http.request({port : 8321,
                              host : 'localhost',
                              path : '/status',
                              method : 'GET'},
                             function (requestResponse) {
                               if (requestResponse.statusCode !== 200) {
                                 return done(requestResponse.statusCode);
                               }

                               expect(agent.getTransaction()).not.equal(undefined);
                               transaction = agent.getTransaction();

                               requestResponse.setEncoding('utf8');
                               requestResponse.on('data', function (data) {
                                 expect(data).equal(PAYLOAD);
                               });

                               response.writeHead(200,
                                                  {'Content-Length' : PAGE.length,
                                                   'Content-Type'   : 'text/html'});
                               response.end(PAGE);
                             });

      req.on('error', function (error) {
        return done(error);
      });

      req.end();
    });

    external.listen(8321, 'localhost', function () {
      server.listen(8123, 'localhost', function () {
        // The transaction doesn't get created until after the instrumented
        // server handler fires.
        expect(agent.getTransaction()).equal(undefined);

        fetchedBody = '';
        var req = http.request({port   : 8123,
                                host   : 'localhost',
                                path   : '/path',
                                method : 'GET'},
                               function (response) {
                                 if (response.statusCode !== 200) {
                                   return done(response.statusCode);
                                 }

                                 fetchedStatusCode = response.statusCode;

                                 response.setEncoding('utf8');
                                 response.on('data', function (data) {
                                   fetchedBody = fetchedBody + data;
                                 });

                                 response.on('end', function () {
                                   return done();
                                 });
                               });

        req.on('error', function (error) {
          return done(error);
        });

        req.end();
      });
    });
  });

  after(function () {
    helper.unloadAgent(agent);
  });

  it("should successfully fetch the page", function () {
    fetchedStatusCode.should.equal(200);

    should.exist(fetchedBody);
    fetchedBody.should.equal(PAGE);
  });

  it("should record unscoped path stats after a normal request", function () {
    var stats = agent.metrics.getOrCreateMetric('WebTransaction/Uri/path').stats;
    stats.callCount.should.equal(1);
  });

  it("should indicate that the http dispatcher is in play", function (done) {
    var found = false;

    agent.environment.toJSON().forEach(function (pair) {
      if (pair[0] === 'Dispatcher' && pair[1] === 'http') found = true;
    });

    return done(found ? null : new Error('failed to find Dispatcher configuration'));
  });

  it("should record unscoped HTTP dispatcher stats after a normal request", function () {
    var stats = agent.metrics.getOrCreateMetric('HttpDispatcher').stats;
    stats.callCount.should.equal(2);
  });

  it("should associate outbound HTTP requests with the inbound transaction", function () {
    expect(transaction.metrics.getOrCreateMetric('External/localhost/http', 'External/localhost/status').stats.callCount).equal(1);
  });

  it("should record outbound HTTP requests in the agent's metrics", function () {
    expect(agent.metrics.getOrCreateMetric('External/localhost/http', 'External/localhost/status').stats.callCount).equal(1);
  });

  it("shouldn't record transactions for requests for favicon.ico");
  it("should capture metrics for the last byte to exit / enter as part of a response / request");
});
