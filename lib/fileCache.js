/**
 *
 * Copyright 2013 David Herron
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
 *
 */

var fs         = require('fs');
var util       = require('util');
var filewalker = require('filewalker');
var path       = require('path');
var find       = require('./find');

var extractFrontmatter = module.exports.extractFrontmatter = function(text) {
    var ret = {};
    if (text.charAt(0) === '-' && text.charAt(1) === '-' && text.charAt(2) === '-') {
        var splitLine = /^(\w+):\s*(.*)$/;
        var lines = text.split('\n');
        lines.shift();
        for (var line = lines.shift();
             ! ( line.charAt(0) === '-' && line.charAt(1) === '-' && line.charAt(2) === '-' );
             line = lines.shift()) {
            if (! line) continue;
            // util.log(line);
            var colon  = line.indexOf(':');
            if (colon < 0) continue;
            var tagname = line.substring(0, colon).trim();
            var tagval  = line.substring(colon+1).trim();
            // util.log(tagname);
            // util.log(tagval);
            ret[tagname] = tagval;
            /*var tagval = splitLine.exec(line);
            util.log(line);
            util.log(util.inspect(tagval));
            ret[tagval[1]] = tagval[2];*/
        }
        ret.text = lines.join('\n');
    } else {
        ret.text = text;
    }
    return ret;
}

var docCache = [];
module.exports.readDocument = function(options, docName) {
    if (docCache.hasOwnProperty(docName)) {
        return docCache[docName];
    }
    var docEntry = find.document(options, docName);
    if (!docEntry) {
        throw new Error('Did not find document named '+ docName);
    } else {
        var text = fs.readFileSync(docEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(docName);
        var fname = fnparts[1];
        var fnext = fnparts[2];
        docCache[docName] = {
            type: "document",
            // The root_docs directory containing the file
            rootdir: docEntry.rootdir,
            // The relative pathname within rootdir
            path: docEntry.path,
            // The absolute pathname for the file
            fullpath: docEntry.fullpath,
            stat: fs.statSync(docEntry.fullpath),
            renderedFileName: fname,
            fileExt: fnext,
            rendersToHtml: supportedForHtml(docName),
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return docCache[docName];
    }
}

module.exports.eachDocument = function(options, doccb) {
    for (docName in docCache) {
        doccb(docCache[docName]);
    }
}

var templCache = [];
module.exports.readTemplate = function(options, templName) {
    if (templCache.hasOwnProperty(templName)) {
        return templCache[templName];
    }
    var templEntry = find.template(options, templName);
    if (!templEntry) {
        throw new Error('Did not find template named '+ templName);
    } else {
        var text = fs.readFileSync(templEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(templName);
        var fname = fnparts[1];
        var fnext = fnparts[2];
        templCache[templName] = {
            type: "template",
            // The root_docs directory containing the file
            rootdir: templEntry.rootdir,
            // The relative pathname within rootdir
            path: templEntry.path,
            // The absolute pathname for the file
            fullpath: templEntry.fullpath,
            stat: fs.statSync(templEntry.fullpath),
            renderedFileName: fname,
            fileExt: fnext,
            rendersToHtml: supportedForHtml(templName),
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return templCache[templName];
    }
}

var partialCache = [];
module.exports.readPartial = function(options, partialName) {
    if (partialCache.hasOwnProperty(partialName)) {
        return partialCache[partialName];
    }
    var templEntry = find.template(options, partialName);
    if (!templEntry) {
        throw new Error('Did not find template named '+ partialName);
    } else {
        var text = fs.readFileSync(templEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(partialName);
        var fname = fnparts[1];
        var fnext = fnparts[2];
        partialCache[partialName] = {
            type: "partial",
            // The root_docs directory containing the file
            rootdir: templEntry.rootdir,
            // The relative pathname within rootdir
            path: templEntry.path,
            // The absolute pathname for the file
            fullpath: templEntry.fullpath,
            stat: fs.statSync(templEntry.fullpath),
            renderedFileName: fname,
            fileExt: fnext,
            rendersToHtml: supportedForHtml(partialName),
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return partialCache[partialName];
    }
}


/**
 * Find the index.html.xyzzy for a given directory.
 **/
module.exports.findIndex = function(options, dirname) {
    for (var i = 0; i < options.root_docs.length; i++ ) {
        var dir = options.root_docs[i];
        var tdirn = path.join(dir, dirname);
        if (fs.existsSync(tdirn)) {
            var stats = fs.statSync(tdirn);
            if (stats.isDirectory()) {
                var fnAry = fs.readdirSync(tdirn);
                for (var i = 0; i < fnAry.length; i++) {
                    var fn = fnAry[i];
                    // util.log(tdirn +' '+ fn);
                    if (fn.indexOf("index.html") === 0) {
                        return module.exports.readDocument(options, path.join(dirname, fn));
                    }
                }
            }
        }
    }
    return undefined;
}


/**
 * Test whether a file name will be giving an HTML result
 **/
var supportedForHtml = module.exports.supportedForHtml = function(fn) {
    if (module.exports.isSyncHtml(fn) || module.exports.isASyncHtml(fn) || module.exports.isHtml(fn))
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

module.exports.isSyncHtml = function(fn) {
  return fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/);
}

module.exports.isASyncHtml = function(fn) {
  return fn.match(/\.html\.kernel$/);
}

module.exports.isHtml = function(fn) {
  return fn.match(/\.html$/);
}

module.exports.isIndexHtml = function(fn) {
    return path.basename(fn).indexOf("index.html") === 0 && supportedForHtml(fn);
}
