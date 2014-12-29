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

var async      = require('async');
var util       = require('util');
var url        = require('url');
var spawn      = require('child_process').spawn;
var exec       = require('child_process').exec;
var find       = require('./lib/find');
var renderer   = require('./lib/renderer2');
var mahabhuta  = require('./lib/mahabhuta');
var fs         = require('fs-extra');
var path       = require('path');
var fileCache  = require('./lib/fileCache');
var smap       = require('sightmap');
var RSS        = require('rss');
// var minify     = require('minify');
var filewalker = require('filewalker');
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

	// Configure all the modules - primarily so they can get logger support
	
    fileCache.config(module.exports, config);
    find.config(module.exports, config);
    renderer.config(module.exports, config);
    mahabhuta.config(module.exports, config);
    
    // Pull in any plugins to extend AkashaCMS
    // We allow either a String to give the name of the plugin,
    // or a module that is the plugin.  This controls where the 
    // require statement occurs.
    //
    // string: The require is done here, and done relative to where
    //    AkashaCMS is installed.  That means the module reference
    //    is relative to AkashaCMS.
    // module: The require is performed inside config.js, meaning the 
    //    module reference is done there.
    
    for (var i = 0; config.plugins && i < config.plugins.length; i++) {
        var pl = config.plugins[i];
        var plugin;
        if (typeof pl === 'string')
            plugin = require(pl);
        else
            plugin = pl;
        plugin.config(module.exports, config);
    }
    
    // Then give the configuration file a shot at extending us
    if (config.config) {
        config.config(module.exports);
    }
    
    // Make the builtin plugin the last on the chain
    var builtin = path.join(__dirname, 'builtin');
    require(path.join(builtin, 'index')).config(module.exports, config);
    
    // logger.trace(util.inspect(config));
    
    return module.exports;
};

