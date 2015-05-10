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
 **/

var async      = require('async');
var util       = require('util');
var url        = require('url');
var http       = require('http');
var mime       = require('mime');
var spawn      = require('child_process').spawn;
var exec       = require('child_process').exec;
var find       = require('./lib/find');
var renderer   = require('./lib/renderer2');
var mahabhuta  = require('mahabhuta');
var oembed     = require('oembed');
var fs         = require('fs-extra');
var globfs     = require('globfs');
var path       = require('path');
var archiver   = require('archiver');
var fileCache  = require('./lib/fileCache');
var RSS        = require('rss');
var request    = require('request');
var rendererCSSLess = require('./lib/renderer-cssless');
var rendererEjs = require('./lib/renderer-ejs');
var rendererHTML = require('./lib/renderer-html');
var rendererJSON = require('./lib/renderer-json');
var md         = require('./lib/md');
var sitemaps   = require('./lib/sitemaps');

var log4js     = require('log4js');
var logger;

module.exports.mahabhuta = mahabhuta;

var config;

module.exports.config = function(_config) {
	config = _config;
	
	logger = module.exports.getLogger("akashacms");
    
    module.exports.registerPlugins = registerPlugins.bind(_config);
    module.exports.eachPlugin = eachPlugin.bind(_config);
    module.exports.plugin = plugin.bind(_config);
    module.exports.registerRenderChain = registerRenderChain.bind(_config);
    module.exports.findRenderChain = findRenderChain.bind(_config);
    
    module.exports.copyAssets = copyAssets.bind(_config);
    module.exports.emptyRootOut = emptyRootOut.bind(_config);
    module.exports.process = process.bind(_config);
    module.exports.partialSync = partialSync.bind(_config);
    module.exports.partial = partial.bind(_config);
    module.exports.renderDocuments = renderDocuments.bind(_config);
    module.exports.renderDocument = renderDocument.bind(_config);
    module.exports.renderFile = renderFile.bind(_config);
    module.exports.gatherDir = gatherDir.bind(_config);
    
    module.exports.zipRenderedSite = zipRenderedSite.bind(_config);
    
    module.exports.runEditServer = runEditServer.bind(_config);
    module.exports.runPreviewServer = runPreviewServer.bind(_config);
    
    module.exports.deployViaRsync = deployViaRsync.bind(_config);
    
    module.exports.generateRSS = generateRSS.bind(_config);
    
    module.exports.pingXmlSitemap = pingXmlSitemap.bind(config);
    
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

	
	// Initialize a Mahabhuta array if one wasn't set up
	if (! config.mahabhuta) {
		config.mahabhuta = [];
	}

	// Configure all the modules - primarily so they can get logger support
	
    fileCache.config(module.exports, config);
    find.config(module.exports, config);
    renderer.config(module.exports, config);
	md.config(module.exports, config);
	sitemaps.config(module.exports, config);
	rendererJSON.config(module.exports, config);
    
    module.exports.findAssetAsync = find.assetFile;
    module.exports.findDocumentAsync = find.documentAsync;
    module.exports.findDocumentForUrlpath = fileCache.documentForUrlpath;
    module.exports.findMatchingDocuments = fileCache.findMatchingDocuments;
    module.exports.findTemplateAsync = find.templateAsync;
    module.exports.findPartialAsync = find.partialAsync;
    module.exports.readDocumentEntry = fileCache.readDocument;
    module.exports.updateDocumentData = fileCache.updateDocumentData;
    module.exports.createInMemoryDocument = fileCache.createInMemoryDocument;
    module.exports.createDocument = fileCache.createDocument;
    module.exports.deleteDocumentForUrlpath = fileCache.deleteDocumentForUrlpath;
    module.exports.eachDocument = fileCache.eachDocument;
    module.exports.eachDocumentAsync = fileCache.eachDocumentAsync;
    module.exports.indexChain = fileCache.indexChain;
    module.exports.isSyncHtml = fileCache.isSyncHtml;
    module.exports.isASyncHtml = fileCache.isASyncHtml;
    module.exports.isHtml = fileCache.isHtml;
    module.exports.supportedForHtml = fileCache.supportedForHtml;
    module.exports.isIndexHtml = fileCache.isIndexHtml;
    
    module.exports.generateSitemap = sitemaps.generateSitemap;
    
    // Then give the configuration file a shot at extending us
	// This will cause any plugins to load, when the config function calls registerPlugins
    if (config.config) {
        config.config(module.exports);
    }
    
    // Make the builtin plugin the last on the chain
    var builtin = path.join(__dirname, 'builtin');
    module.exports.registerPlugins([
		{ name: 'builtin', plugin: require(path.join(builtin, 'index')) }
	]);
	
	// Set up the default renderer modules
	[
	  rendererEjs.rendererEJS, rendererEjs.rendererEJSMD, md, rendererHTML,
	  rendererCSSLess, rendererJSON
	].forEach(function(renderer) {
		module.exports.registerRenderChain(renderer);
	});
    
	if (typeof config.headerScripts === "undefined") config.headerScripts = {};
	if (typeof config.headerScripts.javaScriptTop == "undefined") config.headerScripts.javaScriptTop = [];
	if (typeof config.headerScripts.javaScriptBottom == "undefined") config.headerScripts.javaScriptBottom = [];
    
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
function registerPlugins(plugins) {
	if (typeof this.plugins === 'undefined' || !this.hasOwnProperty("plugins") || ! this.plugins) {
		this.plugins = [];
	}
	var _config = this;
	
	plugins.forEach(function(pluginObj) {
		if (typeof pluginObj.plugin === 'string') {
			pluginObj.plugin = require(pluginObj.plugin);
		}
		_config.plugins.push(pluginObj);
		pluginObj.plugin.config(module.exports, _config);
		
		/* if (pluginObj.plugin.mahabhuta) {
		 *	registerMahabhuta(_config, pluginObj.plugin.mahabhuta);
		} */
	});
	
	return module.exports;
}

function eachPlugin(iterator, final) {
	async.eachSeries(this.plugins,
	function(plugin, next) {
		iterator(plugin.plugin, next);
	},
	final);
}

/* function registerMahabhuta(config, mahafuncs) {
 *	if (! config.mahabhuta) config.mahabhuta = [];
 *	
 *	mahafuncs.forEach(function(mahafunc) {
 *		config.mahabhuta.push(mahafunc);
 *	});
 *	
 *	return module.exports;
 * } */

/**
 * plugin - Look for a plugin, returning its module reference.
 */
function plugin(name) {
	if (! this.plugins) {
		throw new Error('Configuration has no plugins');
	}
	var ret;
	this.plugins.forEach(function(pluginObj) {
		if (pluginObj.name === name) {
			ret = pluginObj.plugin;
		}
	});
	return ret;
}

/**
 * Add a renderChain
 */
function registerRenderChain(renderChain) {
	if (! this.renderChains) this.renderChains = [];
	
	if ((renderChain.match && typeof renderChain.match === 'function')
	 && (
		(renderChain.renderSync && typeof renderChain.renderSync === 'function')
	 || (renderChain.render && typeof renderChain.render === 'function')
		)) {
		this.renderChains.push(renderChain);
	} else
		throw new Error('bad renderChain provided '+ util.inspect(renderChain));
	
	return module.exports;
}

/**
 * Find a renderChain based on a file name
 */
function findRenderChain(fname) {
	var fnameData;
	var renderChain;
	// logger.info('findRenderChain '+ fname);
	for (var i = 0; this.renderChains && i < this.renderChains.length; i++) {
		fnameData = this.renderChains[i].match(fname);
		if (fnameData !== null) {
			renderChain = this.renderChains[i];
			break;
		}
	}
	if (fnameData && renderChain) {
		fnameData.renderSync = renderChain.renderSync;
		fnameData.render = renderChain.render;
		if (renderChain.doLayouts) fnameData.doLayouts = renderChain.doLayouts;
		return fnameData;
	} else return null;
}

function pingXmlSitemap(done) {
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
				sitemap: this.root_url +"/sitemap.xml"
			}
		});
		request.get(url2ping)
		.on('error', function(err) {
			next(err);
		})
		.on('response', function(result) {
			// console.log(util.inspect(result));
			console.log(url2ping +' '+ result.statusCode );
			next();
		});
	},
	function(err) {
		if (err) done(err);
		else done();
	});
}
function copyAssets(done) {
	logger.trace('copyAssets START');

	globfs.copy(this.root_assets, [ "**/*", '**/.*/*', '**/.*' ], this.root_out, {},
		function(err) {
			if (err) { logger.error(err); done(err); }
			else { logger.trace('copyAssets FINI '); done(); }
		});

}

