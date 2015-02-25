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

var path = require('path');
var util = require('util');
var url   = require('url');
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
	
	if (!(config.builtin && config.builtin.suppress && config.builtin.suppress.partials)) {
		config.root_partials.push(path.join(__dirname, 'partials'));
	}
	if (!(config.builtin && config.builtin.suppress && config.builtin.suppress.layouts)) {
		config.root_layouts.push(path.join(__dirname, 'layout'));
	}
	if (!(config.builtin && config.builtin.suppress && config.builtin.suppress.assets)) {
		config.root_assets.push(path.join(__dirname, 'assets'));
	}
    
    if (config.headerScripts) {
        config.headerScripts.javaScriptBottom.push({ href: "/js/akbase.js" });
	}
	
	return module.exports;
};

module.exports.helloWorld = function() {
   return "Hello, World!";
};

var fixHeaderMeta = function(metadata) {
	var data = {};
	for (var prop in metadata) {
		if (!(prop in data)) data[prop] = metadata[prop];
	}
	if (typeof data.metaOGtitle === "undefined") {
		if (typeof data.pagetitle !== "undefined") {
				data.metaOGtitle = data.pagetitle;
		} else if (typeof data.title !== "undefined") {
				data.metaOGtitle = data.title;
		}
	}
	if (typeof data.metaOGdescription === "undefined") {
		if (typeof data.metadescription !== "undefined") {
				data.metaOGdescription = data.metadescription;
		}
	}
	if (typeof data.metaDCtitle === "undefined") {
		if (typeof data.pagetitle !== "undefined") {
				data.metaDCtitle = arg.pagetitle;
		} else if (typeof data.title !== "undefined") {
				data.metaDCtitle = data.title;
		}
	}
	if (typeof data.metapagename === "undefined") {
		if (typeof data.pagetitle !== "undefined") {
				data.metapagename = arg.pagetitle;
		} else if (typeof data.title !== "undefined") {
				data.metapagename = data.title;
		}
	}
	if (typeof data.metadate === "undefined") {
		data.metadate = data.rendered_date;
	}
	return data;
}

var akDoHeaderMeta = function(metadata, done) {
	akasha.partial("ak_headermeta.html.ejs", fixHeaderMeta(metadata), done);
};

module.exports.doHeaderMetaSync = function(metadata) {
    return akasha.partialSync("ak_headermeta.html.ejs", fixHeaderMeta(metadata));
};

