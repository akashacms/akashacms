/**
 *
 * Copyright 2012-2014 David Herron
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

var fs        = require('fs');
var util      = require('util');
var path      = require('path');
var async     = require('async');
var oembed    = require('oembed');
var fileCache = require('./fileCache');
var find      = require('./find');

var less      = require('less');
var ejs       = require('ejs');
var K         = require('kernel');
//var markdown = require("markdown").markdown;
var marked    = require('marked');
var mahabhuta = require('./mahabhuta');

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

var siteConfig;
module.exports.config = function(_config) {
  // util.log('renderer config ' + util.inspect(theoptions));
  siteConfig = _config;
};

///////// Extra support for Kernel template engine
///////// The purpose is to support frontmatter

K.resourceLoader = function(fileNameObj, callback) {
    var fileName;
    var fileType;
    // util.log('resourceLoader '+ fileNameObj);
    if (fileNameObj.indexOf("inline:") === 0) {
        fileType = "inline";
        fileName = fileNameObj.substr(7);
    } else {
        var fnparts = fileNameObj.match(/([a-zA-Z]+):(.*)$/);
        // util.log(util.inspect(fnparts));
        fileType = fnparts[1];
        fileName = fnparts[2];
    }
    var entry;
    if (fileType === "partial")
        entry = fileCache.readPartial(options, fileName);
    else if (fileType === "template")
        entry = fileCache.readTemplate(options, fileName);
    else if (fileType === "inline")
        entry = {
          frontmatter: {
            text: fileName
          }
        };
    else
        entry = fileCache.readDocument(options, fileName);
    // util.log('resourceLoader '+ entry.path +' '+ entry.fullpath);
    if (entry) {
      callback(null, entry.frontmatter.text);
    } else {
      callback(new Error("No file entry found for "+ util.inspect(fileNameObj)));
    }
};

var copyProperties = module.exports.copyProperties = function(metadata, frontmatter) {
  for (var prop in frontmatter) {
    if (!(prop in metadata)) metadata[prop] = frontmatter[prop];
  }
  return metadata;
};

/*var partial = module.exports.partial = function(config, fname, metadata, done) {
    // util.log(util.inspect(options));
    var fnamePartial = find.partial(config, fname);
    // util.log('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial === undefined) return done(new Error('NO FILE FOUND FOR PARTIAL ' + util.inspect(fname)));
    var text = fs.readFileSync(fnamePartial, 'utf8');
    processExtension(config, stripExtensions(fname), text, metadata, function(err, rendered) {
        if (err) done(err);
        else done(undefined, rendered);
    });
}*/

var oembedRender = module.exports.oembedRender = function(arg, callback) {
    // util.log('oembed ' + util.inspect(arg));
    if (!arg.template) callback(new Error("Must provide a partial/template render on"));
    if (!arg.url)      callback(new Error("Must provide a URL to retrieve"));
    oembed.fetch(arg.url, { maxwidth: 6000 }, function(err, result) {
        if (err) {
            throw err;
        } else {
            // util.log('retrieved oembed.. ' + util.inspect(result) + ' for url ' + arg.url);
            partialKernel(arg.template, result, function(err, data) {
                // util.log(util.inspect(err));
                // util.log(util.inspect(data));
                callback(err, data);
            });
        }
    });
};

var partialSync = function(fname, metadata) {
    var fnamePartial = find.partial(siteConfig, fname);
    // util.log('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial === undefined) 
        throw new Error('NO FILE FOUND FOR PARTIAL ' + util.inspect(fname));
    var text = fs.readFileSync(fnamePartial, 'utf8');
    var rendered;
    if (fname.match(/\.ejs$/)) rendered = ejs.render(text, metadata);
    else if (fname.match(/\.md$/)) rendered = marked(text);
    else if (fname.match(/\.html$/)) rendered = text;
    else { throw new Error('UNKNOWN Synchronous Template Engine for ' + fname); }
    return rendered;
};

var partialKernel = function(fname, metadata, callback) {
    // util.log('partialKernel ' + name);
    // var fnamePartial = find.partial(options, name);
    // if (fnamePartial == undefined) done('NO FILE FOUND FOR PARTIAL 2 ' + util.inspect(name));
    if (fname.match(/\.ejs$/) || fname.match(/\.md$/) || fname.match(/\.html$/)) {
        callback(undefined, partialSync(fname, metadata));
    } else {
        K("partial:"+ fname, function (err, template) {
            if (err) {
                // util.log('partial error ' + err);
                callback(err);
            } else {
                // util.log('rendering ' + fnamePartial + ' with ' + util.inspect(locals));
                template(metadata, callback);
            }
        });
    }
};

