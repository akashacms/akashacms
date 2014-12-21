var path = require('path');
var util = require('util');
var url   = require('url');
var async = require('async');

var logger;

module.exports.config = function(akasha, config) {
	logger = akasha.getLogger("builtin");
	
    config.root_partials.push(path.join(__dirname, 'partials'));
    config.root_layouts.push(path.join(__dirname, 'layout'));
    config.root_assets.push(path.join(__dirname, 'assets'));
    
    if (config.mahabhuta) {
        config.mahabhuta.push(function($, metadata, done) {
            if (typeof metadata.pagetitle !== "undefined") {
                /*akasha.partialSync(config, 'ak_titletag.html.ejs', {
                  title: data.pagetitle !== "undefined" ? data.pagetitle : data.title
                }, function(err, html) {
                  
                });*/
                $('ak-page-title').replaceWith(
                    akasha.partialSync("ak_titletag.html.ejs", { title: metadata.pagetitle })
                );
            } else if (typeof metadata.title !== "undefined") {
                $('ak-page-title').replaceWith(
                    akasha.partialSync("ak_titletag.html.ejs", { title: metadata.title })
                );
            }
            
            // TBD Should reimplement this
            $('ak-header-metatags').replaceWith(config.funcs.akDoHeaderMeta(metadata));
            
            if (typeof metadata.rendered_url !== "undefined") {
                var ru = akasha.partialSync("ak_linkreltag.html.ejs", {
                        relationship: "canonical",
                        url: metadata.rendered_url
                    });
                $('ak-header-canonical-url').replaceWith(ru);
            }
            else {
                $('ak-header-canonical-url').remove(); 
            }
            
            if (typeof config.headerScripts !== "undefined") {
                $('ak-stylesheets').replaceWith(
                   akasha.partialSync("ak_stylesheets.html.ejs", { headerScripts: config.headerScripts })
                );
            }
            else {
                $('ak-stylesheets').remove();
            }
            
            if (typeof config.googleSiteVerification !== "undefined")
                $('ak-siteverification').replaceWith(
                    akasha.partialSync("ak_siteverification.html.ejs", 
                        { googleSiteVerification: config.googleSiteVerification })
                );
            else
                $('ak-siteverification').remove();
            
            if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptTop !== "undefined")
                $('ak-headerJavaScript').replaceWith(
                    akasha.partialSync("ak_javaScript.html.ejs", 
                        { javaScripts: config.headerScripts.javaScriptTop })
                    );
            else
                $('ak-headerJavaScript').remove();
            
            if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptBottom !== "undefined")
                $('ak-footerJavaScript').replaceWith(
                    akasha.partialSync("ak_javaScript.html.ejs", 
                        { javaScripts: config.headerScripts.javaScriptBottom })
                );
            else
                $('ak-footerJavaScript').remove();
            
            if (typeof config.googleAnalyticsAccount !== "undefined" && typeof config.googleAnalyticsDomain !== "undefined") {
                $('ak-google-analytics').replaceWith(
                    akasha.partialSync("ak_googleAnalytics.html.ejs", {
                        googleAnalyticsAccount: config.googleAnalyticsAccount,
                        googleAnalyticsDomain: config.googleAnalyticsDomain
                    })
                );
            }
            else
                $('ak-google-analytics').remove();
            
            $('ak-sitemapxml').each(function(i, elem) {
                $(this).replaceWith(
                    akasha.partialSync("ak_sitemap.html.ejs", {  })
                );
            });

            if (typeof metadata.content !== "undefined")
                $('ak-insert-body-content').replaceWith(metadata.content);
            else
                $('ak-insert-body-content').remove();
                
            if (typeof metadata.teaser !== "undefined" || typeof metadata["ak-teaser"] !== "undefined") {
                $('ak-teaser').each(function(i, elem) {
                    $(this).replaceWith(
                        akasha.partialSync("ak_teaser.html.ejs", {
                            teaser: typeof metadata["ak-teaser"] !== "undefined"
                                ? metadata["ak-teaser"] : metadata.teaser
                        })
                    )
                });
            } else {
                $('ak-teaser').remove();
            }
            
            done();
        });
        
        config.mahabhuta.push(function($, metadata, done) {
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
        });          
                               
        config.mahabhuta.push(function($, metadata, done) {
            // <partial file-name="file-name.html.whatever" data-attr-1=val data-attr-2=val/>
            var partials = [];
            $('partial').each(function(i, elem) { partials.push(elem); });
            async.eachSeries(partials,
            function(partial, next) {
                var fname = $(partial).attr("file-name");
                var d = {};
                for (var mprop in metadata) { d[mprop] = metadata[mprop]; }
                var data = $(partial).data();
                for (var dprop in data) { d[dprop] = data[dprop]; }
                logger.trace('partial tag fname='+ fname +' attrs '+ util.inspect(data));
                akasha.partial(fname, d, function(err, html) {
                    if (err) {
                        logger.trace('partial ERROR '+ util.inspect(err));
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
                logger.trace('partial Errored with '+ util.inspect(err));
                done(err);
              } else {
                done();
              }
            });
        });
        
        config.mahabhuta.push(function($, metadata, done) {
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
				} else {
					done();
				}
        	});
        });
        
        config.mahabhuta.push(function($, metadata, done) {
            var links = [];
            $('a').each(function(i, elem) { links.push(elem); });
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
            	
            	if (href) {
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
						
						if ($(link).find("img.ak-extlink-icon").length <= 0) {
							$(link).append('<img class="ak-extlink-icon" src="/img/extlink.png"/>');
						}
					
						next();
					} else {
						// This is where we would handle local links
            			var docEntry = akasha.findDocumentForUrlpath(config, href);
            			if (docEntry) {
            				if (!$(link).attr('title')
            				 && docEntry.frontmatter.yaml.title) {
            					$(link).attr('title', docEntry.frontmatter.yaml.title);
            				}
            				var linktext = $(link).text();
            				if ((!linktext || linktext.length <= 0 || linktext === href)
            				 && docEntry.frontmatter.yaml.title) {
            					$(link).text(docEntry.frontmatter.yaml.title);
            				}
            			}
            			next();
					}
				} else next();
            },
            function(err) {
				if (err) {
					done(err);
				} else {
					done();
				}
        	});
        });
    }
    
    config.funcs.akDoHeaderMeta = function(arg, callback) {
        var data = {};
        for (var prop in arg) {
            if (!(prop in data)) data[prop] = arg[prop];
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
        
        var val = akasha.partialSync("ak_headermeta.html.ejs", data);
        if (callback) callback(undefined, val);
        return val;
    }
}