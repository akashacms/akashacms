/**
 *
 * Copyright 2012 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var fs   = require('fs');
var ejs  = require('ejs');
var util = require('util');
var path = require('path');
var K    = require('kernel');
//var markdown = require("markdown").markdown;
var marked = require('marked');
var less = require('less');
var oembed = require('oembed');
var fileCache = require('./fileCache');
var find = require('./find');
// var MultiMarkdown = require("multimarkdown");

marked.setOptions({
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  /*highlight: function(code, lang) {
    if (lang === 'js') {
      return highlighter.javascript(code);
    }
    return code;
  }*/
});

var options = undefined;
module.exports.config = function(theoptions) {
  // util.log('renderer config ' + util.inspect(theoptions));
  options = theoptions;
}

///////// Extra support for Kernel template engine
///////// The purpose is to support frontmatter

K.resourceLoader = function(fileNameObj, callback) {
    var fileName = undefined;
    var fileType = undefined;
    var fnparts = fileNameObj.match(/([a-zA-Z]+):(.*)$/);
    fileType = fnparts[1];
    fileName = fnparts[2];
    var entry = undefined;
    if (fileType === "partial")
        entry = fileCache.readPartial(options, fileName);
    else if (fileType === "template")
        entry = fileCache.readTemplate(options, fileName);
    else 
        entry = fileCache.readDocument(options, fileName);
    util.log('resourceLoader '+ entry.path +' '+ entry.fullpath);
    if (entry) {
      callback(null, entry.frontmatter.text);
    } else {
      callback(new Error("No file entry found for "+ util.inspect(fileNameObj)));
    }
}



/**
 * Handle the partial function, supporting small snippet templates rather than full page templates
 **/
var partial = module.exports.partial = function(name, locals, callback) {
    // util.log('about to render ' + util.inspect(name) + ' with ' + util.inspect(locals));
    var arg = undefined;
    var fname = name;
    var localdata = locals;
    var cb = callback;
    if (typeof name === "Object" || typeof name === "object") {
        arg = name;
        fname = arg.template;
        cb = locals;
        localdata = arg.data;
    }
    var fnamePartial = find.partial(options, fname);
    if (fnamePartial == undefined) {
      var err = 'NO FILE FOUND FOR PARTIAL 1 ' + util.inspect(name);
      if (cb) return cb(err);
      else throw new Error(err);
    }
    if (fileCache.isASyncHtml(fnamePartial) || fileCache.isASyncPHP(fnamePartial)) {
        if (typeof cb === "undefined") throw "Must provide a callback for " + util.inspect(fname) +' typeof='+ (typeof fname) +' locals='+ util.inspect(localdata) +' callback='+ util.inspect(cb);
        partialKernel(fnamePartial, localdata, cb);
    } else if (fileCache.isSyncHtml(fnamePartial) || fileCache.isSyncPHP(fnamePartial)) {
        var rendered = partialSync(options, fnamePartial, localdata, cb);
        return rendered;
    } else if (fileCache.isHtml(fnamePartial)) {
        // Allow for straight HTML partials
        var rendered = partialHtml(fnamePartial, localdata, cb);
        return rendered;
    } else {
        cb('UNKOWN Template Engine for partial ' + fnamePartial);
    }
    return undefined;
}

var partialHtml = function(name, locals, callback) {
    var text = fs.readFileSync(name, 'utf8');
    if (callback) callback(null, text);
    return text;
}

var partialKernel = function(name, locals, callback) {
    // util.log('partialKernel ' + name);
    // var fnamePartial = find.partial(options, name);
    // if (fnamePartial == undefined) done('NO FILE FOUND FOR PARTIAL 2 ' + util.inspect(name));
    K("partial:"+ name, function (err, template) {
        if (err) {
            // util.log('partial error ' + err);
            callback(err);
        } else {
            // util.log('rendering ' + fnamePartial + ' with ' + util.inspect(locals));
            template(locals, callback);
        }
    });
}

