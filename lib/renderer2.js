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

var fs        = require('fs');
var util      = require('util');
var path      = require('path');
var async     = require('async');
var fileCache = require('./fileCache');
var find      = require('./find');

var mahabhuta = require('mahabhuta');

var logger;

var siteConfig;
var akasha;
module.exports.config = function(_akasha, _config) {
  // util.log('renderer config ' + util.inspect(theoptions));
  siteConfig = _config;
  akasha = _akasha;
  if (!logger) logger = akasha.getLogger("renderer");
  
  if (siteConfig.cheerio) {
	mahabhuta.config(siteConfig.cheerio);
  }
};

var copyProperties = module.exports.copyProperties = function(metadata, frontmatter) {
  for (var prop in frontmatter) {
    if (!(prop in metadata)) metadata[prop] = frontmatter[prop];
  }
  return metadata;
};

/*
 * Support:
 *
 * fname.html.md 
 * fname.html.ejs.md
 * fname.html.ejs
 * NOPE: fname.php.ejs
 *
 * While supporting the possibility of adopting an asynchronous engine.
 */
var renderBody = function(fname, body, metadata, done) {
	logger.trace('renderBody '+ util.inspect(fname));
	var renderChain = akasha.findRenderChain(fname);
	if (renderChain) {
	  if (renderChain.render) {
		renderChain.render(body, metadata, done);
	  } else if (renderChain.renderSync) {
		var rndrd = renderChain.renderSync(body, metadata);
		if (rndrd instanceof Error) {
			done(rndrd);
		} else {
			done(undefined, rndrd);
		}
	  } else {
		done(new Error("Malformed renderer found for "+ fname +' '+ util.inspect(renderer)));
	  }
	} else {
	  done(new Error("No rendering engine found for "+ fname));
	}
};

/**
 * EXPERIMENT: Split Mahabhuta processing into three stages: preRender, duringRender, postRender.
 * This might eliminate some overhead.  Some mahafunc's should only be executed at the very beginning 
 * or very end of processing.
 */

var mahaPreRender = function(akashacms, config, entry, body, metadata, done) {
	var newbody = body;
	akashacms.eachPlugin(config,
	function(plugin, next) {
		if (plugin.mahabhuta && !Array.isArray(plugin.mahabhuta) && plugin.mahabhuta.pre_render) {
			mahabhuta.process(newbody, metadata, plugin.mahabhuta.pre_render, function(err, rendered) {
				if (err) next(err);
				else { newbody = rendered; next(); }
			});
		} else next();
	},
	function(err) {
		if (err) done(err);
		else {
			if (config.mahabhuta && !Array.isArray(config.mahabhuta) && config.mahabhuta.pre_render) {
				mahabhuta.process(newbody, metadata, config.mahabhuta.pre_render, function(err, rendered) {
					if (err) done(err);
					else { done(null, rendered); }
				});
			} else done(null, newbody);
		}
	}
	);
};

var mahaDuringRender = function(akashacms, config, entry, body metadata, done) {
	var newbody = body;
	akashacms.eachPlugin(config,
	function(plugin, next) {
		if (plugin.mahabhuta && !Array.isArray(plugin.mahabhuta) && plugin.mahabhuta.during_render) {
			mahabhuta.process(newbody, metadata, plugin.mahabhuta.during_render, function(err, rendered) {
				if (err) next(err);
				else { newbody = rendered; next(); }
			});
		} else if (plugin.mahabhuta && Array.isArray(plugin.mahabhuta)) {
			mahabhuta.process(newbody, metadata, plugin.mahabhuta, function(err, rendered) {
				if (err) next(err);
				else { newbody = rendered; next(); }
			});
		} else next();
	},
	function(err) {
		if (err) done(err);
		else {
			if (config.mahabhuta && !Array.isArray(config.mahabhuta) && config.mahabhuta.during_render) {
				mahabhuta.process(newbody, metadata, config.mahabhuta.during_render, function(err, rendered) {
					if (err) done(err);
					else { done(null, rendered); }
				});
			} else if (config.mahabhuta && Array.isArray(config.mahabhuta)) {
				mahabhuta.process(newbody, metadata, config.mahabhuta, function(err, rendered) {
					if (err) done(err);
					else { done(null, rendered); }
				});
			} else done(null, newbody);
		}
	}
	);
};

var mahaPostRender = function(akashacms, config, entry, body metadata, done) {
	var newbody = body;
	akashacms.eachPlugin(config,
	function(plugin, next) {
		if (plugin.mahabhuta && !Array.isArray(plugin.mahabhuta) && plugin.mahabhuta.post_render) {
			mahabhuta.process(newbody, metadata, plugin.mahabhuta.post_render, function(err, rendered) {
				if (err) next(err);
				else { newbody = rendered; next(); }
			});
		} else if (plugin.mahabhuta && Array.isArray(plugin.mahabhuta)) {
			mahabhuta.process(newbody, metadata, plugin.mahabhuta, function(err, rendered) {
				if (err) next(err);
				else { newbody = rendered; next(); }
			});
		} else next();
	},
	function(err) {
		if (err) done(err);
		else {
			if (config.mahabhuta && !Array.isArray(config.mahabhuta) && config.mahabhuta.post_render) {
				mahabhuta.process(newbody, metadata, config.mahabhuta.post_render, function(err, rendered) {
					if (err) done(err);
					else { done(null, rendered); }
				});
			} else if (config.mahabhuta && Array.isArray(config.mahabhuta)) {
				mahabhuta.process(newbody, metadata, config.mahabhuta, function(err, rendered) {
					if (err) done(err);
					else { done(null, rendered); }
				});
			} else done(null, newbody);
		}
	}
	);
};

