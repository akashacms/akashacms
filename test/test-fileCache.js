var assert = require('assert');
var vows   = require('vows');
var fc     = require('../lib/fileCache');
var util   = require('util');

var config = require('../test-site/config.js');
var akasha = require('../test-site/fake-akasha');
akasha.config(config);

vows.describe("fileCache").addBatch({
  "fc index.html": {
      topic: function() {
      	fc.readDocument("index.html.md", this.callback);
      },
      "type document": function(topic) {
          assert.equal(topic.type, "document");
      },
      "not directory": function(topic) {
          assert.isFalse(topic.isdir);
      },
      "frontmatter foobar": function(topic) {
          assert.equal(topic.frontmatter.yaml["foo"], "bar");
      },
      "body text": function(topic) {
          assert.isTrue(topic.data.indexOf("index of test-site") >= 0)
      }
  }
}).export(module);