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
// var K         = require('kernel');
//var markdown = require("markdown").markdown;
// var marked    = require('marked');
var Remarkable    = require('remarkable');
var mahabhuta = require('./mahabhuta');

var logger;

/*marked.setOptions({
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
  }* /
});*/

var md = new Remarkable({
  html:         true,        // Enable html tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />)
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  // langPrefix:   'language-',  // CSS language prefix for fenced blocks
  linkify:      true,        // Autoconvert url-like texts to links
  typographer:  true,         // Enable smartypants and other sweet transforms

  // Highlighter function. Should return escaped html,
  // or '' if input not changed
  highlight: function (/*str, , lang*/) { return ''; }
});

// These values are default
// They appear to have removed this object
/*md.typographer.set({
  singleQuotes: '‘’', // set empty to disable
  doubleQuotes: '“”', // set '«»' for russian, '„“' for deutch, empty to disable
  copyright:    true, // (c) (C) → ©
  trademark:    true, // (tm) (TM) → ™
  registered:   true, // (r) (R) → ®
  plusminus:    true, // +- → ±
  paragraph:    true, // (p) (P) -> §
  ellipsis:     true, // ... → … (also ?.... → ?.., !.... → !..)
  dupes:        true, // ???????? → ???, !!!!! → !!!, `,,` → `,`
  dashes:       true  // -- → &ndash;, --- → &mdash;
}); */

var siteConfig;
module.exports.config = function(akasha, _config) {
  // util.log('renderer config ' + util.inspect(theoptions));
  siteConfig = _config;
  if (!logger) logger = akasha.getLogger("renderer");
};

///////// Extra support for Kernel template engine
///////// The purpose is to support frontmatter

/*K.resourceLoader = function(fileNameObj, callback) {
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
    var sendFileEntry = function(err, entry) {
    	if (err) {
      		callback(new Error("No file entry found for "+ util.inspect(fileNameObj)));
    	} else {
      		callback(null, entry.frontmatter.text);
    	}
    };
    var entry;
    if (fileType === "partial")
        sendFileEntry(undefined, fileCache.readPartial(options, fileName));
    else if (fileType === "template")
        sendFileEntry(undefined, fileCache.readTemplate(options, fileName));
    else if (fileType === "inline")
        sendFileEntry(undefined, {
          frontmatter: {
            text: fileName
          }
        });
    else
        fileCache.readDocument(options, fileName, sendFileEntry);
    // util.log('resourceLoader '+ entry.path +' '+ entry.fullpath);
    /*if (entry) {
      callback(null, entry.frontmatter.text);
    } else {
      callback(new Error("No file entry found for "+ util.inspect(fileNameObj)));
    }* /
};*/

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
	throw new Error('oEmbed Render called');
    // util.log('oembed ' + util.inspect(arg) +" url in arg "+ ("url" in arg) +" typeof "+ typeof arg.url +" test "+ (typeof arg.url === "undefined"));
    /* if (!("template" in arg) || typeof arg.template === "undefined") 
        return callback(new Error("Must provide a partial/template render on")); */
    if (!("url" in arg) || typeof arg.url === "undefined")
      callback(new Error("Must provide a URL to retrieve"));
    else
      oembed.fetch(arg.url, { maxwidth: 6000 }, function(err, result) {
        if (err) {
            callback(err);
        } else {
            // util.log('retrieved oembed.. ' + util.inspect(result) + ' for url ' + arg.url);
            if (!("template" in arg) || typeof arg.template === "undefined")
                callback(undefined, result.html);
            else 
            	callback(undefined, partialSync(arg.template, result));
                /*partialKernel(arg.template, result, function(err, data) {
                  // util.log(util.inspect(err));
                  // util.log(util.inspect(data));
                  callback(err, data);
                });*/
        }
      });
};