var renderSync = function(fileName, text, data, done) {
    var rendered = undefined;
    // util.log('renderSync '+ fileName +' '+ util.inspect(data));
    if (fileName.match(/\.ejs$/)) rendered = ejs.render(text, data);
    // else if (fileName.match(/\.md$/)) rendered = MultiMarkdown.convert(text);
    else if (fileName.match(/\.md$/)) rendered = marked(text); // rendered = markdown.toHTML(text);
    // else if (fileName.match(/\.html$/)) rendered = text;
    else { throw new Error('UNKNOWN Synchronous Template Engine for ' + fileName); }
    return rendered;
}

var partialSync = module.exports.partialSync = function(theoptions, fname, locals, done) {
    // util.log(util.inspect(options));
    var fnamePartial = find.partial(theoptions, fname);
    // util.log('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial == undefined) throw new Error('NO FILE FOUND FOR PARTIAL 3 ' + util.inspect(fname));
    var text = fs.readFileSync(fnamePartial, 'utf8');
    var rendered = renderSync(fnamePartial, text, locals, done);
    // util.log('partialSync resulted in ' + util.inspect(rendered));
    if (done) done(null, rendered);
    return rendered;
}

var oembedRender = module.exports.oembedRender = function(arg, callback) {
    // util.log('oembed ' + util.inspect(arg));
    if (!arg.template) throw "Must provide a partial/template render on";
    if (!arg.url)      throw "Must provide a URL to retrieve";
    oembed.fetch(arg.url, { maxwidth: 6000 }, function(err, result) {
        if (err) {
            throw err;
        } else {
            // util.log('retrieved oembed.. ' + util.inspect(result) + ' for url ' + arg.url);
            partial(arg.template, result, function(err, data) {
                // util.log(util.inspect(err));
                // util.log(util.inspect(data));
                callback(err, data);
            });
        }
    });
};

