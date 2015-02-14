var events = require('events');
var assert = require('assert');
var vows   = require('vows');
var fc     = require('../lib/fileCache');
var util   = require('util');
var config = require('../test-site/config.js');
var render = require('../lib/renderer2');
var akasha = require('../index');
akasha.config(config);
// render.config(config);

// var process = require('process');

process.on('uncaughtException', function(err) {
console.log('Caught exception: ' + err.stack);
});

vows.describe("renderer").addBatch({
  "render index.html.md": {
      topic: function() {
      	var that = this;
      	var emitter = new(events.EventEmitter);
      	fc.readDocument(config, "index.html.md", function(err, docEntry) {
      		if (err) emitter.emit('error', err);
        	else render.render(akasha, config, docEntry, undefined, 
				docEntry.frontmatter.yaml,
				function(err2, rendered) {
					if (err2) emitter.emit('error', err2);
					else {
						// console.log(util.inspect(rendered));
						emitter.emit('success', rendered);
					}
				});
        });
        return emitter;
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
          // console.log(topic.content);
          // console.log('locBefore='+ locBefore +' locContent='+ locContent +' locAfter='+ locAfter);
          assert.isTrue(locBefore < locContent && locContent < locAfter);
      },
      "mahabhuta rendered title": function(topic) {
          assert.isTrue(topic.content.indexOf("<title>Index</title>") >= 0);
      },
      "partial rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Salut from partial=hello.html.ejs") >= 0);
      }
  },
  "render list.html.ejs.md": {
      topic: function() {
      	var that = this;
      	var emitter = new(events.EventEmitter);
      	fc.readDocument(config, "list.html.ejs.md", function(err, docEntry) {
      		if (err) emitter.emit('error', err);
        	else render.render(akasha, config, docEntry, undefined,
				docEntry.frontmatter.yaml,
				function(err2, rendered) {
					if (err2) emitter.emit('error', err2);
					else {
						// console.log(util.inspect(rendered));
						emitter.emit('success', rendered);
					}
				});
        });
        return emitter;
        //  render.render(akasha, config, undefined,
        //                "list.html.md.ejs", {}, undefined,
        //                this.callback);
      },
      /*"show": function(topic) {
          util.log(util.inspect(topic));
      },*/
      "fname": function(topic) {
          assert.equal(topic.fname, "list.html.ejs");
      },
      "ext": function(topic) {
          assert.equal(topic.ext, "md");
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
  "render youtube.html.md": {
      topic: function() {
      	var that = this;
      	var emitter = new(events.EventEmitter);
      	fc.readDocument(config, "youtube.html.md", function(err, docEntry) {
      		if (err) emitter.emit('error', err);
        	else {
        		render.render(akasha, config, docEntry, undefined,
        			docEntry.frontmatter.yaml,
        			function(err2, rendered) {
        				if (err2) emitter.emit('error', err2);
        				else {
							// console.log(util.inspect(rendered));
							emitter.emit('success', rendered);
						}
        			});
        	}
        });
        return emitter;
      },
      /*"show": function(topic) {
          util.log(util.inspect(topic));
      },*/
      "fname": function(topic) {
          assert.equal(topic.fname, "youtube.html");
      },
      "ext": function(topic) {
          assert.equal(topic.ext, "md");
      },
      "mahabhuta rendered title": function(topic) {
          assert.isTrue(topic.content.indexOf("<title>Youtube</title>") >= 0);
      },
      "partial rendered": function(topic) {
          assert.isTrue(topic.content.indexOf("Salut from partial=hello.html.ejs") >= 0);
      },
      "rendered youtube": function(topic) {
          assert.isTrue(topic.content.indexOf("wonderingmind42") >= 0);
      }
  }
}).export(module);
