/**
 *
 * Copyright 2012-2015 David Herron
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

var async      = require('async');
var util       = require('util');
var url        = require('url');
var http       = require('http');
var mime       = require('mime');
var spawn      = require('child_process').spawn;
var exec       = require('child_process').exec;
var find       = require('./lib/find');
var renderer   = require('./lib/renderer2');
var mahabhuta  = require('./lib/mahabhuta');
var oembed     = require('oembed');
var fs         = require('fs-extra');
var globfs     = require('globfs');
var path       = require('path');
var fileCache  = require('./lib/fileCache');
var smap       = require('sightmap');
var RSS        = require('rss');
var request    = require('request');
// var minify     = require('minify');
var log4js     = require('log4js');
var logger;

module.exports.mahabhuta = mahabhuta;

var config;

module.exports.config = function(_config) {
	config = _config;
	
	// Set up logging support
	
	if (config.log4js) {
		log4js.configure(config.log4js);
	} else {
		log4js.configure({
			appenders: [
				{ type: "console" }
			],
			replaceConsole: true,
			"levels": {
				"[all]": "INFO"
			}
		});
	}

	logger = module.exports.getLogger("akashacms");
	
	// Initialize a Mahabhuta array if one wasn't set up
	if (! config.mahabhuta) {
		config.mahabhuta = [];
	}

	// Configure all the modules - primarily so they can get logger support
	
    fileCache.config(module.exports, config);
    find.config(module.exports, config);
    renderer.config(module.exports, config);
    mahabhuta.config(module.exports, config);
    
    // Then give the configuration file a shot at extending us
	// This will cause any plugins to load, when the config function calls requirePlugins
    if (config.config) {
        config.config(module.exports);
    }
    
    // Make the builtin plugin the last on the chain
    var builtin = path.join(__dirname, 'builtin');
    module.exports.registerPlugins(config, [
		{ name: 'builtin', plugin: require(path.join(builtin, 'index')) }
	]); //.config(module.exports, config);
    
    // logger.trace(util.inspect(config));
    
    return module.exports;
};

/**
 * getLogger - initialize a logger object, so that each plugin can have its own logger.
 */
module.exports.getLogger = function(category) {
	return category ? log4js.getLogger(category) : log4js.getLogger();
};

/**
 * registerPlugins - go through plugins array, adding each to the plugins array in
 * the config file, then calling the config function of each plugin.
 */
module.exports.registerPlugins = function(config, plugins) {
	if (typeof config.plugins === 'undefined' || ! config.plugins) {
		config.plugins = [];
	}
	
	plugins.forEach(function(pluginObj) {
		if (typeof pluginObj.plugin === 'string') {
			pluginObj.plugin = require(pluginObj.plugin);
		}
		config.plugins.push(pluginObj);
		pluginObj.plugin.config(module.exports, config);
		
		if (pluginObj.plugin.mahabhuta) {
			module.exports.registerMahabhuta(config, pluginObj.plugin.mahabhuta);
		}
	});
	
	return module.exports;
};

module.exports.registerMahabhuta = function(config, mahafuncs) {
	if (! config.mahabhuta) config.mahabhuta = [];
	
	mahafuncs.forEach(function(mahafunc) {
		config.mahabhuta.push(mahafunc);
	});
	
	return module.exports;
};

/**
 * plugin - Look for a plugin, returning its module reference.
 */
module.exports.plugin = function(name) {
	if (! config.plugins) {
		throw new Error('Configuration has no plugins');
	}
	var plugin;
	config.plugins.forEach(function(pluginObj) {
		if (pluginObj.name === name) {
			plugin = pluginObj.plugin;
		}
	});
	return plugin;
};


module.exports.copyAssets = function(config, done) {
	logger.trace('copyAssets START');

	globfs.copy(config.root_assets, [ "**/*", '**/.*/*', '**/.*' ], config.root_out, {},
		function(err) {
			if (err) { logger.error(err); done(err); }
			else { logger.trace('copyAssets FINI '); done(); }
		});

};

