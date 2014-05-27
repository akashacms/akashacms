
var assert = require('assert');
var vows   = require('vows');
var render = require('../lib/renderer2');
var util   = require('util');

vows.describe("stripExtensions").addBatch({
  "no extensions": {
      topic: render.stripExtensions("no-file-extension"),
      "length eq 1": function(extensions) {
          assert.equal(extensions.length, 1);
      },
      "good value": function(extensions) {
          assert.equal(extensions[0], "no-file-extension");
      }
  },
  "one extension": {
      topic: render.stripExtensions("file.html"),
      "length eq 1": function(extensions) {
          assert.equal(extensions.length, 1);
      },
      "good value": function(extensions) {
          assert.equal(extensions[0], "file.html");
      }
  },
  "two extensions": {
      topic: render.stripExtensions("file.html.ejs"),
      "length eq 2": function(extensions) {
          assert.equal(extensions.length, 2);
      },
      "has ejs": function(extensions) {
          assert.equal(extensions[0], "ejs");
      },
      "has html": function(extensions) {
          assert.equal(extensions[1], "file.html");
      }
  },
  "three extensions": {
      topic: render.stripExtensions("file.html.ejs.md"),
      /*"show": function(extensions) {
        util.log(util.inspect(extensions));
      },*/
      "length eq 3": function(extensions) {
          assert.equal(extensions.length, 3);
      },
      "has md": function(extensions) {
          assert.equal(extensions[0], "md");
      },
      "has ejs": function(extensions) {
          assert.equal(extensions[1], "ejs");
      },
      "has html": function(extensions) {
          assert.equal(extensions[2], "file.html");
      }
  },
  "four extensions": {
      topic: render.stripExtensions("file.html.kernel.ejs.md"),
      /*"show": function(extensions) {
        util.log(util.inspect(extensions));
      },*/
      "length eq 4": function(extensions) {
          assert.equal(extensions.length, 4);
      },
      "has md": function(extensions) {
          assert.equal(extensions[0], "md");
      },
      "has ejs": function(extensions) {
          assert.equal(extensions[1], "ejs");
      },
      "has kernel": function(extensions) {
          assert.equal(extensions[2], "kernel");
      },
      "has html": function(extensions) {
          assert.equal(extensions[3], "file.html");
      }
  },
  "five mixed extensions": {
      topic: render.stripExtensions("file.html.md.kernel.ejs.md"),
      /*"show": function(extensions) {
        util.log(util.inspect(extensions));
      },*/
      "length eq 5": function(extensions) {
          assert.equal(extensions.length, 5);
      },
      "has md": function(extensions) {
          assert.equal(extensions[0], "md");
      },
      "has ejs": function(extensions) {
          assert.equal(extensions[1], "ejs");
      },
      "has kernel": function(extensions) {
          assert.equal(extensions[2], "kernel");
      },
      "has md again": function(extensions) {
          assert.equal(extensions[3], "md");
      },
      "has html": function(extensions) {
          assert.equal(extensions[4], "file.html");
      }
  }
}).export(module);