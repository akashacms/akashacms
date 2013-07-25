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
var K    = require('kernel');
//var markdown = require("markdown").markdown;
var marked = require('marked');
var less = require('less');
var oembed = require('oembed');
var gf   = require('./gatherfiles');
var find = require('./find');

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

var fms = {};

var readFile = function(fileName) {
    if (fms.hasOwnProperty(fileName)) {
        return fms[fileName];
    }
    // util.log('readFile ' + fileName);
    var text = fs.readFileSync(fileName, 'utf8');
    fms[fileName] = gf.extractFrontmatter(text);
    return fms[fileName];
}

K.resourceLoader = function(fileName, callback) {
    // util.log('resourceLoader ' + fileName);
    var frontmatter = readFile(fileName);
    // util.log('resourceLoader ' + fileName + ' template=' + frontmatter.text);
    callback(null, frontmatter.text);
}

/**
 * Test whether a file name will be giving an HTML result
 **/
var supportedForHtml = module.exports.supportedForHtml = function(fn) {
    if (fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/) || fn.match(/\.html\.kernel$/))
        return true;
    else
        return false;
}

module.exports.renderedFileName = function(fileName) {
    if (supportedForHtml(fileName) || fileName.match(/\.css\.less$/)) {
        var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
        return fnparts[1];
    } else {
        return fileName
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
      else throw err;
    }
    if (fnamePartial.match(/\.kernel$/)) {
        if (typeof cb === "undefined") throw "Must provide a callback for " + util.inspect(fname) +' typeof='+ (typeof fname) +' locals='+ util.inspect(localdata) +' callback='+ util.inspect(cb);
        partialKernel(fnamePartial, localdata, cb);
    } else if (fnamePartial.match(/\.html\.ejs$/)
            || fnamePartial.match(/\.html\.md$/)) {
        var rendered = partialSync(options, fnamePartial, localdata, cb);
        return rendered;
    } else if (fnamePartial.match(/\.html$/)) {
        // Allow for straight HTML partials
        var rendered = partialHtml(fnamePartial, localdata, cb);
        return rendered;
    } else {
        cb('UNKOWN Template Engine for partial ' + fnamePartial);
    }
    return undefined;
}

var partialHtml = function(name, locals, callback) {
    var frontmatter = readFile(name);
    if (callback) callback(null, frontmatter.text);
    return frontmatter.text;
}

var partialKernel = function(name, locals, callback) {
    // util.log('partialKernel ' + name);
    var fnamePartial = find.partial(options, name);
    if (fnamePartial == undefined) done('NO FILE FOUND FOR PARTIAL 2 ' + util.inspect(name));
    K(fnamePartial, function (err, template) {
        if (err) {
            // util.log('partial error ' + err);
            callback(err);
        } else {
            // util.log('rendering ' + fnamePartial + ' with ' + util.inspect(locals));
            template(locals, callback);
        }
    });
}

var renderSync = function(fileName, fnext, text, data, done) {
    var rendered = undefined;
    if (fnext === 'ejs') rendered = ejs.render(text, data);
    else if (fnext === 'md')  rendered = marked(text); // rendered = markdown.toHTML(text);
    else { done('UNKNOWN Synchronous Template Engine for ' + fileName); }
    return rendered;
}

var partialSync = module.exports.partialSync = function(theoptions, fname, locals, done) {
    // util.log(util.inspect(options));
    var fnamePartial = find.partial(theoptions, fname);
    // util.log('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial == undefined) done('NO FILE FOUND FOR PARTIAL 3 ' + util.inspect(fname));
    var frontmatter = readFile(fnamePartial);
    var fnparts = /(.*)\.([^\.]+)$/.exec(fname);
    // var fnamebase = fnparts[1];
    var fnext = fnparts[2];
    var rendered = renderSync(fnamePartial, fnext, frontmatter.text, locals, done);
    // util.log('partialSync resulted in ' + util.inspect(rendered));
    if (done) done(null, rendered);
    return rendered;
}

var render = module.exports.render = function(fileName, data, done) {
    util.log('render: ' + fileName);
    var frontmatter = readFile(fileName);
    
    if (!data.fnameRelative) {
      data.fnameRelative = fileName.substr(fileName.indexOf('/')+1);
    }
    
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    
    // util.log('fname='+ fname +' fnext='+ fnext);
    // util.log(util.inspect(frontmatter));
    
    if (! data.rendered_url) {
        var ind = fname.indexOf('/');
        data.rendered_url = data.root_url +"/"+ fname.substr(ind+1);
    }
    
    for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
    }
    data.layout = undefined;
    var rendered = undefined;
    
    var doRender = function(layout, data, fname, fnext, done) {
        if (layout) {
            var fntmpl = find.template(options, layout);
            if (! fntmpl) {
                done("TEMPLATE NOT FOUND " + layout);
            } else {
                render(fntmpl, data, function(err, data) {
                    if (err) done(err);
                    else {
                        done(err, {
                            fname:   fname,
                            ext:     fnext,
                            content: data.content
                        });
                    }
                });
            }
        } else {
            done(undefined, {
                fname:   fname,
                ext:     fnext,
                content: data.content  
            });
        }
    }
    
    if (fnext === 'ejs' || fnext === 'md') {
        
        data.partial = partial;
        data.oembed = undefined;
        
        data.content = renderSync(fileName, fnext, frontmatter.text, data, done);
        doRender(frontmatter.layout, data, fname, fnext, done);
        
    } else if (fnext === "kernel") {
        data.partial = function(arg, callback) {
            if (!arg.template) { util.log(util.inspect(arg)); throw "Must provide a partial/template render on"; }
            if (typeof callback === "undefined") throw "Must provide a callback";
            partial(arg.template, arg.data, callback);
        };
        data.oembed = function(arg, callback) {
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
        K(fileName, function(err, template) {
            if (err) done(err);
            else {
                template(data, function(err, html) {
                    if (err) done(err);
                    else {
                        data.content = html;
                        doRender(frontmatter.layout, data, fname, fnext, done);
                    }
                });
            }
        });
    }
    else { done('UNKNOWN Template Engine for ' + fileName); }
}

var renderLess = module.exports.renderLess = function(fileName, done) {
    util.log('renderLess: ' + fileName);
    var lesstxt = fs.readFileSync(fileName, 'utf8');
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