var processExtension = function(config, extensions, toRender, metadata, done) {
    // util.log("processExtension "+ util.inspect(extensions) +" "+ util.inspect(toRender));
    var ext = extensions.shift();
    // util.log(ext);
    var r;
    var data = copyProperties({}, metadata); // Clone the metadata so we can add functions to it
    if (ext === "md") {
        r = marked(toRender);
        // util.log('rendered md '+ util.inspect(r));
        processExtension(config, extensions, r, metadata, done);
    } else if (ext === "ejs") {
        // util.log(util.inspect(data));
        data.partial = partialSync;
        r = ejs.render(toRender, data);
        // util.log('rendered ejs '+ util.inspect(r));
        processExtension(config, extensions, r, metadata, done);
    } else if (ext === "kernel") {
        data.partial = partialKernel;
        data.oembed = oembedRender;
        K("inline:"+toRender, function(err, template) {
            if (err) done(err);
            else {
                template(data, function(err, html) {
                    if (err) done(err);
                    else processExtension(config, extensions, html, metadata, done);
                });
            }
        });
    } else if (ext.match(/\.html$/i) || ext.match(/\.php$/i)) {
        mahabhuta.render(toRender, {
            metadata: data,
            cheerio: config.cheerio ? config.cheerio : undefined,
            process: function($, options, mahafini) {
                // util.log('mahabhuta process '+ util.inspect(options));
                if (config.mahabhuta && config.mahabhuta.length > 0) {
                    async.eachSeries(config.mahabhuta,
                    function(mahafunc, next) {
                        mahafunc(config, $, metadata, function(err) {
                            if (err) next(err);
                            else next(undefined);
                        });
                    },
                    function(err) {
                        if (err) mahafini(err);
                        else mahafini(undefined);
                    });
                } else {
                    mahafini(undefined);
                }
            }
        }, function(err, rendered) {
            if (err) done(err);
            else done(undefined, rendered);
        });
    } else {
        done(undefined, toRender);
    }
};


var stripExtensions = module.exports.stripExtensions = function(fnRender) {
    var extensions = [];
    var done = false;
    // These are the allowed extensions for document file names
    // Files are supposed to be named:  foo.html.ext1.ext2.ext3
    var extMatcher = /^(.*)\.(md|ejs|kernel)$/i;
    for (var curfn = fnRender; !done; ) {
        var m = extMatcher.exec(curfn);
        if (m) {
            extensions.push(m[2]);
            curfn = m[1];
        } else if (curfn.match(/\.html$/i) || curfn.match(/\.php$/i)) {
            done = true;
            extensions.push(curfn);
        } else {
            done = true;
            extensions.push(curfn);
        }
    }
    return extensions;
};

module.exports.partial = function(config, name, metadata, callback) {
    partialKernel(name, metadata, callback);
};

module.exports.partialSync = function(config, name, metadata, done) {
    // util.log('renderer2 exports.partialSync '+ name +' '+ util.inspect(metadata));
    var rendered = partialSync(name, metadata);
    if (done) done(null, rendered);
    return rendered;
};

/**
 *
 * Typical call: render(config, undefined, fileName, {}, undefined, function(err, TBD) {...})
 **/
var render = module.exports.render = function(config, entryOrig, fnRender, metadata, body, done) {
    var entryRender;
    if (!entryOrig || entryOrig.path === fnRender) {
        entryRender = fileCache.readDocument(config, fnRender);
    } else {
        entryRender = fileCache.readTemplate(config, fnRender);
    }
    if (!entryOrig) entryOrig = entryRender; // Initialization for first time we're called
    // util.log('render: ' + fnRender +' '+ entryRender.fullpath);
    if (!metadata.documentPath) {
        metadata.documentPath = fnRender; 
    }
    if (!metadata.publicationDate) {
        var dateSet = false;
        if (entryRender.frontmatter.publDate) {
          	var parsed = Date.parse(entryRender.frontmatter.publDate);
          	if (! isNaN(parsed)) {
          	  metadata.publicationDate = new Date(parsed);
          	}
          	dateSet = true;
        }
        if (! dateSet && entryRender.stat && entryRender.stat.mtime) {
            metadata.publicationDate = entryRender.stat.mtime;
        }
    }
    
    if (! metadata.rendered_url) {
        metadata.rendered_url = config.root_url +"/"+ entryOrig.renderedFileName; 
    }
    
    metadata.layout = undefined;
    
    copyProperties(metadata, entryRender.frontmatter);
    
    var extensions;
    try {
      extensions = stripExtensions(fnRender);
    } catch(e) { return done(e); }
    
    metadata.content = body;
    
    // util.log("entryOrig "+ util.inspect(entryOrig));
    // util.log("entryRender "+ util.inspect(entryRender));
    // util.log("metadata "+ util.inspect(metadata));
    
    processExtension(config, extensions, entryRender.frontmatter.text, metadata, function(err, newbody) {
        if (entryRender.frontmatter.layout) {
            render(config, entryOrig, entryRender.frontmatter.layout, metadata, newbody, done);
        } else {
            return done(undefined, {
                fname:   entryOrig.renderedFileName,
                ext:     entryOrig.fileExt,
                content: newbody
            });
        }
    });
};

