var assert = require('assert');
var vows   = require('vows');
var find   = require('../lib/find');
var util   = require('util');
var config = require('../test-site/config.js');

vows.describe("find").addBatch({
    "find index": {
        topic: find.document("index.html.md"),
        /*"show": function(topic) {
          util.log(util.inspect(topic));
        }, */
        "right path": function(topic) {
            assert.equal(topic.path, "index.html.md");
        },
        "right fullpath": function(topic) {
            assert.isTrue(topic.fullpath.indexOf('index.html.md') >= 0);
        }
    }
}).export(module);