function emptyRootOut(done) {
	logger.info('removing ' + this.root_out);
	var root_out = this.root_out;
	fs.remove(root_out, function(err) {
		if (err) done(err);
		else {
			logger.info('making empty ' + root_out);
			fs.mkdirs(root_out, function(err) {
				if (err) done(err);
				else { logger.trace('cleanDir FINI'); done(); }
			});
		}
	});
}

function process(callback) {
    
    var root_docs = this.root_docs;
    module.exports.emptyRootOut(function(err) {
        if (err) { logger.error(err); callback(new Error(err)); }
        else {
            module.exports.copyAssets(function(err) {
                if (err) { logger.error('copyAssets done '+ err); callback(err); }
                else {
                    module.exports.gatherDir(root_docs, function(err) {
                        // util.log('gatherDir CALLBACK CALLED');
                        if (err) callback(err);
                        else {
							dispatcher('before-render-files', function(err) {
								module.exports.renderDocuments(function(err) {
									if (err) callback(err);
									else {
										dispatcher('done-render-files', function(err) {
											logger.info('about to generate sitemap');
											sitemaps.generateSitemap(function(err) {
												if (err) callback(err);
												else {
													logger.info('about to all-done');
													dispatcher('all-done', function(err) {
														if (err) callback(err);
														else callback();
													});
												}
											});
										});
									}
								});
							});
                        }
                    });
                }
            });
        }
    });
}

