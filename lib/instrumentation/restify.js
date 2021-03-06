'use strict';

var http    = require('http')
  , path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, restify) {
  // hook the createServer method to record the framework
  shimmer.wrapMethod(restify, 'restify', 'createServer', function (original) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('restify');
      agent.environment.setFramework('restify');

      return original.apply(this, arguments);
    };
  });
};