module.exports.getLogger = function(category) {
	return category ? log4js.getLogger(category) : log4js.getLogger();
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
                    else done();
                });
            }
        });
    };
    
    var copyAssets = function(done) {
        async.forEachSeries(options.root_assets,
            function(assetdir, next) {
                logger.info('copy assetdir ' + assetdir + ' to ' + options.root_out);
                /*fs.copy(assetdir, options.root_out, function(err) {
                    if (err) next(err);
                    else next();
                });*/
                
                filewalker(assetdir)
                	.on('file', function(fname, stats) {
                		logger.trace('..... '+ fname);
                		var fnCopyFrom = path.join(assetdir, fname);
                		var fnCopyTo   = path.join(options.root_out, fname);
                		var dirCopyTo  = path.dirname(fnCopyTo);
                		fs.mkdirs(dirCopyTo, function(err) {
                			if (err) { logger.error(err); }
                			else {
                				fs.copy(fnCopyFrom, fnCopyTo, function(err) {
                					if (err) logger.error(err);
                				});
                				/* 
								var rd = fs.createReadStream(fnCopyFrom);
								rd.on("error", function(err) {
									logger.error(err);
								});
								var wr = fs.createWriteStream(fnCopyTo);
								wr.on("error", function(err) {
									logger.error(err);
								});
								wr.on("close", function(ex) {
									// done();
								});
								rd.pipe(wr);
                				*/
                			}
                		});
                	})
                	.on('error', function(err) {
                		logger.error(err);
                	})
                	.on('done', function() {
                		next();
                	})
                .walk();
            },
            function(err) {
                if (err) done(err);
                else done();
            });
    };
    
    cleanDir(function(err) {
        if (err) throw new Error(err);
        else {
            copyAssets(function(err) {
                if (err) callback(err);
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

module.exports.partial = function(name, metadata, callback) {
    renderer.partial(name, metadata, callback);
};

module.exports.partialSync = function(name, metadata, callback) {
    // logger.trace('akasha exports.partialSync '+ name);
    return renderer.partialSync(name, metadata, callback);
};

module.exports.renderFile = function(options, fileName, callback) {
    if (fileName.charAt(0) === '/') {
        fileName = fileName.substr(1);
    }
    renderer.config(module.exports, options);
	// logger.trace('renderFile before readDocument '+ fileName);
    fileCache.readDocument(options, fileName, function(err, entry) {
    	if (err) callback(err);
		else if (!entry) callback(new Error('File '+fileName+' not found'));
		else {
			// logger.trace('renderFile before rendering '+ fileName);
			if (fileCache.supportedForHtml(entry.path)) {
				process2html(options, entry, callback);
			} else if (entry.path.match(/\.css\.less$/)) {
				// render .less files; rendered.fname will be xyzzy.css
				render_less(options, entry, callback);
			} else {
				// for anything not rendered, simply copy it
				copy_to_outdir(options, entry, callback);
			}
		}
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

module.exports.gatherDir = function(config, docroot, done) {
    logger.info('******** gatherDir START '+ docroot);
    var filez = [];
    filewalker(docroot, { maxPending: 1, maxAttempts: 3, attemptTimeout: 3000 })
    .on('file', function(path, s, fullPath) {
        logger.trace(docroot + ' FILE ' + path + ' ' + fullPath);
        filez.push({ 
        	docroot: docroot,
        	path: path,
        	stats: s,
        	fullPath: fullPath
        });
    })
    .on('error', function(err) {
        logger.error('gatherDir ERROR '+ docroot +' '+ err);
        done(err);
    })
    .on('done', function() {
    	async.eachSeries(filez,
			function(fnpath, next) {
				// logger.trace('gatherDir about to read '+ util.inspect(fnpath));
				fileCache.readDocument(config, fnpath.path, function(err, docEntry) {
					if (!err && docEntry) config.gatheredDocuments.push(docEntry);
					if (err) logger.error(err);
					next();
				});
			},
			function(err) {
				logger.info('gatherDir DONE '+ docroot +' '+ config.gatheredDocuments.length);
				done();
			});
    })
    .walk();
};

var gather_documents = module.exports.gather_documents = function(config, done) {
    config.gatheredDocuments = [];
    async.eachSeries(config.root_docs,
        function(docroot, cb) {
            module.exports.gatherDir(config, docroot, function(err) {
                if (err) { logger.error(err); cb(err); } else cb();
            });
        },
        function(err) {
            var entryCount = 0;
            for (var docNm in config.gatheredDocuments) { entryCount++; }
            logger.info('gather_documents DONE count='+ entryCount +' length='+ config.gatheredDocuments.length);
            if (err) { logger.error(err);  done(err); } else done();
        });
};

var config2renderopts = function(config, entry) {
	
	// Start with a base object that will be passed into the template
	var renderopts = { };
	// Copy data from frontmatter
	for (var yprop in entry.frontmatter.yaml) {
		renderopts[yprop] = entry.frontmatter.yaml[yprop];
	}
	renderopts.content = "";
	renderopts.documentPath = entry.path; 
	// Copy in any data or functions passed to us
	if ('data' in config) {
		for (var prop in config.data) {
			renderopts[prop] = config.data[prop];
		}
	}
	if ('funcs' in config) {
		for (var fprop in config.funcs) {
			renderopts[fprop] = config.funcs[fprop];
		}
	}
	renderopts.root_url = config.root_url;
	if (! renderopts.rendered_date) {
		renderopts.rendered_date = entry.stat.mtime;
	}
	
	if (!renderopts.publicationDate) {
		var dateSet = false;
		if (entry.frontmatter.yaml && entry.frontmatter.yaml.publDate) {
			var parsed = Date.parse(entry.frontmatter.yaml.publDate);
			if (! isNaN(parsed)) {
			  renderopts.publicationDate = new Date(parsed);
			}
			dateSet = true;
		}
		if (! dateSet && entry.stat && entry.stat.mtime) {
			renderopts.publicationDate = entry.stat.mtime;
		}
		if (!renderopts.publicationDate) {
			renderopts.publicationDate = new Date();
		}
	}
	
	renderopts.rendered_url = path.join(config.root_url, entry.renderedFileName); 
	
	return renderopts;
};

/**
 * For files that are processed into an HTML, run the processing.
 **/
var process2html = function(options, entry, done) {
    logger.trace('process2html #1 '+ entry.path); // util.inspect(entry));
    if (! fileCache.supportedForHtml(entry.path)) {
        done(new Error('UNKNOWN template engine for ' + entry.path));
    } else {
        var renderopts = config2renderopts(options, entry);
        
        logger.trace('process2html #2 '+ entry.path); //  +' '+ util.log(util.inspect(renderopts)));
        renderer.render(module.exports, options, entry, undefined, renderopts, function(err, rendered) {
            logger.trace('***** DONE RENDER ' + entry.path); // util.inspect(rendered));
            if (err) {
            	logger.error('Rendering '+ entry.path +' failed with '+ err);
            	done('Rendering '+ entry.path +' failed with '+ err);
            } else {
                var renderTo = path.join(options.root_out, rendered.fname);
                dispatcher('file-rendered', options, entry.path, renderTo, rendered, function(err) {
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
                                            logger.error("WARNING WARNING Bad date provided "+ entry.frontmatter.yaml.publDate);
                                        } else {
                                            atime = mtime = new Date(parsed);
                                        }
                                    }
                                    fs.utimes(renderTo, atime, mtime, function(err) {
                                        add_sitemap_entry(options.root_url +'/'+ rendered.fname, 0.5, mtime);
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
    fs.mkdirs(path.dirname(entry.path), function(err) {
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

module.exports.oembedRender = function(arg, callback) {
    return renderer.oembedRender(arg, callback);
};

module.exports.findAssetAsync = function(config, fileName, done) {
    find.assetFile(config, fileName, done);
};

// module.exports.findDocument = function(config, fileName) {
//     return find.document(config, fileName);
// };

module.exports.findDocumentAsync = function(config, fileName, done) {
    find.documentAsync(config, fileName, done);
};

module.exports.findDocumentForUrlpath = function(config, urlpath) {
    return fileCache.documentForUrlpath(config, urlpath);
};

// module.exports.findTemplate = function(config, fileName) {
//     return find.template(config, fileName);
// };

module.exports.findTemplateAsync = function(config, fileName, done) {
    find.templateAsync(config, fileName, done);
};

// module.exports.findPartial = function(config, fileName) {
//     return find.partial(config, fileName);
// };

module.exports.findPartialAsync = function(config, fileName, done) {
    find.partialAsync(config, fileName, done);
};

// module.exports.readTemplateEntry = function(config, fileName, done) {
//     fileCache.readTemplate(config, fileName, done);
// };

// module.exports.readPartialEntry = function(config, fileName, done) {
//     fileCache.readPartial(config, fileName, done);
// };

module.exports.readDocumentEntry = function(config, fileName, done) {
    fileCache.readDocument(config, fileName, done);
};

module.exports.updateDocumentData = function(config, docEntry, metadata, content, cb) {
    fileCache.updateDocumentData(config, docEntry, metadata, content, cb);
};

module.exports.createDocument = function(config, rootdir, path, metadata, content, cb) {
    fileCache.createDocument(config, rootdir, path, metadata, content, cb);
};

module.exports.deleteDocumentForUrlpath = function(config, path, cb) {
    fileCache.deleteDocumentForUrlpath(config, path, cb);
};

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

module.exports.eachDocument = function(config, doccb) {
    fileCache.eachDocument(config, doccb);
};

module.exports.indexChain = function(config, fileName) {
	return fileCache.indexChain(config, fileName);
};

module.exports.isSyncHtml = function(fn) {
    return fileCache.isSyncHtml(fn);
};

module.exports.isASyncHtml = function(fn) {
    return fileCache.isASyncHtml(fn);
};

module.exports.isHtml = function(fn) {
    return fileCache.isHtml(fn);
};

module.exports.supportedForHtml = function(fn) {
    return fileCache.supportedForHtml(fn);
};

module.exports.isIndexHtml = function(fn) {
    return fileCache.isIndexHtml(fn);
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

var generate_sitemap = function(options, done) {
    // util.log('generate_sitemap ' + util.inspect(rendered_files));
    smap(rendered_files);
    smap(function(xml) {
        fs.writeFile(options.root_out +"/sitemap.xml", xml, 'utf8', function (err) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });
};
