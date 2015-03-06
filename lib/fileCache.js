/**
 *
 * Copyright 2013-2015 David Herron
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
var rendererNull = require('./renderer-null');

var akasha;
var config;

var yfm        = require('yfm');

var logger;

module.exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("fileCache");
};

var extractFrontmatter = module.exports.extractFrontmatter = function(text) {
	
	var fm = yfm(text);
	// Map the values yfm returns to what this function had formerly returned
	return {
		yamltext: fm.original,
		yaml: fm.context,
		text: fm.content
	};
};

var docCache = [];
module.exports.readDocument = function(config, docName, done) {
    if (docName.charAt(0) === '/') {
        docName = docName.substr(1);
    }
    if (docCache.hasOwnProperty(docName)) {
        var docEntry = docCache[docName];
        fs.stat(docEntry.fullpath, function(err, stats) {
        	if (err) { 
        		logger.error('readDocument FAIL '+ docName +' because '+ err);
        		done(err);
        	} else {
        		if ((stats.mtime - docEntry.stat.mtime) <= 0) {
        			// logger.trace('readDocument returning cached '+ docName);
        			done(undefined, docEntry);
        		} else {
        			// logger.trace('readDocument requires reloading '+ docName);
					delete docCache[docName];
					module.exports.readDocument(config, docName, done);
        		}
        	}
        });
    } else {
		find.documentAsync(config, docName, function(err, docEntry) {
			if (err) { logger.error(err); done(err); }
			else {
				logger.trace('readDocument read '+ docName);
				fs.readFile(docEntry.fullpath, 'utf8', function(err, text) {
					if (err) { logger.error(err); done(err); }
					else {
						var renderer = akasha.findRenderChain(docName);
						if (!renderer) {
							renderer = rendererNull.match(docName);
							renderer.renderSync = rendererNull.renderSync;
							renderer.render = rendererNull.render;
						}
						try {
							var e = {
								type: "document",
								// The root_docs directory containing the file
								rootdir: docEntry.rootdir,
								// The relative pathname within rootdir
								path: docEntry.path,
								// The absolute pathname for the file
								fullpath: docEntry.fullpath,
								stat: fs.statSync(docEntry.fullpath),
								renderedFileName: renderer.renderedFileName,
								fileExt: renderer.extension,
								renderer: renderer,
								isdir: false,
								frontmatter: extractFrontmatter(text),
								data: text
							};
							docCache[docName] = e;
							// logger.trace('readDocument returning newly read '+ docName);
							done(undefined, docCache[docName]);
						} catch (e) {
							logger.error(e);
							done(e);
						}
					}
				});
			}
		});
    }
};

module.exports.createInMemoryDocument = function(config, rootdir, docpath, text, done) {
	var renderChain = akasha.findRenderChain(docpath);
	if (!renderChain) {
		renderChain = rendererNull.match(docpath);
		renderChain.renderSync = rendererNull.renderSync;
		renderChain.render = rendererNull.render;
	}
		
    var docEntry, error;
    try {
		docEntry = {
			type: "document",
			// The root_docs directory containing the file
			rootdir: rootdir,
			// The relative pathname within rootdir
			path: docpath,
			// The absolute pathname for the file
			fullpath: path.join(rootdir, docpath),
			stat: undefined, // laeachter: fs.statSync(docEntry.fullpath),
			renderedFileName: renderChain.renderedFileName, // later: fname,
			fileExt: renderChain.extension, // later: fnext,
			renderer: renderChain,
			isdir: false,
			frontmatter: extractFrontmatter(text),
			data: text
		};
    } catch (e) {
    	logger.error('FAILED to create docEntry because '+ e);
		error = e;
    }
    if (error) {
    	done(error);
	} else {
		docCache[docpath] = docEntry;
		done(null, docEntry);
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
    
    logger.info('createDocument '+ docpath +' '+ text);

	var renderChain = akasha.findRenderChain(docpath);
	if (!renderChain) {
		renderChain = rendererNull.match(docpath);
		renderChain.renderSync = rendererNull.renderSync;
		renderChain.render = rendererNull.render;
	}
						
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
			renderedFileName: renderChain.renderedFileName, // later: fname,
			fileExt: renderChain.extension, // later: fnext,
			renderer: renderChain,
			isdir: false,
			frontmatter: extractFrontmatter(text),
			data: text
		};
    } catch (e) {
    	failed = true;
    	logger.error('FAILED to create docEntry because '+ e);
    	done(e);
    }
    if (!failed) {
		docCache[docpath] = docEntry;
		// var fnparts = /(.*)\.([^\.]+)$/.exec(docpath);
		// docEntry.renderedFileName = fnparts[1];
		// docEntry.fileExt = fnparts[2];
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
    logger.trace('deleteDocumentForUrlpath '+ urlpath);
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

module.exports.eachDocumentAsync = function(config, action, fini) {
	var docs = [];
	module.exports.eachDocument(config, function(docEntry) { docs.push(docEntry); });
	// til.log('eachDocumentAsync count='+ docs.length);
	async.eachSeries(docs, action, fini);
};

module.exports.documentForUrlpath = function(config, _urlpath) {
    var docEntry, urlpath = _urlpath;
    if (urlpath.charAt(0) === '/') {
        urlpath = urlpath.substr(1);
    }
    for (var docName in docCache) {
        docEntry = docCache[docName];
        // util.log(docName +' renderedFileName='+ docEntry.renderedFileName +' urlpath='+ _urlpath);
        if (docEntry.renderedFileName === urlpath || docEntry.path === urlpath) {
            return docEntry;
        }
    }
    return undefined;
};

module.exports.findMatchingDocuments = function(config, matchers) {
	var matched = [];
    for (var docName in docCache) {
		var matchedLayout = false;
		var matchedYaml = false;
		var matchedPath = false;
		
		var docEntry = docCache[docName];
		if (matchers.layouts
		 && docEntry
         && docEntry.frontmatter
         && docEntry.frontmatter.yaml
         && docEntry.frontmatter.yaml.layout) {
			for (var i = 0; i < matchers.layouts.length; i++) {
				if (matchers.layouts[i] === docEntry.frontmatter.yaml.layout) {
					matchedLayout = true;
				}
			}
		} else matchedLayout = true;
		
		if (matchers.yaml
		 && docEntry
         && docEntry.frontmatter
         && docEntry.frontmatter.yaml) {
			if (docEntry.frontmatter.yaml[matchers.yaml.tag].match(matchers.yaml.matcher)) {
				matchedYaml = true;
			}
		} else matchedYaml = true;
		
		if (matchers.path) {
			if (docEntry.path.match(matchers.path)) {
				matchedPath = true;
			}
		} else matchedPath = true;
		
		if (matchedLayout && matchedYaml && matchedPath) {
			matched.push(docEntry);
		}
	}
	return matched;
};

var templCache = [];
module.exports.readTemplate = function(config, templName, done) {
    if (templCache.hasOwnProperty(templName)) {
        var templEntry = templCache[templName];
        fs.stat(templEntry.fullpath, function(err, stats) {
        	if (err) { 
        		logger.error('readTemplate FAIL '+ templName +' because '+ err);
        		done(err);
        	} else {
        		if ((stats.mtime - templEntry.stat.mtime) <= 0) {
        			// logger.trace('readTemplate returning cached '+ templName);
        			done(undefined, templEntry);
        		} else {
        			// logger.trace('readTemplate requires reloading '+ templName);
					delete templCache[templName];
					module.exports.readTemplate(config, templName, done);
        		}
        	}
        });
    } else {
    	find.templateAsync(config, templName, function(err, info) {
    		if (err) { logger.error(err); done(err); }
    		else {
    			fs.readFile(info.fullpath, 'utf8', function(err, text) {
    				if (err) { logger.error(err); done(err); }
    				else {
						var renderer = akasha.findRenderChain(templName);
						if (!renderer) {
							renderer = rendererNull.match(templName);
							renderer.renderSync = rendererNull.renderSync;
							renderer.render = rendererNull.render;
						}
						try {
							templCache[templName] = {
								type: "template",
								// The root_docs directory containing the file
								rootdir: info.rootdir,
								// The relative pathname within rootdir
								path: info.path,
								// The absolute pathname for the file
								fullpath: info.fullpath,
								stat: info.stat,
								renderedFileName: renderer.renderedFileName,
								fileExt: renderer.extension,
								renderer: renderer,
								isdir: false,
								frontmatter: extractFrontmatter(text),
								data: text
							};
							// logger.trace('readTemplate returning newly read '+ docName);
							done(undefined, templCache[templName]);
						} catch (e) {
							logger.error(e);
							done(e);
						}
    				}
    			});
    		}
    	});
    }
};

// This function doesn't seem to be used - do we need to keep it around?
var partialCache = [];
module.exports.readPartial = function(config, partialName, done) {
    if (partialCache.hasOwnProperty(partialName)) {
        var partialEntry = partialCache[partialName];
        fs.stat(partialEntry.fullpath, function(err, stats) {
        	if (err) { 
        		logger.error('readPartial FAIL '+ partialName +' because '+ err);
        		done(err);
        	} else {
        		if ((stats.mtime - partialEntry.stat.mtime) <= 0) {
        			// logger.trace('readPartial returning cached '+ partialName);
        			done(undefined, partialEntry);
        		} else {
        			// logger.trace('readPartial requires reloading '+ partialName);
					delete partialCache[partialName];
					module.exports.readPartial(config, partialName, done);
        		}
        	}
        });
    } else {
    	find.partialAsync(config, partialName, function(err, partialEntry) {
			if (err) { logger.error(err); done(err); }
			else {
    			fs.readFile(partialEntry.fullpath, 'utf8', function(err, text) {
    				if (err) { logger.error(err); done(err); }
    				else {
						var renderer = akasha.findRenderChain(partialName);
						if (!renderer) {
							renderer = rendererNull.match(partialName);
							renderer.renderSync = rendererNull.renderSync;
							renderer.render = rendererNull.render;
						}
						try {
							partialCache[partialName] = {
								type: "template",
								// The root_docs directory containing the file
								rootdir: partialEntry.rootdir,
								// The relative pathname within rootdir
								path: partialEntry.path,
								// The absolute pathname for the file
								fullpath: partialEntry.fullpath,
								stat: partialEntry.stat,
								renderedFileName: renderer.renderedFileName,
								fileExt: renderer.extension,
								renderer: renderer,
								isdir: false,
								frontmatter: extractFrontmatter(text),
								data: text
							};
							// logger.trace('readPartial returning newly read '+ docName);
							done(undefined, partialCache[partialName]);
						} catch (e) {
							logger.error(e);
							done(e);
						}
					}
				});
			}
    	});
    }
};

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
 * Test whether a file name will be giving an HTML result, and requires layout processing
 **/
var supportedForHtml = module.exports.doLayoutProcessing = module.exports.supportedForHtml = function(fn) {
    if (module.exports.isSyncHtml(fn)
     // || module.exports.isASyncHtml(fn)
     /* || module.exports.isSyncPHP(fn)
     || module.exports.isASyncPHP(fn)
	 || fn.match(/.php$/) */)
        return true;
    else
        return false;
};

module.exports.renderedFileName = function(fileName) {
	var renderer = akasha.findRenderChain(fileName);
	return renderer ? renderer.renderedFileName : fileName;

    /* if (supportedForHtml(fileName) || fileName.match(/\.css\.less$/)) {
        var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
        return fnparts[1];
    } else {
        return fileName;
    } */
};

module.exports.isSyncPHP = function(fn) {
  return fn.match(/\.php\.ejs$/);
};

module.exports.isSyncHtml = function(fn) {
  return fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/);
};

module.exports.isHtml = function(fn) {
  return fn.match(/\.html$/);
};

module.exports.isIndexHtml = function(fn) {
    return path.basename(fn).indexOf("index.html") === 0 && supportedForHtml(fn);
};
