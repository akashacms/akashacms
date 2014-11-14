/**
 *
 * Copyright 2013,2014 David Herron
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
var path       = require('path');
var async      = require('async');
var find       = require('./find');
var YAML       = require('yamljs');

var logger;

module.exports.config = function(akasha, config) {
	logger = akasha.getLogger("fileCache");
};

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
module.exports.readDocument = function(config, docName, done) {
    if (docCache.hasOwnProperty(docName)) {
        /* TODO test if (the time stamp shows the in-memory copy is out of date) {
            //code
        } */
        done(undefined, docCache[docName]);
    } else {
		var docEntry = find.document(config, docName);
		if (!docEntry) {
			done(new Error('Did not find document named '+ docName));
		} else {
			var text = fs.readFileSync(docEntry.fullpath, 'utf8');
			var fnparts = /(.*)\.([^\.]+)$/.exec(docName);
			if (!fnparts) {
				done(new Error("File name didn't match expected naming format "+ docEntry.fullpath));
			} else {
				var fname = fnparts[1];
				var fnext = fnparts[2];
				try {
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
					done(undefined, docCache[docName]);
				} catch (e) {
					done(e);
				}
			}
		}
    }
};

module.exports.createDocument = function(config, rootdir, docpath, metadata, content, done) {
    
    var text =
        '---\n'
      + metadata +'\n'
      + '---\n'
      + content;
      
    if (docpath.charAt(0) === '/') {
        docpath = docpath.substr(1);
    }
    
    util.log('createDocument '+ docpath +' '+ text);
    
    var failed = false;
    var docEntry;
    try {
		docEntry = {
			type: "document",
			// The root_docs directory containing the file
			rootdir: rootdir,
			// The relative pathname within rootdir
			path: docpath,
			// The absolute pathname for the file
			fullpath: path.join(rootdir, docpath),
			stat: undefined, // later: fs.statSync(docEntry.fullpath),
			renderedFileName: undefined, // later: fname,
			fileExt: undefined, // later: fnext,
			isdir: false,
			frontmatter: extractFrontmatter(text),
			data: text
		};
    } catch (e) {
    	failed = true;
    	util.log('FAILED to create docEntry because '+ e);
    	done(e);
    }
    if (!failed) {
		docCache[docpath] = docEntry;
		var fnparts = /(.*)\.([^\.]+)$/.exec(docpath);
		docEntry.renderedFileName = fnparts[1];
		docEntry.fileExt = fnparts[2];
		fs.writeFile(path.join(rootdir, docpath), text, { encoding: 'utf8' }, function(err) {
			if (err) done(err);
			else {
				fs.stat(path.join(rootdir, docpath), function(err, stats) {
					if (err) {
						done(err);
					} else {
						docEntry.stat = stats;
						done(undefined, docEntry);
					}
				});
			}
		});
    }
}

module.exports.updateDocumentData = function(config, docEntry, metadata, content, cb) {
    var text =
        '---\n'
      + metadata +'\n'
      + '---\n'
      + content;
    var fm;
    var failed = false;
    try { fm = extractFrontmatter(text); } catch(e) {
    	failed = true;
    	cb(e);
    }
    if (!failed) {
		docEntry.frontmatter = fm; 
		docEntry.data = text;
		// util.log('updateDocumentData '+ docEntry.fullpath +' text='+ text);
		fs.writeFile(docEntry.fullpath, text, { encoding: 'utf8' }, function(err) {
			if (err) {
				cb(err);
			} else {
				cb();
			}
		});
    }
};

module.exports.deleteDocumentForUrlpath = function(config, urlpath, cb) {
    // util.log('deleteDocumentForUrlpath '+ urlpath);
    if (docCache[urlpath]) {
        // util.log('FOUND');
        fs.unlink(docCache[urlpath].fullpath, function(err) {
            if (err) {
                // util.log('unlink FAIL '+ err);
                cb(err);
            } else {
                // util.log('unlink SUCCESS');
                delete docCache[urlpath];
                cb();
            }
        });
    } else {
        // util.log('no docCache for '+ urlpath);
        cb(new Error("No docCache entry for "+ urlpath));
    }
};

module.exports.eachDocument = function(config, doccb) {
    for (var docName in docCache) {
        doccb(docCache[docName]);
    }
};

