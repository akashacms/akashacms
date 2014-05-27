var assert = require('assert');
var vows   = require('vows');
var fc     = require('../lib/fileCache');
var util   = require('util');
var config = require('../test-site/config.js');
var render = require('../lib/renderer2');
var akasha = require('../index');
akasha.config(config);
render.config(config);

vows.describe("renderer").addBatch({
  "render index.html.md": {
      topic: function() {
          render.render(config, undefined, "index.html.md", {}, undefined, this.callback);
      },
      /*"show": function(topic) {
          util.log(util.inspect(topic));
      },*/
      "fname": function(topic) {
          assert.equal(topic.fname, "index.html");
      },
      "ext": function(topic) {
          assert.equal(topic.ext, "md");
      },
      "content rendered": function(topic) {
          var locBefore  = topic.content.indexOf("Ahead of the content");
          var locContent = topic.content.indexOf("This is the index of test-site");
          var locAfter   = topic.content.indexOf("After the content");
          assert.isTrue(locBefore < locContent && locContent < locAfter);
      },
      "mahabhuta rendered title": function(topic) {
          assert.isTrue(topic.content.indexOf("<title>Index</title>") >= 0);
      },
      "partial rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Salut from partial=hello.html.ejs") >= 0);
      }
  },
  "render list.html.md.ejs": {
      topic: function() {
          render.render(config, undefined, "list.html.md.ejs", {}, undefined, this.callback);
      },
      /*"show": function(topic) {
          util.log(util.inspect(topic));
      },*/
      "fname": function(topic) {
          assert.equal(topic.fname, "list.html");
      },
      "ext": function(topic) {
          assert.equal(topic.ext, "ejs");
      },
      "content rendered": function(topic) {
          var locItem1 = topic.content.indexOf("Item 1");
          var locItem2 = topic.content.indexOf("Item 2");
          var locItem3 = topic.content.indexOf("Item 3");
          assert.isTrue(locItem1 < locItem2 && locItem2 < locItem3);
      },
      "ejs rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Foo bar") >= 0);
      },
      "mahabhuta rendered title": function(topic) {
          assert.isTrue(topic.content.indexOf("<title>List</title>") >= 0);
      },
      "partial rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Salut from partial=hello.html.ejs") >= 0);
      }
  },
  "render youtube.html.md.kernel": {
      topic: function() {
          render.render(config, undefined, "youtube.html.md.kernel", {}, undefined, this.callback);
      },
      /*"show": function(topic) {
          util.log(util.inspect(topic));
      },*/
      "fname": function(topic) {
          assert.equal(topic.fname, "youtube.html");
      },
      "ext": function(topic) {
          assert.equal(topic.ext, "kernel");
      },
      "mahabhuta rendered title": function(topic) {
          assert.isTrue(topic.content.indexOf("<title>Youtube</title>") >= 0);
      },
      "partial rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Salut from partial=hello.html.ejs") >= 0);
      },
      "oembed rendered youtube": function(topic) {
          assert.isTrue(topic.content.indexOf("wonderingmind42") >= 0);
      }
  }
}).export(module);