module.exports.process = function(options, callback) {
    var cleanDir = function(done) {
        logger.info('removing ' + options.root_out);
        fs.remove(options.root_out, function(err) {
            if (err) done(err);
            else {
                logger.info('making empty ' + options.root_out);
                fs.mkdirs(options.root_out, function(err) {
                    if (err) done(err);
                    else { logger.trace('cleanDir FINI'); done(); }
                });
            }
        });
    };
    
    cleanDir(function(err) {
        if (err) { logger.error(err); callback(new Error(err)); }
        else {
            module.exports.copyAssets(options, function(err) {
                if (err) { logger.error('copyAssets done '+ err); callback(err); }
                else {
                    gather_documents(options, function(err, data) {
                        // util.log('gather_documents CALLBACK CALLED');
                        if (err) callback(err);
                        else {
                            var entryCount = 0;
                            for (var docNm in options.gatheredDocuments) {
                                // util.log('DOCUMENT '+ options.gatheredDocuments[docNm].path);
                                entryCount++;
                            }
                            logger.info('process '+ options.gatheredDocuments.length +' entries count='+entryCount);
                            process_and_render_files(options, function(err) {
                                if (err) callback(err);
                                else {
                                    generate_sitemap(options, function(err) {
                                        if (err) callback(err);
                                        else {
                                            if (options.doMinimize) {
                                                module.exports.minimize(options, function(err) {
                                                    if (err) callback(err);
                                                    else callback();
                                                });
                                            } else callback();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

module.exports.partial = renderer.partial;

module.exports.partialSync = renderer.partialSync;

var renderDocEntry = function(config, docEntry, done) {
	// logger.trace('renderFile before rendering '+ fileName);
	if (fileCache.supportedForHtml(docEntry.path)) {
		process2html(config, docEntry, done);
	} else if (docEntry.path.match(/\.css\.less$/)) {
		// render .less files; rendered.fname will be xyzzy.css
		render_less(config, docEntry, done);
	} else {
		// for anything not rendered, simply copy it
		copy_to_outdir(config, docEntry, done);
	}
};

module.exports.renderFile = function(config, fileName, callback) {
    if (fileName.charAt(0) === '/') {
        fileName = fileName.substr(1);
    }
    renderer.config(module.exports, config);
	logger.trace('renderFile before readDocument '+ fileName);
    fileCache.readDocument(config, fileName, function(err, docEntry) {
    	if (err) callback(err);
		else if (!docEntry) callback(new Error('File '+fileName+' not found'));
		else renderDocEntry(config, docEntry, callback);
    });
};

/**
 * Minimize a directory tree using the minify library.
 **/
module.exports.minimize = function(options, done) {
	done();
	
	/*
    filewalker(options.root_out, { maxPending: 1, maxAttempts: 3, attemptTimeout: 3000 })
    .on('file', function(path, s, fullPath) {
        if (fullPath.match(/\.js$/) || fullPath.match(/\.html$/) || fullPath.match(/\.css$/)) {
            var stat = fs.statSync(fullPath);
            // util.log("Minimizing " + fullPath);
            minify.optimize([fullPath], {
                cache: true,
                callback: function(pMinData) {
                    // util.log("Writing Minimized file " + fullPath);
                    fs.writeFile(fullPath, pMinData, 'utf8', function (err) {
                        if (err) done(err);
                        else {
                            fs.utimes(fullPath, stat.atime, stat.mtime, function(err) {
                                if (err)
                                    done(err);
                                else
                                    done();
                            });
                        }
                    });
                }
            });
        }
    })
    .on('error', function(err) {
        if (err) done(err);
        else { done(); } 
    })
    .walk(); */
};

var gather_documents_new = function(config, done) {
	globfs.operate(config.root_docs, [ '**/*', '**/.*/*', '**/.*' ],
		function(basedir, fpath, fini) { fini(null, fpath); },
		function(err, results) {
			if (err) done(err);
			else done(null, results);
		});
};

module.exports.gatherDir = function(config, docroot, done) {
    logger.info('******** gatherDir START '+ docroot);
    
    globfs.operate([ docroot ], [ '**/*', '**/.*/*', '**/.*' ],
    	function(basedir, fpath, fini) {
    		var fullPath = path.join(basedir, fpath);
    		fs.stat(fullPath, function(err, stats) {
    			if (err) { logger.error(err); fini(); }
    			else {
    				logger.trace(basedir + ' FILE ' + fpath + ' ' + fullPath);
    				if (stats.isFile()) {
						fini(null, {
							docroot: basedir,
							path: fpath,
							stats: stats,
							fullPath: fullPath
						});
    				} else fini();
    			}
    		});
    	},
    	function(err, results) {
    		async.eachLimit(results, 10,
    			function(result, next) {
	    			// logger.trace('gatherDir about to read '+ util.inspect(result));
					fileCache.readDocument(config, result.path, function(err, docEntry) {
						if (!err && docEntry) config.gatheredDocuments.push(docEntry);
						if (err) logger.error('gatherDir readDocument '+ err);
						next();
					});
    			},
    			function(err) {
					logger.info('gatherDir DONE '+ docroot +' '+ config.gatheredDocuments.length);
					done();
    			});
    	});
};

var gather_documents = module.exports.gather_documents = function(config, done) {
	logger.info('********** gather_documents');
    config.gatheredDocuments = [];
    async.eachSeries(config.root_docs,
        function(docroot, cb) {
            module.exports.gatherDir(config, docroot, function(err) {
                if (err) { logger.error('gather_documents '+ err); cb(err); } else cb();
            });
        },
        function(err) {
            var entryCount = 0;
            for (var docNm in config.gatheredDocuments) { entryCount++; }
            logger.info('gather_documents DONE count='+ entryCount +' length='+ config.gatheredDocuments.length);
            if (err) { logger.error('gather_documents done '+ err);  done(err); } else done();
        });
};

var config2renderopts = function(config, entry) {
	
	// Start with a base object that will be passed into the template
	var metadata = { };
	// Copy data from frontmatter
	for (var yprop in entry.frontmatter.yaml) {
		metadata[yprop] = entry.frontmatter.yaml[yprop];
	}
	metadata.content = "";
	metadata.documentPath = entry.path; 
	// Copy in any data or functions passed to us
	if ('data' in config) {
		for (var prop in config.data) {
			metadata[prop] = config.data[prop];
		}
	}
	if ('funcs' in config) {
		for (var fprop in config.funcs) {
			metadata[fprop] = config.funcs[fprop];
		}
	}
	metadata.root_url = config.root_url;
	if (! metadata.rendered_date) {
		metadata.rendered_date = entry.stat.mtime;
	}
	
	if (!metadata.publicationDate) {
		var dateSet = false;
		if (entry.frontmatter.yaml && entry.frontmatter.yaml.publDate) {
			var parsed = Date.parse(entry.frontmatter.yaml.publDate);
			if (! isNaN(parsed)) {
			  metadata.publicationDate = new Date(parsed);
			}
			dateSet = true;
		}
		if (! dateSet && entry.stat && entry.stat.mtime) {
			metadata.publicationDate = entry.stat.mtime;
		}
		if (!metadata.publicationDate) {
			metadata.publicationDate = new Date();
		}
	}
	
	var pRootUrl = url.parse(config.root_url);
	pRootUrl.pathname = entry.renderedFileName;
	metadata.rendered_url = url.format(pRootUrl);
	
	metadata.plugin = module.exports.plugin;
	
	return metadata;
};

/**
 * For files that are processed into an HTML, run the processing.
 **/
var process2html = function(config, entry, done) {
    logger.trace('process2html #1 '+ entry.path); // util.inspect(entry));
    if (! fileCache.supportedForHtml(entry.path)) {
        done(new Error('UNKNOWN template engine for ' + entry.path));
    } else {
        var metadata = config2renderopts(config, entry);
        
        logger.trace('process2html #2 '+ entry.path); //  +' '+ util.log(util.inspect(renderopts)));
        renderer.render(module.exports, config, entry, undefined, metadata, function(err, rendered) {
            logger.trace('***** DONE RENDER ' + entry.path); // util.inspect(rendered));
            if (err) {
            	logger.error('Rendering '+ entry.path +' failed with '+ err);
            	done('Rendering '+ entry.path +' failed with '+ err);
            } else {
                var renderTo = path.join(config.root_out, rendered.fname);
                dispatcher('file-rendered', config, entry.path, renderTo, rendered, function(err) {
                    // TBD - the callback needs to send a new rendering 
                    if (err) done('Rendering file-rendered '+ entry.path +' failed with '+ err);
                    else {
                        logger.info('rendered '+ entry.path +' as '+ renderTo);
                        fs.mkdirs(path.dirname(renderTo), function(err) {
                            if (err) done('FAILED to make directory '+ path.dirname(renderTo) +' failed with '+ err); 
                            else fs.writeFile(renderTo, rendered.content, 'utf8', function (err) {
                                if (err) done(err);
                                else {
                                    var atime = entry.stat.atime;
                                    var mtime = entry.stat.mtime;
                                    if (entry.frontmatter.yaml && entry.frontmatter.yaml.publDate) {
                                        var parsed = Date.parse(entry.frontmatter.yaml.publDate);
                                        if (isNaN(parsed)) {
                                            logger.warn("WARNING WARNING Bad date provided "+ entry.frontmatter.yaml.publDate);
                                            atime = mtime = new Date();
                                        } else {
                                            atime = mtime = new Date(parsed);
                                        }
                                    }
                                    fs.utimes(renderTo, atime, mtime, function(err) {
                                        add_sitemap_entry(config.root_url +'/'+ rendered.fname, 0.5, mtime);
                                        done();
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
    }
};

var copy_to_outdir = function(options, entry, done) {
    // for anything not rendered, simply copy it
    var renderTo = path.join(options.root_out, entry.path);
    // util.log('copy_to_outdir renderTo='+ renderTo +' entry.path='+ entry.path);
    fs.mkdirs(path.dirname(renderTo), function(err) {
        if (err) done(err); 
        else fs.copy(entry.fullpath, renderTo, function(msg) {
            fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
                /*if (err) done(err);
                else*/ done();
            });
        });
    });
};

var render_less = function(options, entry, done) {
    renderer.renderLess(entry.path, function(err, rendered) {
        if (err) done(err);
        else {
            var renderTo = path.join(options.root_out, rendered.fname);
            fs.mkdirs(path.dirname(rendered.fname), function(err) {
                if (err) done(err);
                else fs.writeFile(renderTo, rendered.css, 'utf8', function (err) {
                    if (err) done(err);
                    else {
                        fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
                            if (err) done(err);
                            else done();
                        });
                    }
                });
            });
        }
    });
};

var process_and_render_files = function(config, done) {
    dispatcher('before-render-files', function(err) {
        var entryCount = 0;
        logger.trace('process_and_render_files '+ config.gatheredDocuments.length +' entries');
        for (docNm in config.gatheredDocuments) {
            logger.trace('DOCUMENT '+ config.gatheredDocuments[docNm].path);
            entryCount++;
        }
        logger.info('process_and_render_files entryCount='+ entryCount);
        entryCount = 0;
        async.eachSeries(config.gatheredDocuments,
        function(entry, cb) {
            entryCount++;
            logger.info('FILE '+ entryCount +' '+ entry.path);
            if (fileCache.supportedForHtml(entry.path)) {
                process2html(config, entry, cb);
            } else if (entry.path.match(/\.css\.less$/)) {
                // render .less files; rendered.fname will be xyzzy.css
                render_less(config, entry, cb);
            } else {
                // for anything not rendered, simply copy it
                copy_to_outdir(config, entry, cb);
            }
        },
        function(err) {
            logger.info('***** process_and_render_files saw count='+ entryCount);
            dispatcher('done-render-files');
            if (err) done(err); else done();
        });
    });
    
};

module.exports.oEmbedData = function(url, callback) {
  oembed.fetch(url, { maxwidth: 6000 }, callback);
};

module.exports.findAssetAsync = find.assetFile;

// module.exports.findDocument = function(config, fileName) {
//     return find.document(config, fileName);
// };

module.exports.findDocumentAsync = find.documentAsync;

module.exports.findDocumentForUrlpath = fileCache.documentForUrlpath;

// module.exports.findTemplate = function(config, fileName) {
//     return find.template(config, fileName);
// };

module.exports.findTemplateAsync = find.templateAsync;

// module.exports.findPartial = function(config, fileName) {
//     return find.partial(config, fileName);
// };

module.exports.findPartialAsync = find.partialAsync;

// module.exports.readTemplateEntry = function(config, fileName, done) {
//     fileCache.readTemplate(config, fileName, done);
// };

// module.exports.readPartialEntry = function(config, fileName, done) {
//     fileCache.readPartial(config, fileName, done);
// };

module.exports.readDocumentEntry = fileCache.readDocument;

module.exports.updateDocumentData = fileCache.updateDocumentData;

module.exports.createDocument = fileCache.createDocument;

module.exports.deleteDocumentForUrlpath = fileCache.deleteDocumentForUrlpath;

/* module.exports.findSiblings = function(config, fileName, done) {
    var bnm   = path.basename(fileName);
    var dirname = path.dirname(fileName);
    fileCache.readDocument(config, fileName, function(err, entry) {
    	if (err) done(err);
    	else {
			var entries = [];
			var filedir = path.dirname(fileName);
			var dirnm = path.dirname(entry.fullpath);
			var fnames = fs.readdirSync(dirnm);
			async.each(fnames,
				function(err, fn, cb) {
					var fpath = path.join(filedir, fn);
					if (fileCache.supportedForHtml(fpath)) {
						fileCache.readDocument(config, fpath, function(err, docEntry) {
							if (err) cb(err);
							else entries.push(docEntry);
						});
					}
				},
				function(err) {
					if (err) done(err);
					else done(undefined, entries);
				});
    	}
    });
}; */

module.exports.urlForFile = function(fileName) {
    return '/'+ fileCache.renderedFileName(fileName);
};

module.exports.eachDocument = fileCache.eachDocument;

module.exports.indexChain = fileCache.indexChain;

module.exports.isSyncHtml = fileCache.isSyncHtml;

module.exports.isASyncHtml = fileCache.isASyncHtml;

module.exports.isHtml = fileCache.isHtml;

module.exports.supportedForHtml = fileCache.supportedForHtml;

module.exports.isIndexHtml = fileCache.isIndexHtml;

///////////////// Preview built website

var streamit = function(res, fname, stats) {
	var m = mime.lookup(fname);
	res.writeHead(200, {
		'Content-Type':  m,
		'Content-Length': stats.size
	});
	var readStream = fs.createReadStream(fname);
	readStream.on('error', function(err) {
		res.end();
	});
	readStream.pipe(res);
};

module.exports.runPreviewServer = function(config) {
	var server = http.createServer(function (req, res) {
		var requrl = url.parse(req.url, true);
		logger.info(req.method +' '+ req.url);
		var fname = path.join(config.root_out, requrl.pathname);
		fs.stat(fname, function(err, stats) {
			if (err) {
				res.statusCode = 404;
				res.end();
			} else {
				if (stats.isDirectory()) {
					if (requrl.pathname.match(/[^\/]$/)) requrl.pathname += '/';
					requrl.pathname += 'index.html';
					res.setHeader('Location', url.format(requrl));
					res.statusCode = 302;
					res.end();
				} else if (stats.isFile()) {
					if (requrl.pathname.match(/\.html$/i)) {
						var docEntrie = fileCache.documentForUrlpath(config, requrl.pathname);
						if (docEntrie) {
							fileCache.readDocument(config, docEntrie.path, function(err, docEntry) {
								if (err) {
									res.statusCode = 500;
									res.end(err);
								} else if ((stats.mtime - docEntry.stat.mtime) < 0) {
									renderDocEntry(config, docEntry, function(err) {
										if (err) {
											res.statusCode = 500;
											res.end(err);
										} else {
											fs.stat(fname, function(err, stats2) {
												streamit(res, fname, stats2);
											});
										}
									});
								} else streamit(res, fname, stats);
							});
						} else streamit(res, fname, stats);
					} else streamit(res, fname, stats);
				} else {
					res.statusCode = 404;
					res.end();
				}
			}
		});
	});
	
	server.listen(6080);
};

///////////////// Deployment of Sites

module.exports.deployViaRsync = function(config) {
	var user = config.deploy_rsync.user;
	var host = config.deploy_rsync.host;
	var dir  = config.deploy_rsync.dir;
	var nargv = [];
	nargv.push('--verbose');
	nargv.push('--archive');
	nargv.push('--delete');
	nargv.push('--compress');
	// if (options.force) 
	if (config.deploy_rsync.exclude) {
		nargv.push('--exclude');
		nargv.push(config.deploy_rsync.exclude);
	}
	if (config.deploy_rsync.excludeFile) {
		nargv.push('--exclude-from');
		nargv.push(config.deploy_rsync.excludeFile);
	}
	nargv.push(config.root_out+'/');
	nargv.push(user+'@'+host+':'+dir+'/');
	logger.info('deploy Via Rsync '+ util.inspect(nargv));
	return spawn('rsync', nargv, {env: process.env, stdio: ['pipe', 'pipe', 'pipe']});
};

///////////////// RSS Feed Generation

module.exports.generateRSS = function(config, feedData, items, renderTo, done) {

	// logger.trace('generateRSS '+ renderTo);

	// Construct initial rss object
	var rss = {};
    for (var key in config.rss) {
        if (config.rss.hasOwnProperty(key)) {
            rss[key] = config.rss[key];
        }
    }
    
    // Then fill in from feedData
    for (var key in feedData) {
        if (feedData.hasOwnProperty(key)) {
            rss[key] = feedData[key];
        }
    }
    
    var rssfeed = new RSS(rss);
    
    items.forEach(function(item) { rssfeed.item(item); });
    
    var xml = rssfeed.xml();
    var renderOut = path.join(config.root_out, renderTo);
    // logger.trace(renderOut +' ===> '+ xml);
    
	fs.mkdirs(path.dirname(renderOut), function(err) {
		if (err) logger.error(err);
		else {
			fs.writeFile(renderOut, xml, { encoding: 'utf8' },
				function(err2) {
					if (err2) { logger.error(err2); done(err2); }
					else done();
				});
		}
	});
};

///////////////// Event handling

// Set up an eventEmitter so we can tell other modules what's going on
var events = require('events');
var emitter = module.exports.emitter = new events.EventEmitter();

// The problem with using emitter.emit is that it doesn't call back
// to our code.  What we want is for the called handler to  
// notify us when it's done with the event handling.  This way AkashaCMS
// can act on things knowing that a plugin has done what it wants to do.
//
// The inspiration comes from the akashacms-tagged-content plugin
// which does a lot of stuff, such as generating a bunch of files that
// must be rendered

var dispatcher = function() {
    // Convert our arguments into an array to simplify working on the args
    var args = Array.prototype.slice.call(arguments);
    // logger.trace(util.inspect(args));
    // Arg1: eventName - MUST BE A STRING
    var eventName = args.shift();
    // logger.trace(eventName +' '+ util.inspect(args));
    if (typeof eventName !== 'string') { throw new Error('eventName must be a string'); }
    var handlers = emitter.listeners(eventName); // list of handler functions 
    // logger.trace(util.inspect(handlers));
    
    // Last argument: Optional callback function
    // If no callback is supplied, we provide one that if there's an error throws it
    var finalCB = undefined;
    if (args.length > 0 && typeof args[args.length - 1] === 'function') {
        finalCB = args.pop();
    } else {
        finalCB = function(err) {
            if (err) throw err;
        };
    }
    // If there happens to be no handlers, go ahead and call the callback
    if (handlers.length <= 0) {
        return finalCB();
    }
    
    var dispatchToHandler = function(handler, argz, callback) {
        logger.trace('dispatchToHandler '+ eventName +' '+ util.inspect(handler));
        if (!handler) {
            return callback();
        }
        var argv = [ ].concat(argz);
        argv.push(function(err) {
            if (err && !callback.called) {
                callback.called = true;
                callback(err);
            }
            callback();
        });
        return handler.apply(null, argv);
    };
        
    // Step through the array of handlers calling each in turn.
    
    var hi = 0;
    var handler = handlers[hi];
    
    var callNextHandler = function(argz) {
        dispatchToHandler(handler, argz, function(err) {
            logger.trace('DONE dispatchToHandler '+ err);
            if (err) {
                finalCB(err);
            } else {
                hi++;
                // util.log('hi '+ hi +' len '+ handlers.length);
                if (hi > handlers.length) finalCB();
                else {
                    handler = handlers[hi];
                    callNextHandler(argz);
                }
            }
        });
    };
    
    callNextHandler(args);
};

///////////////// XML Sitemap Generation .. works by building an array, then dumping it out in XML

var rendered_files = [];

var add_sitemap_entry = function(fname, priority, mtime) {
    // util.log('add_sitemap_entry ' + fname);
    var fDate = new Date(mtime);
    var mm = fDate.getMonth() + 1;
    if (mm < 10) {
        mm = "0" + mm.toString();
    } else {
        mm = mm.toString();
    }
    var dd = fDate.getDate();
    if (dd < 10) {
        dd = "0" + dd.toString();
    } else {
        dd = dd.toString();
    }
    rendered_files.push({
        loc: encodeURI(fname),
        priority: priority,
        lastmod:  fDate.getUTCFullYear() +"-"+ mm +"-"+ dd
    });
    /*
     * This lets us remove the 'index.html' portion of URL's submitted in the sitemap.
     * But we need to also ensure all links within the site pointing at this also do
     * not use 'index.html' in the URL.  Ugh.
     *if (fname.match(/index.html$/)) {
        rendered_files.push({loc: fname.replace(/index.html$/, ''), priority: priority});
    }*/
};

var generate_sitemap = function(config, done) {
    // util.log('generate_sitemap ' + util.inspect(rendered_files));
    smap(rendered_files);
    smap(function(xml) {
        fs.writeFile(config.root_out +"/sitemap.xml", xml, 'utf8', function (err) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });
};

module.exports.pingXmlSitemap = function(config, done) {
	// ask.com and duckduckgo.com both say they automatically spider and discover everything
	// and therefore don't support being pinged
	// pinging yahoo.com as shown below fails with a 404
	// pinging the /ping URL is per the sitemap protocol: http://www.sitemaps.org/protocol.html#submit_ping
	// However, if you yahoogle each search engine lists a different URL for sitemap submission.
	// It's also useful to add a line to robots.txt as it says on the above page
	//     sitemap: http://www.example.com/sitemap.xml
	async.eachSeries([
		"www.google.com", "www.yahoo.com", "www.bing.com"
	],
	function(hostname, next) {
		var url2ping = url.format({
			protocol: "http",
			hostname: hostname,
			pathname: "/ping",
			query: {
				sitemap: config.root_url +"/sitemap.xml"
			}
		});
		request.get(url2ping)
		.on('error', function(err) {
			next(err);
		})
		.on('response', function(result) {
			// console.log(util.inspect(result));
			console.log(url2ping +' '+ result.statusCode )
			next();
		});
	},
	function(err) {
		if (err) done(err);
		else done();
	})
};