module.exports.documentForUrlpath = function(config, urlpath) {
    var docEntry;
    if (urlpath.charAt(0) === '/') {
        urlpath = urlpath.substr(1);
    }
    for (var docName in docCache) {
        docEntry = docCache[docName];
        // util.log(docName +' renderedFileName='+ docEntry.renderedFileName +' urlpath='+ urlpath);
        if (docEntry.renderedFileName === urlpath || docEntry.path === urlpath) {
            return docEntry;
        }
    }
    return undefined;
};

var templCache = [];
module.exports.readTemplate = function(config, templName) {
    if (templCache.hasOwnProperty(templName)) {
        return templCache[templName];
    }
    var templEntry = find.template(config, templName);
    if (!templEntry) {
        throw new Error('Did not find template named '+ templName);
    } else {
        var text = fs.readFileSync(templEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(templName);
        if (!fnparts) {
          throw new Error("File name didn't match expected naming format "+ docEntry.fullpath);
        } else {
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
    }
};

var partialCache = [];
module.exports.readPartial = function(config, partialName) {
    if (partialCache.hasOwnProperty(partialName)) {
        return partialCache[partialName];
    }
    var templEntry = find.template(config, partialName);
    if (!templEntry) {
        throw new Error('Did not find template named '+ partialName);
    } else {
        var text = fs.readFileSync(templEntry.fullpath, 'utf8');
        var fnparts = /(.*)\.([^\.]+)$/.exec(partialName);
        if (!fnparts) {
          throw new Error("File name didn't match expected naming format "+ docEntry.fullpath);
        } else {
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
    }
};


/**
 * Find the index.html.xyzzy for a given directory.
 **/
 /*  UNNEEDED??  Need for this superseded by indexChain?
 
module.exports.findIndex = function(config, dirname, done) {
    // util.log('fileCache.findIndex '+ dirname);
    
    var existsAndIsDirectory = function(dirnm, cb) {
    	fs.exists(dirnm, function(exists) {
    		if (exists) {
    			fs.stat(dirnm, function(err, stats) {
    				// util.log(util.inspect(stats));
    				if (err) cb(err);
    				else {
    					if (stats.isDirectory()) {
    						fs.readdir(dirnm, cb);
    					} else {
    						cb();
    					}
    				}
    			});
    		} else {
    			cb();
    		}
    	});
    };
    
    for (var i = 0; i < config.root_docs.length; i++ ) {
        var dir = config.root_docs[i];
        var tdirn = path.join(dir, dirname);
        existsAndIsDirectory(tdirn, function(err, fnAry) {
        	if (err) done(err);
        	else if (fnAry) {
                // util.log('DIR '+ tdirn + ' has files '+ util.inspect(fnAry));
                var found;
                async.eachSeries(fnAry,
                	function(fn, cb) {
						// util.log('found '+ tdirn +' '+ fn);
						if (fn.indexOf("index.html") === 0) {
							module.exports.readDocument(config, path.join(dirname, fn), function(err, entry) {
								// util.log('findIndex read Document '+ entry.path);
								if (err) cb(err);
								else { found = entry; cb(); }
							});
						} else cb();
                	},
                	function(err) {
                		if (err) done(err);
                		else if (found) {
                			util.log('findIndex found '+ found.path +' for '+ dirname);
                			done(undefined, found);
                		} else done();
                	});
        	} else {
                // util.log('DIR '+ tdirn + ' has zero files');
            }
        });
    }
}; */

module.exports.indexChain = function(config, docName) {
	var docEntry = module.exports.documentForUrlpath(config, docName);
	if (!docEntry) throw new Error('Could not find docEntry for '+ docName);
	else {
	
		// STEP 0 - initialize the returned array with the given document
	
		var indxChain = [];
		if (path.basename(docEntry.renderedFileName) !== "index.html") {
			indxChain.push(docEntry);
		}
		
		// Step 2 - iteratively step to parent directory, get it's index.html
		
		for (var done = false, dirname = path.dirname(docName);
			 !done;
			 dirname = path.dirname(dirname)) {
			
			var indxFnm = path.join(dirname, "index.html");
			// util.log('searching for '+ indxFnm);
			var indxDocEntry = module.exports.documentForUrlpath(config, indxFnm);
			if (indxDocEntry) indxChain.unshift(indxDocEntry);
			
			if (dirname === '.') done = true;
		}
		
		return indxChain;
	}
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
