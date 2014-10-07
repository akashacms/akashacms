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
var YAML       = require('yamljs');

var extractFrontmatter = module.exports.extractFrontmatter = function(text) {
    var ret = {};
    var ymlines = "";
    if (text.charAt(0) === '-' && text.charAt(1) === '-' && text.charAt(2) === '-') {
        var splitLine = /^(\w+):\s*(.*)$/;
        var lines = text.split('\n');
        lines.shift();
        for (var line = lines.shift();
             ! ( line.charAt(0) === '-' && line.charAt(1) === '-' && line.charAt(2) === '-' );
             line = lines.shift()) {
            ymlines += line + "\n";
            /*if (! line) continue;
            // util.log(line);
            var colon  = line.indexOf(':');
            if (colon < 0) continue;
            var tagname = line.substring(0, colon).trim();
            var tagval  = line.substring(colon+1).trim();
            // util.log(tagname);
            // util.log(tagval);
            ret[tagname] = tagval;*/
            /*var tagval = splitLine.exec(line);
            util.log(line);
            util.log(util.inspect(tagval));
            ret[tagval[1]] = tagval[2];*/
        }
        ret.yamltext = ymlines;
        ret.yaml = YAML.parse(ymlines);
        ret.text = lines.join('\n');
    } else {
        ret.yamltext = undefined;
        ret.yaml = {};
        ret.text = text;
    }
    return ret;
};

var docCache = [];
module.exports.readDocument = function(options, docName) {
    if (docCache.hasOwnProperty(docName)) {
        /* TODO test if (the time stamp shows the in-memory copy is out of date) {
            //code
        } */
        return docCache[docName];
    }
    var docEntry = find.document(options, docName);
    if (!docEntry) {
        throw new Error('Did not find document named '+ docName);
    } else {
        var text = fs.readFileSync(docEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(docName);
        if (!fnparts) {
          throw new Error("File name didn't match expected naming format "+ docEntry.fullpath);
        }
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
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return docCache[docName];
    }
};

module.exports.createDocument = function(options, rootdir, path, metadata, content, done) {
    
    var text =
        '---\n'
      + metadata +'\n'
      + '---\n'
      + content;
      
    docCache[path] = {
        type: "document",
        // The root_docs directory containing the file
        rootdir: rootdir,
        // The relative pathname within rootdir
        path: path,
        // The absolute pathname for the file
        fullpath: path.join(rootdir, path),
        stat: undefined, // later: fs.statSync(docEntry.fullpath),
        renderedFileName: undefined, // later: fname,
        fileExt: undefined, // later: fnext,
        isdir: false,
        frontmatter: extractFrontmatter(text),
        data: text
    };
    var docEntry = docCache[path];
    docEntry.stat = fs.statSync(docEntry.fullpath);
    var fnparts = /(.*)\.([^\.]+)$/.exec(path);
    docEntry.renderedFileName = fnparts[1];
    docEntry.fileExt = fnparts[2];
    fs.writeFile(path.join(rootdir, path), { encoding: 'utf8' }, text, function(err) {
        if (err) done(err);
        else done(undefined, docEntry);
    });
}

module.exports.updateDocumentData = function(config, docEntry, metadata, content, cb) {
    var text =
        '---\n'
      + metadata +'\n'
      + '---\n'
      + content;
    docEntry.frontmatter = extractFrontmatter(text);
    docEntry.data = text;
    fs.writeFile(docEntry.fullpath, text, { encoding: 'utf8' }, function(err) {
        if (err) {
            cb(err);
        } else {
            cb();
        }
    });
};

module.exports.deleteDocumentForUrlpath = function(config, path, cb) {
    if (docCache[path]) {
        fs.unlink(path, function(err) {
            if (err) {
                cb(err);
            } else {
                delete docCache[path];
                cb();
            }
        });
    } else {
        cb(new Error("No docCache entry for "+ path));
    }
};

module.exports.eachDocument = function(options, doccb) {
    for (var docName in docCache) {
        doccb(docCache[docName]);
    }
};

module.exports.documentForUrlpath = function(options, urlpath) {
    var docEntry;
    if (urlpath.charAt(0) === '/') {
        urlpath = urlpath.substr(1);
    }
    for (var docName in docCache) {
        docEntry = docCache[docName];
        // util.log(docName +' renderedFileName='+ docEntry.renderedFileName +' urlpath='+ urlpath);
        if (docEntry.renderedFileName === urlpath) {
            return docEntry;
        }
    }
    return undefined;
};

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
        if (!fnparts) {
          throw new Error("File name didn't match expected naming format "+ docEntry.fullpath);
        }
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
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return templCache[templName];
    }
};

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
        if (!fnparts) {
          throw new Error("File name didn't match expected naming format "+ docEntry.fullpath);
        }
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
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        };
        return partialCache[partialName];
    }
};


/**
 * Find the index.html.xyzzy for a given directory.
 **/
module.exports.findIndex = function(options, dirname) {
    // util.log('fileCache.findIndex '+ dirname);
    for (var i = 0; i < options.root_docs.length; i++ ) {
        var dir = options.root_docs[i];
        var tdirn = path.join(dir, dirname);
        // util.log('Looking in '+ tdirn);
        if (fs.existsSync(tdirn)) {
            var stats = fs.statSync(tdirn);
            if (stats.isDirectory()) {
                var fnAry = fs.readdirSync(tdirn);
                // util.log('DIR has files '+ util.inspect(fnAry));
                for (var j = 0; j < fnAry.length; j++) {
                    var fn = fnAry[j];
                    // util.log('found '+ tdirn +' '+ fn);
                    if (fn.indexOf("index.html") === 0) {
                        return module.exports.readDocument(options, path.join(dirname, fn));
                    }
                }
            }
        }
    }
    return undefined;
};


/**
 * Test whether a file name will be giving an HTML result
 **/
var supportedForHtml = module.exports.supportedForHtml = function(fn) {
    if (module.exports.isSyncHtml(fn)
     || module.exports.isASyncHtml(fn)
     || module.exports.isSyncPHP(fn)
     || module.exports.isASyncPHP(fn))
        return true;
    else
        return false;
};

module.exports.renderedFileName = function(fileName) {
    if (supportedForHtml(fileName) || fileName.match(/\.css\.less$/)) {
        var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
        return fnparts[1];
    } else {
        return fileName;
    }
};

module.exports.isSyncPHP = function(fn) {
  return fn.match(/\.php\.ejs$/);
};

module.exports.isSyncHtml = function(fn) {
  return fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/);
};

module.exports.isASyncPHP = function(fn) {
  return fn.match(/\.php\.kernel$/);
};

module.exports.isASyncHtml = function(fn) {
  return fn.match(/\.html\.kernel$/);
};

module.exports.isHtml = function(fn) {
  return fn.match(/\.html$/);
};

module.exports.isIndexHtml = function(fn) {
    return path.basename(fn).indexOf("index.html") === 0 && supportedForHtml(fn);
};