module.exports.mahabhuta = [
		function($, metadata, dirty, done) {
        	logger.trace('ak-page-title');
            var titles = [];
            $('ak-page-title').each(function(i, elem) { titles.push(elem); });
            async.eachSeries(titles,
            function(titleTag, next) {
            	var title;
				if (typeof metadata.pagetitle !== "undefined") {
					title = metadata.pagetitle;
				} else if (typeof metadata.title !== "undefined") {
					title = metadata.title;
				} else title = "";
				akasha.partial("ak_titletag.html.ejs", {
					title: title
				}, function(err, rendered) {
					if (err) { logger.error(err); next(err); }
					else { logger.trace('ak-title replace'); $(titleTag).replaceWith(rendered); next(); }
				})
            },
            function(err) {
            	if (err) {
					logger.error('ak-page-title Errored with '+ util.inspect(err));
					done(err);
            	} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-header-metatags');
            var metas = [];
            $('ak-header-metatags').each(function(i, elem) { metas.push(elem); });
            async.eachSeries(metas,
            function(meta, next) {
            	akDoHeaderMeta(metadata, function(err, rendered) {
            		if (err) {
                        logger.error('ak-header-metatags ERROR '+ util.inspect(err));
                        next(err);
                    } else {
                    	$(meta).replaceWith(rendered);
                    	next();
                    }
            	});
            },
            function(err) {
				if (err) {
					logger.error('ak-header-metatags Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-header-canonical-url');
            var elements = [];
            $('ak-header-canonical-url').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
				if (typeof metadata.rendered_url !== "undefined") {
					akasha.partial("ak_linkreltag.html.ejs", {
						relationship: "canonical",
						url: metadata.rendered_url
					}, function(err, rendered) {
						if (err) { logger.error(err); next(err); }
						else { $(element).replaceWith(rendered); next(); }
					});
				}
				else {
					$(element).remove(); 
					next();
				}
            },
            function(err) {
				if (err) {
					logger.error('ak-header-canonical-url Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-stylesheets');
            var elements = [];
            $('ak-stylesheets').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
				if (typeof config.headerScripts !== "undefined") {
					akasha.partial("ak_stylesheets.html.ejs", {
						headerScripts: config.headerScripts 
					}, function(err, style) {
						if (err) { logger.error(err); next(err); }
						else {
							$(element).replaceWith(style);
							next();
						}
					});
				}
				else {
					$(element).remove();
					next();
				}
            }, 
            function(err) {
				if (err) {
					logger.error('ak-stylesheets Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-siteverification');
            var elements = [];
            $('ak-siteverification').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
            
				if (typeof config.google.siteVerification !== "undefined") {
				    akasha.partial("ak_siteverification.html.ejs", 
							{ googleSiteVerification: config.google.siteVerification },
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
					logger.error('ak-siteverification Errored with '+ util.inspect(err));
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
            
				if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptTop !== "undefined") {
				    akasha.partial("ak_javaScript.html.ejs", 
							{ javaScripts: config.headerScripts.javaScriptTop },
							function(err, html) {
								if (err) next(err);
								else {
									$(element).replaceWith(html);
									next();
								}
							});
				}
				else {
					$(element).remove();
            		next();
				}
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
			
				if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptBottom !== "undefined")
				    akasha.partial("ak_javaScript.html.ejs", 
							{ javaScripts: config.headerScripts.javaScriptBottom },
							function(err, html) {
								if (err) next(err);
								else {
									$(element).replaceWith(html);
									next();
								}
							});
				else {
					$(element).remove();
            		next();
				}
            }, 
            function(err) {
				if (err) {
					logger.error('ak-footerJavaScript Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-google-analytics');
            var elements = [];
            $('ak-google-analytics').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
			
				if (typeof config.google.analyticsAccount !== "undefined" && typeof config.google.analyticsDomain !== "undefined") {
				    akasha.partial("ak_googleAnalytics.html.ejs", {
							googleAnalyticsAccount: config.google.analyticsAccount,
							googleAnalyticsDomain: config.google.analyticsDomain
						}, function(err, html) {
						    if (err) next(err);
							else {
								$(element).replaceWith(html);
								next();
							}
						});
				}
				else {
					$(element).remove();
            		next();
				}
            }, 
            function(err) {
				if (err) {
					logger.error('ak-google-analytics Errored with '+ util.inspect(err));
					done(err);
				} else done();
            });
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('ak-sitemapxml');
            var elements = [];
            $('ak-sitemapxml').each(function(i, elem) { elements.push(elem); });
            async.eachSeries(elements,
            function(element, next) {
			
				akasha.partial("ak_sitemap.html.ejs", {  }, function(err, html) {
						if (err) {
								next(err);
						} else {
								$(element).replaceWith(html);
								next();
						}
				});
            }, 
            function(err) {
				if (err) {
					logger.error('ak-sitemapxml Errored with '+ util.inspect(err));
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
        	logger.trace('rss-header-meta');
			if ($('html head').get(0)) {
				var rssheadermeta = [];
				$('rss-header-meta').each(function(i, elem){ rssheadermeta.push(elem); });
				async.eachSeries(rssheadermeta,
				function(rssmeta, next) {
					var href = $(rssmeta).attr('href');
					if (href) {
						$('head').append(
							'<link rel="alternate" type="application/rss+xml" href="'+href+'" />'
						);
					} else logger.error('no href= tag in rss-header-meta ... skipped');
					$(rssmeta).remove();
					next();
				},
				function(err) {
					if (err) done(err);
					else done();
				});
			} else done();               
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
		
		function($, metadata, dirty, done) {
        	logger.trace('publication-date');
			var elements = [];
			$('publication-date').each(function(i, elem) { elements.push(elem); });
			async.eachSeries(elements,
			function(element, next) {
				logger.trace(metadata.publicationDate);
				if (metadata.publicationDate) {
					akasha.partial("ak_publdate.html.ejs", {
							publicationDate: metadata.publicationDate
						},
						function(err, html) {
							if (err) { logger.error(err); next(err); } 
							else { $(element).replaceWith(html); next(); }
						});
				} else next();
			}, function(err) {
				if (err) { logger.error(err); done(err); } 
				else { logger.trace('END publication-date'); done(); }
			});
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('author-link');
			if (config.authorship) {
				var auname;
				if (!metadata.authorname && config.authorship.defaultAuthorName) {
					auname = config.authorship.defaultAuthorName;
				} else if (metadata.authorname) {
					auname = metadata.authorname;
				}
				if (auname) {
					var elements = [];
					$('author-link').each(function(i, elem) { elements.push(elem); });
					async.eachSeries(elements,
					function(element, next) {
						var author;
						for (var i in config.authorship.authors) {
							if (config.authorship.authors[i].name === auname) {
								author = config.authorship.authors[i];
								break;
							}
						}
						if (author) {
							akasha.partial("ak_authorship.html.ejs", {
									fullname: author.fullname,
									authorship: author.authorship
								},
								function(err, html) {
									if (err) { logger.error(err); next(err); } 
									else { $(element).replaceWith(html); next(); }
								});
						} else {
							logger.warn('no author data found for '+ auname);
							next();
						}
					}, function(err) {
						if (err) { logger.error(err); done(err); } 
						else { logger.trace('END author-link'); done(); }
					});
				} else done();
			} else done();
        },
        
        /**
         * These next two tags / functions are a two-step process for extracting image
         * references and listing them as meta og:image tags.
         *
         * In phase 1 <open-graph-promote-images> should be put in a template, to trigger
         * the code below.  It simply adds the metaog-promote class to any image found
         * in the content, and then the <open-graph-promote-images> tag is removed.
         * That class triggers phase 2.
         *
         * In phase 2 - triggered only when there is "html head" present in the DOM -
         * we take img.metaog-promote images and insert a
         *			<meta name="og:image" content="...">
         * tag into the <head> section for each one.
         */
        function($, metadata, dirty, done) {
        	logger.trace('open-graph-promote-images');
			var elements = [];
			$('open-graph-promote-images').each(function(i,elem){ elements.push(elem); });
			async.eachSeries(elements,
			function(element, next) {
				$(element).remove();
				var imgz = [];
				var selector = $(element).attr('root')
						? ($(element).attr('root') +' img')
						: 'img';
				$(selector).each(function(i, elem) { imgz.push(elem); });
				async.eachSeries(imgz,
					function(img, next2) {
						var imgurl = $(img).attr('src');
						if (imgurl.match(/\/img\/extlink.png/)
						 || imgurl.match(/\/img\/rss_button.png/)
						 || imgurl.match(/\/img\/rss_button.gif/)) {
						    // Ignore these images
						} else {
							$(img).addClass('metaog-promote');
						}
						next2();
						
					}, function(err) {
						if (err) next(err);
						else next();
					});
			}, function(err) {
				if (err) { logger.error(err); done(err); } 
				else { logger.trace('END open-graph-promote-images'); done(); }
			});
        },
        				
        /** Handle phase 2 of promoting image href's as og:image meta tags. */
        function($, metadata, dirty, done) {
        	logger.trace('img.metaog-promote');
			if ($('html head').get(0)) {
				var elements = [];
				$('img.metaog-promote').each(function(i,elem) {
					elements.push(elem);
				});
				async.eachSeries(elements,
				function(element, next) {
					$(element).removeClass('metaog-promote');
					var href = $(element).attr('src');
					if (href && href.length > 0) {
						var pHref = url.parse(href);
						// In case this is a site-relative URL, fix it up
						// to have the full URL.
						if (! pHref.host) {
							if (pHref.path.match(/^\//)) {
								href = config.root_url +'/'+ href;
							} else {
								var pRendered = url.parse(metadata.rendered_url);
								var dirRender = path.dirname(pRendered.path);
								var pRootUrl = url.parse(config.root_url);
								pRootUrl.pathname = dirRender +'/'+ href;
								href = url.format(pRootUrl);
							}
						}
					}
					akasha.partial('ak_metatag.html.ejs', {
						tagname: 'og:image',
						tagcontent: href
					}, function(err, txt) {
						if (err) { logger.error(err); next(err); }
						else { $('head').append(txt); next(); }
					});
				}, function(err) {
					if (err) { logger.error(err); done(err); } 
					else { logger.trace('END img.metaog-promote'); done(); }
				});
			} else done();
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('footnote');
        	// <footnote href="http:..." name="..." title="..." rel="nofollow">Description</footnote>
        	var footnoteCount = 0;
            var footnotes = [];
            $('footnote').each(function(i, elem) { footnotes.push(elem); });
            async.eachSeries(footnotes,
            function(footnote, next) {
            	var href = $(footnote).attr('href');
            	var name = $(footnote).attr('name');
            	var title = $(footnote).attr('title');
            	var rel   = $(footnote).attr('rel');
            	var text  = $(footnote).text();
            	akasha.partial("ak_footnoteRef.html.ejs", {
            		name: name
            	}, function(err, html) {
            		if (err) next(err);
            		else {
            			$(footnote).replaceWith(html);
            			
            			akasha.partial("ak_footnote.html.ejs", {
            				count: ++footnoteCount,
            				url: href,
            				title: title,
            				name: name,
            				description: text,
            				rel: rel
            			}, function(err2, html2) {
            				if (err2) next(err2);
            				else {
            					if ($('div#footnote-area').length <= 0) {
            						$(":root").append("<div id='footnote-area'><strong>Footnotes</strong><br></div>");
            					}
            					$('div#footnote-area').append(html2);
            					next();
            				}
            			});
            			
            		}
            	});
            	// next(new Error("footnote not yet implemented"));
            },
            function(err) {
				if (err) {
					logger.trace('partial Errored with '+ util.inspect(err));
					done(err);
				} else done();
        	});
        },
		
		function($, metadata, dirty, done) {
        	logger.trace('a modifications');
            var links = [];
            $('html body a').each(function(i, elem) { links.push(elem); });
            async.eachSeries(links,
            function(link, next) {
            	var href   = $(link).attr('href');
            	/*var text   = $(link).text();
            	var rel    = $(link).attr('rel');
            	var lclass = $(link).attr('class');
            	var id     = $(link).attr('id');
            	var name   = $(link).attr('name');
            	var title  = $(link).attr('title');*/
            	
            	// The potential exists to manipulate links to local documents
            	// Such as what's done with the linkto tag above.
            	// Such as checking for valid links
            	// Also need to consider links to //hostname/path/to/object
            	// Potential for complete link checking service right here
            	
            	if (href && href !== '#') {
					var uHref = url.parse(href, true, true);
					
					if (uHref.protocol || uHref.slashes) {
						// It's a link to somewhere else
						// look at domain in whitelist and blacklist
					
						var donofollow = false;
					
						if (config.nofollow && config.nofollow.blacklist) {
							config.nofollow.blacklist.forEach(function(re) {
								if (uHref.hostname.match(re)) {
									donofollow = true;
								}
							});
						}
						if (config.nofollow && config.nofollow.whitelist) {
							config.nofollow.whitelist.forEach(function(re) {
								if (uHref.hostname.match(re)) {
									donofollow = false;
								}
							});
						}
					
						if (donofollow && !$(link).attr('rel')) {
							$(link).attr('rel', 'nofollow');
						}
						
						if (! config.builtin.suppress.extlink
						 && $(link).find("img.ak-extlink-icon").length <= 0) {
							$(link).append('<img class="ak-extlink-icon" src="/img/extlink.png"/>');
						}
					
						next();
					} else {
						// This is where we would handle local links
						if (! href.match(/^\//)) {
						    var hreforig = href;
						    var pRenderedUrl = url.parse(metadata.rendered_url);
						    var docpath = pRenderedUrl.pathname;
						    var docdir = path.dirname(docpath);
							href = path.join(docdir, href);
							// util.log('***** FIXED href '+ hreforig +' to '+ href);
						}
            			var docEntry = akasha.findDocumentForUrlpath(config, href);
            			if (docEntry) {
            				// Automatically add a title= attribute
            				if (!$(link).attr('title') && docEntry.frontmatter.yaml.title) {
            					$(link).attr('title', docEntry.frontmatter.yaml.title);
            				}
            				// For local links that don't have text or interior nodes,
            				// supply text from the title of the target of the link.
            				var linktext = $(link).text();
            				if ((!linktext || linktext.length <= 0 || linktext === href)
            				 && $(link).children() <= 0
            				 && docEntry.frontmatter.yaml.title) {
            					$(link).text(docEntry.frontmatter.yaml.title);
            				}
            			}
            			next();
					}
				} else next();
            },
            function(err) {
				if (err) done(err);
				else done();
        	});
        }
];