var render = module.exports.render = function(options, fileName, data, done) {
    // util.log(util.inspect(options));
    var docEntry = fileCache.readDocument(options, fileName);
    util.log('render: ' + fileName +' '+ docEntry.fullpath);
    // util.log(util.inspect(docEntry));
    var frontmatter = docEntry.frontmatter; // readFile(fileName);
    
    if (!data.documentPath) {
      data.documentPath = fileName; 
    }
    if (!data.publicationDate) {
      var dateSet = false;
      if (docEntry.frontmatter.publDate) {
	var parsed = Date.parse(docEntry.frontmatter.publDate);
	if (! isNan(parsed)) {
	  data.publicationDate = new Date(parsed);
	}
	dateSet = true;
      }
      if (! dateSet && docEntry.stat && docEntry.stat.mtime) {
        data.publicationDate = docEntry.stat.mtime;
      }
    }
    
    if (! data.rendered_url) {
        data.rendered_url = data.root_url +"/"+ docEntry.renderedFileName; // .substr(ind+1);
    }
    
    data.layout = undefined;
    var rendered = undefined;
    
    /* This might be useful, but is untested
     * The idea is for a template file to set metadata values
    var setRenderData = function(name, value) {
    	data[name] = value;
    }*/
    
    var copyProperties = function(data, frontmatter) {
      for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
      }
    }
    copyProperties(data, frontmatter);
    
    // util.log('renderer.render '+ fileName +' '+ util.inspect(data));
    
    var doPartialAsync = function(arg, callback) {
      if (!arg.template) { util.log(util.inspect(arg)); throw "Must provide a partial/template render on"; }
      if (typeof callback === "undefined") throw "Must provide a callback";
      partial(arg.template, arg.data, callback);
    }
    
    var doRenderAsync = function(entry, data, frontmatter, cb) {
        data.partial = doPartialAsync;
        data.oembed = oembedRender;
        // data.setRenderData = setRenderData;
        // util.log('doRenderAsync '+ util.inspect(data));
        K(entry.type+":"+entry.path, function(err, template) {
            if (err) done(err);
            else {
                template(data, function(err, html) {
                    if (err) cb(err);
                    else {
                        data.content = html;
                        if (entry.frontmatter.layout) {
                          // util.log('doRenderAsync rendering content to ' + entry.frontmatter.layout);
                            doRenderTemplate(entry.frontmatter.layout, data, cb);
                        } else {
                            cb(undefined, data);
                        }
                    }
                });
            }
        });
    }
    
    var doRenderTemplate = function(template, data, callback) {
        var templEntry = fileCache.readTemplate(options, template);
        // util.log('doRenderTemplate ' + template +' '+ templEntry.fullpath);
        var fntmplparts = /(.*)\.([^\.]+)$/.exec(template);
        var fntmplame = fntmplparts[1];
        var fntmplext = fntmplparts[2];
        copyProperties(data, templEntry.frontmatter);
        if (fileCache.isSyncHtml(template) || fileCache.isSyncPHP(template)) {
          // util.log('isSyncHtml template '+ template);
          data.partial = partial;
          data.oembed = undefined;
          // data.setRenderData = setRenderData;
          data.content = renderSync(template, templEntry.frontmatter.text, data, function(err, _data) {
            if (err) callback(err);
          });
          if (templEntry.frontmatter.layout) {
            // util.log('doRenderTemplate isSyncHtml rendering '+ template +' into '+ templEntry.frontmatter.layout);
            doRenderTemplate(templEntry.frontmatter.layout, data, callback);
          } else {
            // util.log('doRenderTemplate isSyncHtml final');
            callback(undefined, {
                fname:   fntmplame,
                ext:     fntmplext,
                content: data.content
            });
          }
        } else if (fileCache.isASyncHtml(template) || fileCache.isASyncPHP(template)) {
          // util.log('isASyncHtml template '+ template);
          doRenderAsync(fileCache.readTemplate(options, template), data, templEntry.frontmatter, function(err, _data) {
            if (templEntry.frontmatter.layout) {
              // util.log('doRenderTemplate isASyncHtml rendering '+ template +' into '+ templEntry.frontmatter.layout);
              doRenderTemplate(templEntry.frontmatter.layout, data, callback);
            } else {
              // util.log('doRenderTemplate isASyncHtml final');
              callback(undefined, {
                  fname:   fntmplame,
                  ext:     fntmplext,
                  content: data.content
              });
            }
          });
        } /*else if (fileCache.isHtml(template)) {
          callback(undefined, {
            fname:   fntmplame,
            ext:     fntmplext,
            content: templEntry.frontmatter.text
          });
        } */ else {
          done('UNKNOWN Template Engine for ' + template);
        }
    }
    
    if (fileCache.isSyncHtml(fileName) || fileCache.isSyncPHP(fileName)) {
        
        data.partial = partial;
        data.oembed = undefined;
        // data.setRenderData = setRenderData;
        
        data.content = renderSync(fileName, frontmatter.text, data, done);
        if (frontmatter.layout) {
          doRenderTemplate(frontmatter.layout, data, function(err, rendered) {
            if (err) done(err);
            else {
              // util.log('rendered sync file ' + docEntry.path +' with template '+ frontmatter.layout);
              done(undefined, {
                fname: docEntry.renderedFileName,
                ext: docEntry.fileExt,
                content: rendered.content
              });
            }
          });
        } else {
          // util.log('rendered sync file ' + docEntry.path);
          done(undefined, {
            fname:   docEntry.renderedFileName,
            ext:     docEntry.fileExt,
            content: data.content  
          });
        }
    } else if (fileCache.isASyncHtml(fileName) || fileCache.isASyncPHP(fileName)) {
        doRenderAsync(docEntry, data, frontmatter, function(err, _data) {
          if (err) done(err);
          else {
            done(undefined, {
              fname:   docEntry.renderedFileName,
              ext:     docEntry.fileExt,
              content: _data.content  
            });
          }
        });
    } /*else if (fileCache.isHtml(fileName)) {
      callback(undefined, {
        fname:   docEntry.renderedFileName,
        ext:     docEntry.fileExt,
        content: frontmatter.text
      });
    }*/
    else { done('UNKNOWN Template Engine for ' + fileName); }
}

var renderLess = module.exports.renderLess = function(fileName, done) {
    util.log('renderLess: ' + fileName);
    var lessEntry = fileCache.readDocument(options, fileName);
    var lesstxt = fs.readFileSync(lessEntry.fullpath, 'utf8');
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    var rendered = undefined;
    less.render(lesstxt, function (err, css) {
        if (err)
            done(err);
        else
            done(null, { fname: fname, fnext: fnext, css: css });
    });
}