var partialSync = function(fname, metadata) {
    var fnamePartial = find.partial(siteConfig, fname);
    logger.trace('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial === undefined) 
        return new Error('NO FILE FOUND FOR PARTIAL ' + util.inspect(fname));
    var text = fs.readFileSync(fnamePartial, 'utf8');
    var rendered;
    if (fname.match(/\.ejs$/)) rendered = ejs.render(text, metadata);
    // else if (fname.match(/\.md$/)) rendered = marked(text);
    else if (fname.match(/\.md$/)) rendered = md.render(text);
    else if (fname.match(/\.html$/)) rendered = text;
    else { return new Error('UNKNOWN Synchronous Template Engine for ' + fname); }
    return rendered;
};

/*var partialKernel = function(fname, metadata, callback) {
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
};*/

/* var processExtension = function(akashacms, config, extensions, toRender, metadata, done) {
    util.log("processExtension "+ util.inspect(extensions)); // +" "+ util.inspect(toRender));
    var ext = extensions.shift();
    // util.log(ext);
    var r;
    var data = copyProperties({}, metadata); // Clone the metadata so we can add functions to it
    if (ext === "md") {
        // r = marked(toRender);
        r = md.render(toRender);
        // util.log('rendered md '+ util.inspect(r));
        processExtension(akashacms, config, extensions, r, metadata, done);
    } else if (ext === "ejs") {
        // util.log(util.inspect(data));
        data.partial = partialSync;
        r = ejs.render(toRender, data);
        // util.log('rendered ejs '+ util.inspect(r));
        processExtension(akashacms, config, extensions, r, metadata, done);
    } else if (ext === "kernel") {
        data.partial = partialKernel;
        data.oembed = oembedRender;
        K("inline:"+toRender, function(err, template) {
            if (err) done(err);
            else {
                template(data, function(err, html) {
                    if (err) done(err);
                    else processExtension(akashacms, config, extensions, html, metadata, done);
                });
            }
        });
    } else if (ext.match(/\.html$/i) || ext.match(/\.php$/i)) {
        mahabhuta.render(toRender, {
            metadata: data,
            cheerio: config.cheerio ? config.cheerio : undefined,
            process: function($, options, mahafini) {
                // util.log('mahabhuta process in processExtension '+ util.inspect(options));
                if (config.mahabhuta && config.mahabhuta.length > 0) {
                    async.eachSeries(config.mahabhuta,
                    function(mahafunc, next) {
                        mahafunc(akashacms, config, $, metadata, function(err) {
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
}; */


/* var stripExtensions = module.exports.stripExtensions = function(fnRender) {
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
}; */

module.exports.partial = function(config, name, metadata, callback) {
    if (name.match(/\.ejs$/) || name.match(/\.md$/) || name.match(/\.html$/)) {
		var rndrd = partialSync(name, metadata);
		if (rndrd instanceof Error) {
			callback(rndrd);
		} else {
			callback(undefined, rndrd);
		}
    } else {
    	throw new Error('.kernel Partial used '+ name);
		// partialKernel(name, metadata, callback);
    }
};

module.exports.partialSync = function(config, name, metadata, done) {
    // util.log('renderer2 exports.partialSync '+ name +' '+ util.inspect(metadata));
    var rendered = partialSync(name, metadata);
    if (done) done(null, rendered);
    return rendered;
};

/*
 * Support:
 *
 * fname.html.md 
 * fname.html.ejs.md
 * fname.html.ejs
 *
 * While supporting the possibility of adopting an asynchronous engine.
 */
var renderBody = function(fname, body, metadata, done) {
	logger.trace('renderBody '+ util.inspect(fname));
	// util.log(util.inspect(body));
	// util.log(util.inspect(metadata));
	if (fname.match(/\.md$/)) {
		if (fname.match(/\.ejs\.md$/)) {
			done(undefined, ejs.render(md.render(body), metadata));
		} else {
			done(undefined, md.render(body));
		}
	} else if (fname.match(/\.ejs$/)) {
		done(undefined, ejs.render(body, metadata));
	} else if (fname.match(/\.kernel$/)) {
		throw new Error('Use of Kernel templating '+ fname);
	} else {
		done(undefined, body);
	}
}

/**
 *
 * Typical call: render(config, undefined, fileName, "", undefined, function(err, TBD) {...})
 **/
 
module.exports.render = function(akashacms, config, entryOrig, entryTemplate, metadata, done) {

	var mahabutarun = function(metadata, content, done) {
        mahabhuta.render(content, {
            metadata: metadata,
            cheerio: config.cheerio ? config.cheerio : undefined,
            process: function($, options, mahafini) {
                // logger.trace('mahabhuta process in processExtension '+ util.inspect(options));
                if (config.mahabhuta && config.mahabhuta.length > 0) {
                    async.eachSeries(config.mahabhuta,
                    function(mahafunc, next) {
                        mahafunc(akashacms, config, $, metadata, function(err) {
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
        }, done);
    };
    
    logger.trace('render orig='+ entryOrig.path +' template='+ (entryTemplate ? entryTemplate.path : ""));
    
    if (!metadata) {
    	metadata = copyProperties({}, entryOrig.frontmatter.yaml);
		metadata.content = "";
    } else {
    	metadata = copyProperties(metadata, entryOrig.frontmatter.yaml);
		metadata.partial = partialSync;
    }
	if (!metadata.documentPath) {
		metadata.documentPath = entryOrig.path; 
	}
	if (!metadata.publicationDate) {
		var dateSet = false;
		if (entryOrig.frontmatter.yaml && entryOrig.frontmatter.yaml.publDate) {
			var parsed = Date.parse(entryOrig.frontmatter.yaml.publDate);
			if (! isNaN(parsed)) {
			  metadata.publicationDate = new Date(parsed);
			}
			dateSet = true;
		}
		if (! dateSet && entryOrig.stat && entryOrig.stat.mtime) {
			metadata.publicationDate = entryOrig.stat.mtime;
		}
	}

	if (! metadata.rendered_url) {
		metadata.rendered_url = path.join(config.root_url, entryOrig.renderedFileName); 
	}
	
	var txtToRender;
	var fnRender;
	if (entryTemplate) {
		txtToRender = entryTemplate.frontmatter.text;
		fnRender = entryTemplate.path;
	} else {
		txtToRender = entryOrig.frontmatter.text;
		fnRender = entryOrig.path;
	}
	
	renderBody(fnRender, txtToRender, metadata, function(err, newbody) {
		// util.log('renderBody finish for orig='+ entryOrig.path +' fnRender='+ fnRender
		//	+' template='+ (entryTemplate ? entryTemplate.path : ""));
		mahabutarun(metadata, newbody, function(err, rendered) {
			// util.log('mahabuta finish for orig='+ entryOrig.path +' fnRender='+ fnRender
			//	+' template='+ (entryTemplate ? entryTemplate.path : ""));
			if (err) done(err);
			else if (!entryTemplate && entryOrig.frontmatter.yaml.layout) {
				metadata.content = rendered;
				// util.log('about to render orig='+ entryOrig.path +' by entryOrig template '+ entryOrig.frontmatter.yaml.layout);
				module.exports.render(akashacms, config, entryOrig, 
					fileCache.readTemplate(config, entryOrig.frontmatter.yaml.layout),
					metadata, done);
			} else if (entryTemplate && entryTemplate.frontmatter.yaml && entryTemplate.frontmatter.yaml.layout) {
				metadata.content = rendered;
				// util.log('about to render orig='+ entryOrig.path +' by entryTemplate template '+ entryTemplate.frontmatter.yaml.layout);
				module.exports.render(akashacms, config, entryOrig, 
					fileCache.readTemplate(config, entryTemplate.frontmatter.yaml.layout),
					metadata, done);
			} else {
				metadata.content = rendered;
				// util.log('final rendering '+ entryOrig.renderedFileName); // +' '+ rendered);
				done(undefined, {
					fname:   entryOrig.renderedFileName,
					ext:     entryOrig.fileExt,
					content: rendered
				});
			}
		});
	});
};

/*
var render = module.exports.render = function(akashacms, config,
    entryOrig, fnRender, metadata, body, done) {
	
	var mahabutarun = function(metadata, content, done) {
        mahabhuta.render(content, {
            metadata: metadata,
            cheerio: config.cheerio ? config.cheerio : undefined,
            process: function($, options, mahafini) {
                // util.log('mahabhuta process in processExtension '+ util.inspect(options));
                if (config.mahabhuta && config.mahabhuta.length > 0) {
                    async.eachSeries(config.mahabhuta,
                    function(mahafunc, next) {
                        mahafunc(akashacms, config, $, metadata, function(err) {
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
        }, done);
    };
	
	var handleEntryRender = function(err, entryRender) {
		// util.log('entryRender '+ util.inspect(entryRender));
		if (!entryOrig) entryOrig = entryRender; // Initialization for first time we're called
		util.log('render: handleEntryRender: ' + fnRender +' '+ entryRender.fullpath);
		if (!metadata.documentPath) {
			metadata.documentPath = fnRender; 
		}
		if (!metadata.publicationDate) {
			var dateSet = false;
			if (entryRender.frontmatter.yaml && entryRender.frontmatter.yaml.publDate) {
				var parsed = Date.parse(entryRender.frontmatter.yaml.publDate);
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
	
		copyProperties(metadata, entryRender.frontmatter.yaml);
	
		// util.log('metadata '+ util.inspect(metadata));
	
		metadata.partial = partialSync;
		// metadata.content = body;
		var newbody;
	
		// util.log("entryOrig "+ util.inspect(entryOrig));
		// util.log("entryRender "+ util.inspect(entryRender));
		// util.log("metadata "+ util.inspect(metadata));
		
		/* var renderTemplate = function(tmplName, metadata, content, cb) {
			var tmplEntry = fileCache.readTemplate(config, tmplName);
			renderBody(tmplName, tmplEntry.frontmatter.text, metadata, function(err, newbody) {
				if (err) cb(err);
				else {
				}
			});
		}; * /
		
		renderBody(fnRender, entryRender.frontmatter.text, metadata, function(err, newbody) {
			util.log('after renderBody '+ fnRender +' '+ newbody);
			metadata.content = newbody;
			mahabutarun(metadata, newbody, function(err, rendered) {
				if (err) done(err);
				else if (entryRender.frontmatter.yaml.layout) {
					util.log('about to render layout '+ entryRender.frontmatter.yaml.layout
						+' with previous rendering '+ rendered);
					metadata.content = rendered;
					render(akashacms, config, entryOrig,
					  entryRender.frontmatter.yaml.layout,
					  metadata, rendered, done);
				} else {
					metadata.content = rendered;
					util.log('before final mahabuta w/ '+ rendered);
					mahabutarun(metadata, rendered, function(err, rendered2) {
						if (err) done(err);
						else {
							metadata.content = rendered2;
							util.log('final rendering '+ entryOrig.renderedFileName +' '+ rendered2);
							done(undefined, {
								fname:   entryOrig.renderedFileName,
								ext:     entryOrig.fileExt,
								content: rendered2
							});
						}
					});
				}
			});
		});
		
		
	};
	
    var entryRender;
    if (!entryOrig || entryOrig.path === fnRender) {
        fileCache.readDocument(config, fnRender, handleEntryRender);
    } else {
        handleEntryRender(undefined, fileCache.readTemplate(config, fnRender));
    }
} */
/*
var render = module.exports.render = function(akashacms, config,
					      entryOrig, fnRender,
					      metadata, body, done) {
	var handleEntryRender = function(err, entryRender) {
		// util.log('entryRender '+ util.inspect(entryRender));
		if (!entryOrig) entryOrig = entryRender; // Initialization for first time we're called
		util.log('render: handleEntryRender: ' + fnRender +' '+ entryRender.fullpath);
		if (!metadata.documentPath) {
			metadata.documentPath = fnRender; 
		}
		if (!metadata.publicationDate) {
			var dateSet = false;
			if (entryRender.frontmatter.yaml && entryRender.frontmatter.yaml.publDate) {
				var parsed = Date.parse(entryRender.frontmatter.yaml.publDate);
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
	
		copyProperties(metadata, entryRender.frontmatter.yaml);
	
		var extensions;
		try {
		  extensions = stripExtensions(fnRender);
		} catch(e) { return done(e); }
	
		// util.log('metadata '+ util.inspect(metadata));
	
		metadata.content = body;
	
		// util.log("entryOrig "+ util.inspect(entryOrig));
		// util.log("entryRender "+ util.inspect(entryRender));
		// util.log("metadata "+ util.inspect(metadata));
	
		processExtension(akashacms, config, extensions, entryRender.frontmatter.text, metadata, function(err, newbody) {
			if (err) {
				done(err);
			} else if (entryRender.frontmatter.yaml.layout) {
				render(akashacms, config, entryOrig,
				  entryRender.frontmatter.yaml.layout,
				  metadata, newbody, done);
			} else {
				util.log('before mahabhuta '+ entryOrig.renderedFileName);
				metadata.content = newbody;
				mahabhuta.render(newbody, {
					metadata: metadata,
					cheerio: config.cheerio ? config.cheerio : undefined,
					process: function($, options, mahafini) {
						// util.log('mahabhuta process '+ util.inspect(options));
						if (config.mahabhuta && config.mahabhuta.length > 0) {
							async.eachSeries(config.mahabhuta,
								function(mahafunc, next) {
									mahafunc(akashacms, config, $, metadata, function(err) {
										if (err) next(err);
										else next(undefined);
									});
								},
								function(err) {
									if (err) mahafini(err);
									else mahafini(undefined);
								});
						} else mahafini(undefined);
					}
				}, function(err, rendered) {
					if (err) done(err);
					else {
						util.log('done rendering '+ entryOrig.renderedFileName);
						done(undefined, {
							fname:   entryOrig.renderedFileName,
							ext:     entryOrig.fileExt,
							content: rendered
						});
					}
				});
			}
		});
	}
    var entryRender;
    if (!entryOrig || entryOrig.path === fnRender) {
        fileCache.readDocument(config, fnRender, handleEntryRender);
    } else {
        handleEntryRender(undefined, fileCache.readTemplate(config, fnRender));
    }
/*    // util.log('entryRender '+ util.inspect(entryRender));
    if (!entryOrig) entryOrig = entryRender; // Initialization for first time we're called
    // util.log('render: ' + fnRender +' '+ entryRender.fullpath);
    if (!metadata.documentPath) {
        metadata.documentPath = fnRender; 
    }
    if (!metadata.publicationDate) {
        var dateSet = false;
        if (entryRender.frontmatter.yaml && entryRender.frontmatter.yaml.publDate) {
          	var parsed = Date.parse(entryRender.frontmatter.yaml.publDate);
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
    
    copyProperties(metadata, entryRender.frontmatter.yaml);
    
    var extensions;
    try {
      extensions = stripExtensions(fnRender);
    } catch(e) { return done(e); }
    
    // util.log('metadata '+ util.inspect(metadata));
    
    metadata.content = body;
    
    // util.log("entryOrig "+ util.inspect(entryOrig));
    // util.log("entryRender "+ util.inspect(entryRender));
    // util.log("metadata "+ util.inspect(metadata));
    
    processExtension(akashacms, config, extensions, entryRender.frontmatter.text, metadata, function(err, newbody) {
        if (err) {
            done(err);
        } else if (entryRender.frontmatter.yaml.layout) {
            render(akashacms, config, entryOrig,
			  entryRender.frontmatter.yaml.layout,
			  metadata, newbody, done);
        } else {
	    metadata.content = newbody;
	    mahabhuta.render(newbody, {
		metadata: metadata,
		cheerio: config.cheerio ? config.cheerio : undefined,
		process: function($, options, mahafini) {
		    // util.log('mahabhuta process '+ util.inspect(options));
		    if (config.mahabhuta && config.mahabhuta.length > 0) {
			async.eachSeries(config.mahabhuta,
			function(mahafunc, next) {
			    mahafunc(akashacms, config, $, metadata, function(err) {
				if (err) next(err);
				else next(undefined);
			    });
			},
			function(err) {
			    if (err) mahafini(err);
			    else mahafini(undefined);
			});
		    } else mahafini(undefined);
		}
	    }, function(err, rendered) {
		if (err) done(err);
		else
		    done(undefined, {
			fname:   entryOrig.renderedFileName,
			ext:     entryOrig.fileExt,
			content: rendered
		    });
	    });
        }
    }); * /
};
*/
