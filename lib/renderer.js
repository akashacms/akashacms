
/**
 *
 * Copyright 2012 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *   AkashaCMS is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   AkashaCMS is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with AkashaCMS.  If not, see <http://www.gnu.org/licenses/>.
 */

var fs   = require('fs');
var ejs  = require('ejs');
var util = require('util');
var K    = require('kernel');
var less = require('less');
var oembed = require('oembed');
var gf   = require('./gatherfiles');

var root_layouts = undefined;
module.exports.setRootLayouts = function(dir) { root_layouts = dir; }

var findtemplate = function(tmplName) {
    var stat = fs.existsSync(tmplName) ? fs.statSync(tmplName) : undefined;
    if (stat) {
        return tmplName;
    }
    stat = fs.existsSync(root_layouts +"/"+ tmplName) ? fs.statSync(root_layouts +"/"+ tmplName) : undefined;
    if (stat) {
        return root_layouts +"/"+ tmplName;
    }
    return undefined;
}

var root_partials = undefined;
module.exports.setRootPartials = function(dir) { root_partials = dir; }

var findpartial = function(tmplName) {
    var stat = fs.existsSync(tmplName) ? fs.statSync(tmplName) : undefined;
    if (stat) {
        return tmplName;
    }
    stat = fs.existsSync(root_partials +"/"+ tmplName) ? fs.statSync(root_partials +"/"+ tmplName) : undefined;
    if (stat) {
        return root_partials +"/"+ tmplName;
    }
    return undefined;
}



var fms = {};

var readFile = function(fileName) {
    if (fms.hasOwnProperty(fileName)) {
        return fms[fileName];
    }
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

var supportedForHtml = module.exports.supportedForHtml = function(fn) {
    if (fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/) || fn.match(/\.html\.kernel$/))
        return true;
    else
        return false;
}

var partial = module.exports.partial = function(name, locals, callback) {
    // util.log('about to render ' + util.inspect(name) + ' with ' + util.inspect(locals));
    var fnamePartial = findpartial(name);
    if (fnamePartial.match(/\.kernel$/)) {
        partialKernel(fnamePartial, locals, callback);
    } else if (fnamePartial.match(/\.html\.ejs$/)
            || fnamePartial.match(/\.html\.md$/)) {
        var rendered = partialSync(fnamePartial, locals);
        callback(null, rendered.content);
    } else {
        throw 'UNKOWN Async Template Engine for ' + fnamePartial;
    }
}

var partialKernel = function(name, locals, callback) {
    K(name, function (err, template) {
        if (err) {
            util.log('partial error ' + err);
            callback(err);
        } else {
            // util.log('rendering ' + name + ' with ' + util.inspect(locals));
            template(locals, callback);
        }
    });
}

var partialSync = module.exports.partialSync = function(name, locals) {
    return renderFile(name, locals);
}

var renderFileAsync = module.exports.renderFileAsync = function(fileName, data, done) {
    util.log('renderFileAsync: ' + fileName);
    var frontmatter = readFile(fileName);
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    
    if (fnext !== "kernel") throw 'UNKOWN Async Template Engine for ' + fileName;
    
    data.partial = module.exports.partial;
    
    data.oembed = function(arg, callback) {
        // util.log('oembed ' + util.inspect(arg));
        oembed.fetch(arg.url, { maxwidth: 6000 }, function(err, result) {
            if (err) {
                throw err;
            }
            // util.log('retrieved oembed.. ' + util.inspect(result) + ' for url ' + arg.url);
            partial(arg.template, result, callback);
        });
    };
    
    for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
    }
    data.layout = undefined;
    var rendered = undefined;
    
    var template = K(fileName, function(err, template) {
        if (err) throw err;
        template(data, function(err, html) {
            data.content = html;
            if (frontmatter.layout) {
                var fntmpl = findtemplate(frontmatter.layout);
                if (fntmpl.match(/\.kernel$/)) {
                    renderFileAsync(fntmpl, data, function(err, data) {
                        if (err) throw err;
                        done(err, {
                            fname:   fname,
                            ext:     fnext,
                            content: data.content
                        });
                    });
                } else {
                    var rdata = renderFile(fntmpl, data);
                    done(undefined, {
                        fname:   fname,
                        ext:     fnext,
                        content: rdata.content  
                    });
                }
            } else {
                done(err, {
                    fname:   fname,
                    ext:     fnext,
                    content: data.content  
                });
            }
        });
    });
}

var renderFile = module.exports.renderFile = function(fileName, data) {
    util.log('renderFile: ' + fileName);
    var frontmatter = readFile(fileName);
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    
    // util.log('frontmatter ' + util.inspect(frontmatter));
    
    data.partial = function(fname, locals) {
        fnamePartial = findpartial(fname);
        return partialSync(fnamePartial, locals);
    };
    
    for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
    }
    data.layout = undefined;
    
    var rendered = undefined;
    // util.log(util.inspect(data));
    if (fnext === 'ejs') rendered = ejs.render(frontmatter.text, data);
    else if (fnext === 'md')  rendered = require("markdown").markdown.toHTML(frontmatter.text);
    else throw 'UNKNOWN Synchronous Template Engine for ' + fileName;
    data.content = rendered;
    
    // util.log(util.inspect(data));
    
    if (frontmatter.layout) {
        var fntmpl = findtemplate(frontmatter.layout);
        return {
            fname:   fname,
            ext:     fnext, 
            content: renderFile(fntmpl, data).content
        };
    } else {
        return {
            fname:   fname,
            ext:     fnext, 
            content: data.content
        };
    }
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