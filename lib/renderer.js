
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
var markdown = require("markdown").markdown;
var less = require('less');
var oembed = require('oembed');
var gf   = require('./gatherfiles');

var root_layouts = undefined;
module.exports.setRootLayouts = function(dir) { root_layouts = dir; }

/**
 * Find a template file whether it's directly specified, or whether its in the layout directory
 **/
var findtemplate = function(tmplName) {
    // Does the file match on its own?
    var stat = fs.existsSync(tmplName) ? fs.statSync(tmplName) : undefined;
    if (stat) {
        return tmplName;
    }
    // Is it in the layouts directory?
    stat = fs.existsSync(root_layouts +"/"+ tmplName) ? fs.statSync(root_layouts +"/"+ tmplName) : undefined;
    if (stat) {
        return root_layouts +"/"+ tmplName;
    }
    return undefined;
}

var root_partials = undefined;
module.exports.setRootPartials = function(dir) { root_partials = dir; }

/**
 * Find a partial/template file whether it's directly specified, or whether its in the layout directory
 **/
var findpartial = function(tmplName) {
    // Does the file match on its own?
    var stat = fs.existsSync(tmplName) ? fs.statSync(tmplName) : undefined;
    if (stat) {
        return tmplName;
    }
    // Is it in the layouts directory?
    stat = fs.existsSync(root_partials +"/"+ tmplName) ? fs.statSync(root_partials +"/"+ tmplName) : undefined;
    if (stat) {
        return root_partials +"/"+ tmplName;
    }
    return undefined;
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

/**
 * Handle the partial function, supporting small snippet templates rather than full page templates
 **/
var partial = module.exports.partial = function(name, locals, callback) {
    // util.log('about to render ' + util.inspect(name) + ' with ' + util.inspect(locals));
    var fnamePartial = findpartial(name);
    if (fnamePartial.match(/\.kernel$/)) {
        partialKernel(fnamePartial, locals, callback);
    } else if (fnamePartial.match(/\.html\.ejs$/)
            || fnamePartial.match(/\.html\.md$/)) {
        var rendered = partialSync(fnamePartial, locals, callback);
        return rendered;
    } else if (fnamePartial.match(/\.html$/)) {
        // Allow for straight HTML partials
        var rendered = partialHtml(fnamePartial, locals, callback);
        return rendered;
    } else {
        callback('UNKOWN Template Engine for partial ' + fnamePartial);
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
    var fnamePartial = findpartial(name);
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
    else if (fnext === 'md')  rendered = markdown.toHTML(text);
    else { done('UNKNOWN Synchronous Template Engine for ' + fileName); }
    return rendered;
}

var partialSync = module.exports.partialSync = function(fname, locals, done) {
    var fnamePartial = findpartial(fname);
    // util.log('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
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
            var fntmpl = findtemplate(layout);
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
        } else {
            done(undefined, {
                fname:   fname,
                ext:     fnext,
                content: data.content  
            });
        }
    }
    
    // util.log(util.inspect(data));
    
    if (fnext === 'ejs' || fnext === 'md') {
        
        data.partial = partial;
        data.oembed = undefined;
        
        data.content = renderSync(fileName, fnext, frontmatter.text, data, done);
        doRender(frontmatter.layout, data, fname, fnext, done);
        
    } else if (fnext === "kernel") {        
        data.partial = partial;
        data.oembed = function(arg, callback) {
            // util.log('oembed ' + util.inspect(arg));
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