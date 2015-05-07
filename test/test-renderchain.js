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

vows.describe("findRenderChain").addBatch({
  "renderChain index.html.md": {
      topic: akasha.findRenderChain("index.html.md"),
      "found a renderChain": function(topic) {
            assert.ok(topic);
      },
      "found right pathName": function(topic) {
          assert.equal(topic.path, "index.html.md");
      },
      "found right renderedFileName": function(topic) {
          assert.equal(topic.renderedFileName, "index.html");
      },
      "found right extension": function(topic) {
          assert.equal(topic.extension, "md");
      },
  },
  "renderChain index.html.md.unknown": {
      topic: akasha.findRenderChain("index.html.md.unknown"),
      "did not find a renderChain": function(topic) {
            assert.equal(topic, undefined);
      },
  },
}).export(module);