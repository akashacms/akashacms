var events = require('events');
var assert = require('assert');
var vows   = require('vows');
var util   = require('util');
var config = require('../test-site/config.js');
var akasha = require('../index');
akasha.config(config);


process.on('uncaughtException', function(err) {
console.log('Caught exception: ' + err.stack);
});

vows.describe("findPlugin").addBatch({
  "plugin akashacms-embeddables": {
      topic: akasha.plugin("akashacms-embeddables"),
      "found a plugin": function(topic) {
            assert.ok(topic);
      }
  },
  "BAD plugin": {
      topic: akasha.plugin("akashacms-xyzzy"),
      "should not find a plugin": function(topic) {
            assert.equal(topic, undefined);
      }
  }
}).export(module);