/**
 *
 **/
 
module.exports.render = function(akashacms, config, entryOrig, entryTemplate, metadata, done) {
    
    logger.trace('render orig='+ entryOrig.path +' template='+ (entryTemplate ? entryTemplate.path : ""));
    
    if (!metadata.partial) metadata.partial = akasha.partial;
    if (!metadata.partialSync) metadata.partialSync = akasha.partialSync;
    
	var txtToRender;
	var fnRender;
	if (entryTemplate) {
		txtToRender = entryTemplate.frontmatter.text;
		fnRender = entryTemplate.path;
	} else {
		txtToRender = entryOrig.frontmatter.text;
		fnRender = entryOrig.path;
	}
	
	// mahaPreRender
	
	renderBody(fnRender, txtToRender, metadata, function(err, newbody) {
		logger.trace('renderBody finish for orig='+ entryOrig.path +' fnRender='+ fnRender
			+' template='+ (entryTemplate ? entryTemplate.path : ""));
		if (err) {
			logger.error('renderBody failed with '+ err);
			done(err);
		} else {
			// mahaDuringRender
			mahabhuta.process(newbody, metadata, config.mahabhuta, function(err, rendered) {
				logger.trace('mahabuta finish for orig='+ entryOrig.path +' fnRender='+ fnRender
					+' template='+ (entryTemplate ? entryTemplate.path : ""));
				if (err) {
					logger.error('mahabhuta.process failed with '+ err);
					done(err);
				} else if (!entryTemplate && entryOrig && entryOrig.frontmatter && entryOrig.frontmatter.yaml && entryOrig.frontmatter.yaml.layout) {
					metadata.content = rendered;
					logger.trace('about to render orig='+ entryOrig.path +' by entryOrig template '+ entryOrig.frontmatter.yaml.layout);
					fileCache.readTemplate(config, entryOrig.frontmatter.yaml.layout, function(err, _entryTemplate) {
						if (err) { logger.error(err); done(err); }
						else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done);
					});
				} else if (entryTemplate && entryTemplate && entryTemplate.frontmatter && entryTemplate.frontmatter.yaml && entryTemplate.frontmatter.yaml.layout) {
					metadata.content = rendered;
					logger.trace('about to render orig='+ entryOrig.path +' by entryTemplate template '+ entryTemplate.frontmatter.yaml.layout);
					fileCache.readTemplate(config, entryTemplate.frontmatter.yaml.layout, function(err, _entryTemplate) {
						if (err) { logger.error(err); done(err); }
						else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done)
					});
				} else {
					metadata.content = rendered;
					logger.trace('final rendering '+ entryOrig.renderedFileName); // +' '+ rendered);
					// mahaPostRender
					done(undefined, {
						fname:   entryOrig.renderedFileName,
						ext:     entryOrig.fileExt,
						content: rendered
					});
				}
			});
		}
	});
	
	// This following implementation was hoped to be faster than the above, because it makes only
	// one pass through Mahabhuta.  The above makes a Mahabhuta pass for every step in the template chain.
	// The code below makes one Mahabhuta pass at the end of processing the template chain.
	//
	// The two produce approximately the same output.
	//
	// The code below takes twice as long to run.
	
	/* renderBody(fnRender, txtToRender, metadata, function(err, newbody) {
		logger.trace('renderBody finish for orig='+ entryOrig.path +' fnRender='+ fnRender
			+' template='+ (entryTemplate ? entryTemplate.path : ""));
		if (err) {
			logger.error('renderBody failed with '+ err);
			done(err);
		} else if (!entryTemplate && entryOrig && entryOrig.frontmatter && entryOrig.frontmatter.yaml && entryOrig.frontmatter.yaml.layout) {
			metadata.content = newbody;
			logger.trace('about to render orig='+ entryOrig.path +' by entryOrig template '+ entryOrig.frontmatter.yaml.layout);
			fileCache.readTemplate(config, entryOrig.frontmatter.yaml.layout, function(err, _entryTemplate) {
				if (err) { logger.error(err); done(err); }
				else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done);
			});
		} else if (entryTemplate && entryTemplate && entryTemplate.frontmatter && entryTemplate.frontmatter.yaml && entryTemplate.frontmatter.yaml.layout) {
			metadata.content = newbody;
			logger.trace('about to render orig='+ entryOrig.path +' by entryTemplate template '+ entryTemplate.frontmatter.yaml.layout);
			fileCache.readTemplate(config, entryTemplate.frontmatter.yaml.layout, function(err, _entryTemplate) {
				if (err) { logger.error(err); done(err); }
				else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done)
			});
		} else {
			metadata.content = newbody;
			logger.trace('final rendering '+ entryOrig.renderedFileName); // +' '+ rendered);
			mahabhuta.process(newbody, metadata, config.mahabhuta, function(err, rendered) {
				logger.trace('mahabuta finish for orig='+ entryOrig.path +' fnRender='+ fnRender
					+' template='+ (entryTemplate ? entryTemplate.path : ""));
				if (err) {
					logger.error('mahabhuta.process failed with '+ err);
					done(err);
				} else {
					done(undefined, {
						fname:   entryOrig.renderedFileName,
						ext:     entryOrig.fileExt,
						content: rendered
					});
				}
			});
		}
	}); */
};
