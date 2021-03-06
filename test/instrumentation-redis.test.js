'use strict';

var path         = require('path')
  , net          = require('net')
  , EventEmitter = require('events').EventEmitter
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , sinon        = require('sinon')
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

function FakeConnection () {
  this.writable = true;
}

FakeConnection.prototype.on = function (event, callback) {
  if (event === 'connect') return callback();
  if (event === 'data') return this.on_data = callback;
};

FakeConnection.prototype.setNoDelay = function (bagel) {
  if (bagel !== false) this.bagel = true;
};

FakeConnection.prototype.setTimeout = function (timeout) {
  this.timeout = timeout;
};

FakeConnection.prototype.write = function (written) {
  console.error(written);
};

describe("agent instrumentation of Redis", function () {
  describe("for each operation", function () {
    it("should update the global aggregate statistics");
    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the scoped aggregate statistics for the operation type");
  });

  // Redis has a lot of commands, and this is not all of them.
  describe("should instrument", function () {
    var agent
      , client
      , connection
      , mockConnection
      ;

    beforeEach(function () {
      agent = helper.instrumentMockedAgent();
      var redis = require('redis');

      connection = new FakeConnection();
      mockConnection = sinon.mock(connection);
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\ninfo\r\n').once();

      client = new redis.RedisClient(connection);
      client.port = 8765;
      client.host = 'fakehost.example.local';
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("PING", function (done) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once();

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Redis/ping').stats;
        expect(stats.callCount).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();
        should.exist(transaction);

        client.PING(function (error, results) {
          if (error) return done(error);

          should.exist(agent.getTransaction());
          expect(results, "PING should still work").equal('PONG');
        });

        should.exist(connection.on_data);
        connection.on_data(new Buffer('$21\r\nredis_version:2.6.0\r\n'));
        connection.on_data(new Buffer('+PONG\r\n'));

        transaction.end();
      });
    });

    it("SET");
    it("HSET");
    it("MSET");
    it("SETNX");
    it("HSETNX");
    it("MSETNX");
    it("HMSET");
    it("GET");
    it("HGET");
    it("HGETALL");
    it("MGET");
    it("HMGET");
    it("DEL");
    it("HDEL");
    it("EXISTS");
    it("HEXISTS");
    it("EXPIRE");
    it("EXPIREAT");
    it("PUBLISH");
    it("SUBSCRIBE");
    it("UNSUBSCRIBE");
    it("SUNION");
    it("SUNIONSTORE");
    it("AUTH");
    it("PERSIST");
    it("BITCOUNT");
  });
});
