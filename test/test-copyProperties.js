
var assert = require('assert');
var vows   = require('vows');
var render = require('../lib/renderer2');

var config = require('../test-site/config.js');
var akasha = require('../test-site/fake-akasha');
akasha.config(config);

vows.describe("copyProperties").addBatch({
    "check null object": {
        topic: render.copyProperties({ val1: "val1", val2: "val2", something: "different" }, null),
        "has val1": function(topic) { assert.equal(topic.val1, "val1"); },
        "has val2": function(topic) { assert.equal(topic.val2, "val2"); },
        "has something different": function(topic) { assert.equal(topic.something, "different"); }
    },
    "check nothing changes on empty object": {
        topic: render.copyProperties({ val1: "val1" }, {}),
        "has val1": function(topic) { assert.equal(topic.val1, "val1"); },
        "has nothing else": function(topic) {
            for (var prop in topic) {
                assert.equal (prop, "val1");
            }
        }
    }
}).export(module);