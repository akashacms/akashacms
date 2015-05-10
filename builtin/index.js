/**
 *
 * Copyright 2014-2015 David Herron
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

var path  = require('path');
var util  = require('util');
var async = require('async');

var akasha;
var config;
var logger;

module.exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("builtin");
	
	if (!config.builtin) config.builtin = {};
	if (!config.builtin.suppress) config.builtin.suppress = {};
	
	config.root_partials.push(path.join(__dirname, 'partials'));
	
	return module.exports;
};


module.exports.mahabhuta = [
		function($, metadata, dirty, done) {
        	logger.trace('ak-stylesheets');
            var elements = [];
            $('ak-stylesheets').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
                var scripts;
			    if (typeof metadata.headerStylesheetsAdd !== "undefined") {
			        scripts = config.headerScripts.stylesheets.concat(metadata.headerStylesheetsAdd);
			    } else {
			        scripts = config.headerScripts.stylesheets;
			    }
				akasha.partial("ak_stylesheets.html.ejs", {
					stylesheets: scripts
				}, function(err, style) {
					if (err) { logger.error(err); next(err); }
					else {
						$(element).replaceWith(style);
						next();
					}
				});
            }, 
            function(err) {
				if (err) {
					logger.error('ak-stylesheets Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-headerJavaScript');
            var elements = [];
            $('ak-headerJavaScript').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
                var scripts;
			    if (typeof metadata.headerJavaScriptAddTop !== "undefined") {
			        scripts = config.headerScripts.javaScriptTop.concat(metadata.headerJavaScriptAddTop);
			    } else {
			        scripts = config.headerScripts.javaScriptTop;
			    }
			    akasha.partial("ak_javaScript.html.ejs", { javaScripts: scripts },
						function(err, html) {
							if (err) next(err);
							else {
								$(element).replaceWith(html);
								next();
							}
						});
            }, 
            function(err) {
				if (err) {
					logger.error('ak-headerJavaScript Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-footerJavaScript');
            var elements = [];
            $('ak-footerJavaScript').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
                var scripts;
			    if (typeof metadata.headerJavaScriptAddBottom !== "undefined") {
			        scripts = config.headerScripts.javaScriptBottom.concat(metadata.headerJavaScriptAddBottom);
			    } else {
			        scripts = config.headerScripts.javaScriptBottom;
			    }
			    akasha.partial("ak_javaScript.html.ejs", { javaScripts: scripts },
						function(err, html) {
							if (err) next(err);
							else {
								$(element).replaceWith(html);
								next();
							}
						});
            }, 
            function(err) {
				if (err) {
					logger.error('ak-footerJavaScript Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-insert-body-content');
            var elements = [];
            $('ak-insert-body-content').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
			
				if (typeof metadata.content !== "undefined")
					$(element).replaceWith(metadata.content);
				else
					$(element).remove();
            
				next();
            }, 
            function(err) {
				if (err) {
					logger.error('ak-insert-body-content Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-teaser');
            var elements = [];
            $('ak-teaser').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
				if (typeof metadata.teaser !== "undefined" || typeof metadata["ak-teaser"] !== "undefined") {
						akasha.partial("ak_teaser.html.ejs", {
								teaser: typeof metadata["ak-teaser"] !== "undefined"
									? metadata["ak-teaser"] : metadata.teaser
							},
							function(err, html) {
								if (err) next(err);
								else {
										$(element).replaceWith(html);
										next();
								}
							});
				} else {
					$(element).remove();
					next();
				}
            }, 
            function(err) {
				if (err) {
					logger.error('ak-teaser Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('partial');
            // <partial file-name="file-name.html.whatever" data-attr-1=val data-attr-2=val/>
            var partials = [];
            $('partial').each(function(i, elem) { partials.push(elem); });
            async.eachSeries(partials,
            function(partial, next) {
				// We default to making partial set the dirty flag.  But a user
				// of the partial tag can choose to tell us it isn't dirty.
				// For example, if the partial only substitutes values into normal tags
				// there's no need to do the dirty thing.
				var dothedirtything = $(partial).attr('dirty');
				if (!dothedirtything || dothedirtything.match(/true/i)) {
				    dirty();
				}
                var fname = $(partial).attr("file-name");
                var txt   = $(partial).text();
                var d = {};
                for (var mprop in metadata) { d[mprop] = metadata[mprop]; }
                var data = $(partial).data();
                for (var dprop in data) { d[dprop] = data[dprop]; }
                d["partialBody"] = txt;
                logger.trace('partial tag fname='+ fname +' attrs '+ util.inspect(data));
                akasha.partial(fname, d, function(err, html) {
                    if (err) {
                        logger.error('partial ERROR '+ util.inspect(err));
                        next(err);
                    }
                    else {
                        $(partial).replaceWith(html);
                        next(); 
                    }
                });
            },
            function(err) {
              if (err) {
                logger.error('partial Errored with '+ util.inspect(err));
                done(err);
              } else done();
            });
        },
		
];