/**
 * Render a partial, paying attention to synchronous operation
 */
function partialSync(fname, metadata) {
	metadata.plugin = module.exports.plugin;
	metadata.config = this;
	metadata.partial = module.exports.partialSync;
	metadata.akashacms = module.exports;
	
	var renderChain = module.exports.findRenderChain(fname);
    var fnamePartial = find.partial(fname);
    logger.trace('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial === undefined) 
        return new Error('NO FILE FOUND FOR PARTIAL ' + util.inspect(fname));
    var text = fs.readFileSync(fnamePartial, 'utf8');
	if (renderChain && renderChain.renderSync) {
	  return renderChain.renderSync(text, metadata);
	} else {
	  return new Error('UNKNOWN Synchronous Template Engine for ' + fname);
	}
}

/**
 * Render a partial in asynchronous fashion
 */
function partial(name, metadata, callback) {
	metadata.plugin = module.exports.plugin;
	metadata.config = this;
	metadata.partial = module.exports.partialSync;
	metadata.akashacms = module.exports;
	
	var renderChain = module.exports.findRenderChain(name);
	if (renderChain) {
	  fileCache.readPartial(name, function(err, partialEntry) {
		if (err) callback(err);
		else if (renderChain.render) {
		  renderChain.render(partialEntry.frontmatter.text, metadata, callback);
		} else if (renderChain.renderSync) {
		  var rndrd = renderChain.renderSync(partialEntry.frontmatter.text, metadata);
		  if (rndrd instanceof Error) {
			  callback(rndrd);
		  } else {
			  callback(undefined, rndrd);
		  }
		} else {
		  callback(new Error("Malformed renderChain found for "+ name +' '+ util.inspect(renderer)));
		}
	  });
	} else {
	  callback(new Error("No renderChain engine found for "+ name));
	}
}

// TODO: For a gruntified version, we don't want to use dispatcher here
// Instead the Gruntfile would do tasks before and after renderDocuments
function renderDocuments(done) {
	var entryCount = 0;
	fileCache.eachDocumentAsync( 
		function(docEntry, next) {
			entryCount++;
			logger.info('FILE '+ entryCount +' '+ docEntry.path);
			module.exports.renderDocument(docEntry, function(err) {
				if (err) next(err);
				else next();
			});
		}, 
		function(err) {
			if (err) done(err);
			else {
				logger.info('***** renderDocuments saw count='+ entryCount);
				done();
			}
		});
}

function renderDocument(docEntry, done) {
	// logger.trace('renderFile before rendering '+ fileName);
	// util.log('renderDocument '+ docEntry.path);
	var renderChain = module.exports.findRenderChain(docEntry.path);
	// console.log(util.inspect(renderChain));
	// console.log(util.inspect(docEntry.frontmatter));
	if (fileCache.doLayoutProcessing(docEntry.path)
	|| (docEntry.frontmatter.yaml && docEntry.frontmatter.yaml.layout && renderChain.doLayouts)) {
		// util.log('about to process2html');
		process2html(config, docEntry, done);
	} else {
		var metadata = config2renderopts(this, docEntry);
		if (renderChain && renderChain.renderSync) {
			var rendered = renderChain.renderSync(docEntry.frontmatter.text, metadata);
			writeRenderingToFile(this, renderChain.renderedFileName, rendered, docEntry, done);
		} else if (renderChain && renderChain.render) {
			renderChain.render(docEntry.frontmatter.text, metadata, function(err, rendered) {
				if (err) done(err);
				else writeRenderingToFile(this, renderChain.renderedFileName, rendered, docEntry, done);
			});
		} else {
			// for anything not rendered, simply copy it
			var renderTo = path.join(this.root_out, docEntry.path);
			// util.log('copy_to_outdir renderTo='+ renderTo +' entry.path='+ entry.path);
			fs.mkdirs(path.dirname(renderTo), function(err) {
				if (err) done(err); 
				else fs.copy(docEntry.fullpath, renderTo, function(msg) {
					fs.utimes(renderTo,
						docEntry.stat ? docEntry.stat.atime : new Date(), docEntry.stat ? docEntry.stat.mtime : new Date(),
						function(err) {
						/*if (err) done(err);
						else*/ done();
					});
				});
			});
		}
	}
};

function renderFile(fileName, callback) {
    if (fileName.charAt(0) === '/') {
        fileName = fileName.substr(1);
    }
    renderer.config(module.exports, this);
	logger.trace('renderFile before readDocument '+ fileName);
    fileCache.readDocument(fileName, function(err, docEntry) {
    	if (err) callback(err);
		else if (!docEntry) callback(new Error('File '+fileName+' not found'));
		else module.exports.renderDocument(docEntry, callback);
    });
};

function gatherDir(docroot, done) {
	var dirs = typeof docroot === 'string' ? [ docroot ] : docroot;
	var lastbasedir;
    globfs.operate(dirs, [ '**/*', '**/.*/*', '**/.*' ],
    	function(basedir, fpath, fini) {
			if (lastbasedir !== basedir) {
				lastbasedir = basedir;
				logger.info('******** gatherDir DIR '+ basedir);
			}
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
					fileCache.readDocument(result.path, function(err, docEntry) {
						if (err) logger.error('gatherDir readDocument '+ err);
						next();
					});
    			},
    			function(err) {
					done();
    			});
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
		metadata.rendered_date = entry.stat ? entry.stat.mtime : new Date();
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
	metadata.config = config;
	metadata.partial = module.exports.partialSync;
	
	metadata.akashacms = module.exports;
	
	return metadata;
};

/**
 * For files that are processed into an HTML, run the processing.
 **/
var process2html = function(config, entry, done) {
    logger.trace('process2html #1 '+ entry.path); // util.inspect(entry));
	// TODO Is this test useful?
    /* if (! fileCache.supportedForHtml(entry.path)) {
        done(new Error('UNKNOWN template engine for ' + entry.path));
    } else { */
        var metadata = config2renderopts(config, entry);
		// util.log('process2html partial='+ util.inspect(metadata.partial));
        
        logger.trace('process2html #2 '+ entry.path); //  +' '+ util.log(util.inspect(renderopts)));
        renderer.render(module.exports, entry, undefined, metadata, function(err, rendered) {
            logger.trace('***** DONE RENDER ' + entry.path); // util.inspect(rendered));
            if (err) {
            	logger.error('Rendering '+ entry.path +' failed with '+ err);
            	done('Rendering '+ entry.path +' failed with '+ err);
            } else {
                var renderTo = path.join(config.root_out, rendered.fname);
                if (!rendered.content) logger.error("Somethings wrong - no rendered.content");
                dispatcher('file-rendered', config, entry.path, renderTo, rendered, function(err) {
                    // TBD - the callback needs to send a new rendering 
                    if (err) done('Rendering file-rendered '+ entry.path +' failed with '+ err);
                    else {
                        logger.info('rendered '+ entry.path +' as '+ renderTo);
                        if (!rendered.content) logger.error("Somethings wrong - no rendered.content");
                        fs.mkdirs(path.dirname(renderTo), function(err) {
                            if (err) done('FAILED to make directory '+ path.dirname(renderTo) +' failed with '+ err); 
                            else fs.writeFile(renderTo, rendered.content, 'utf8', function (err) {
                                if (err) done(err);
                                else {
                                    var atime = entry.stat ? entry.stat.atime : new Date();
                                    var mtime = entry.stat ? entry.stat.mtime : new Date();
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
                                        sitemaps.add_sitemap_entry(config.root_url +'/'+ rendered.fname, 0.5, mtime);
                                        done();
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
    /*  } /* */
};

var writeRenderingToFile = function(config, renderedFileName, rendered, entry, done) {
	var renderTo = path.join(config.root_out, renderedFileName);
	fs.mkdirs(path.dirname(renderTo), function(err) {
		if (err) done(err);
		else fs.writeFile(renderTo, rendered, 'utf8', function (err) {
			if (err) done(err);
			else {
				fs.utimes(renderTo,
					entry.stat ? entry.stat.atime : new Date(), entry.stat ? entry.stat.mtime : new Date(),
					function(err) {
					if (err) done(err);
					else done();
				});
			}
		});
	});
}


function zipRenderedSite(done) {
	
    var archive = archiver('zip');
    
    var output = fs.createWriteStream(this.root_out +'.zip');
            
    output.on('close', function() {
        logger.info(archive.pointer() + ' total bytes');
        logger.info('archiver has been finalized and the output file descriptor has closed.');  
        done();
    });
    
    archive.on('error', function(err) {
      done(err);
    });
    
    archive.pipe(output);
	
	archive.directory(this.root_out, ".");
	
	archive.finalize();
};

module.exports.oEmbedData = function(url, callback) {
  oembed.fetch(url, { maxwidth: 6000 }, callback);
};

module.exports.parseTags = function(tags) {
    var taglist = [];
    var re = /\s*,\s*/;
    if (tags) tags.split(re).forEach(function(tag) {
        taglist.push(tag.trim());
    });
    return taglist;
};

/* module.exports.findSiblings = function(config, fileName, done) {
    var bnm   = path.basename(fileName);
    var dirname = path.dirname(fileName);
    fileCache.readDocument(fileName, function(err, entry) {
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
						fileCache.readDocument(fpath, function(err, docEntry) {
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

function runPreviewServer() {
    var root_out = this.root_out;
	var server = http.createServer(function (req, res) {
		var requrl = url.parse(req.url, true);
		logger.info(req.method +' '+ req.url);
		var fname = path.join(root_out, requrl.pathname);
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
						var docEntrie = fileCache.documentForUrlpath(requrl.pathname);
						if (docEntrie) {
							fileCache.readDocument(docEntrie.path, function(err, docEntry) {
								if (err) {
									res.statusCode = 500;
									res.end(err);
								} else if ((stats.mtime - docEntry.stat.mtime) < 0) {
									module.exports.renderDocument(docEntry, function(err) {
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

function runEditServer() {
	module.exports.gatherDir(this.root_docs, function(err, data) {
		if (err) {
			util.log('ERROR '+ err);
		} else {
			require(path.join(__dirname, 'server', 'app'))(module.exports, this);
		}
	});
};

///////////////// Deployment of Sites

function deployViaRsync() {
	var user = this.deploy_rsync.user;
	var host = this.deploy_rsync.host;
	var dir  = this.deploy_rsync.dir;
	var nargv = [];
	nargv.push('--verbose');
	nargv.push('--archive');
	nargv.push('--delete');
	nargv.push('--compress');
	// if (options.force) 
	if (this.deploy_rsync.exclude) {
		nargv.push('--exclude');
		nargv.push(this.deploy_rsync.exclude);
	}
	if (this.deploy_rsync.excludeFile) {
		nargv.push('--exclude-from');
		nargv.push(this.deploy_rsync.excludeFile);
	}
	nargv.push(this.root_out+'/');
	nargv.push(user+'@'+host+':'+dir+'/');
	logger.info('deploy Via Rsync '+ util.inspect(nargv));
	return spawn('rsync', nargv, {env: process.env, stdio: ['pipe', 'pipe', 'pipe']});
};

///////////////// RSS Feed Generation

function generateRSS(configrss, feedData, items, renderTo, done) {

	// logger.trace('generateRSS '+ renderTo);
	
	// Construct initial rss object
	var rss = {};
    for (var key in configrss) {
        if (configrss.hasOwnProperty(key)) {
            rss[key] = configrss[key];
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
    var renderOut = path.join(this.root_out, renderTo);
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
}

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

var dispatcher = module.exports.dispatcher = function() {
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
