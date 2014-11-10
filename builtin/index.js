var path = require('path');
var util = require('util');
var async = require('async');

var logger;

module.exports.config = function(akasha, config) {
	logger = akasha.getLogger("builtin");
	
    config.root_partials.push(path.join(__dirname, 'partials'));
    config.root_layouts.push(path.join(__dirname, 'layout'));
    
    if (config.mahabhuta) {
        config.mahabhuta.push(function(akasha, config, $, metadata, done) {
            if (typeof metadata.pagetitle !== "undefined") {
                /*akasha.partialSync(config, 'ak_titletag.html.ejs', {
                  title: data.pagetitle !== "undefined" ? data.pagetitle : data.title
                }, function(err, html) {
                  
                });*/
                $('ak-page-title').replaceWith(
                    akasha.partialSync(config, "ak_titletag.html.ejs", { title: metadata.pagetitle })
                );
            } else if (typeof metadata.title !== "undefined") {
                $('ak-page-title').replaceWith(
                    akasha.partialSync(config, "ak_titletag.html.ejs", { title: metadata.title })
                );
            }
            
            // TBD Should reimplement this
            $('ak-header-metatags').replaceWith(config.funcs.akDoHeaderMeta(metadata));
            
            if (typeof metadata.rendered_url !== "undefined") {
                var ru = akasha.partialSync(config, "ak_linkreltag.html.ejs", {
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
                   akasha.partialSync(config, "ak_stylesheets.html.ejs", { headerScripts: config.headerScripts })
                );
            }
            else {
                $('ak-stylesheets').remove();
            }
            
            if (typeof config.googleSiteVerification !== "undefined")
                $('ak-siteverification').replaceWith(
                    akasha.partialSync(config, "ak_siteverification.html.ejs", 
                        { googleSiteVerification: config.googleSiteVerification })
                );
            else
                $('ak-siteverification').remove();
            
            if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptTop !== "undefined")
                $('ak-headerJavaScript').replaceWith(
                    akasha.partialSync(config, "ak_javaScript.html.ejs", 
                        { javaScripts: config.headerScripts.javaScriptTop })
                    );
            else
                $('ak-headerJavaScript').remove();
            
            if (typeof config.headerScripts !== "undefined" && typeof config.headerScripts.javaScriptBottom !== "undefined")
                $('ak-footerJavaScript').replaceWith(
                    akasha.partialSync(config, "ak_javaScript.html.ejs", 
                        { javaScripts: config.headerScripts.javaScriptBottom })
                );
            else
                $('ak-footerJavaScript').remove();
            
            if (typeof config.googleAnalyticsAccount !== "undefined" && typeof config.googleAnalyticsDomain !== "undefined") {
                $('ak-google-analytics').replaceWith(
                    akasha.partialSync(config, "ak_googleAnalytics.html.ejs", {
                        googleAnalyticsAccount: config.googleAnalyticsAccount,
                        googleAnalyticsDomain: config.googleAnalyticsDomain
                    })
                );
            }
            else
                $('ak-google-analytics').remove();
            
            $('ak-sitemapxml').each(function(i, elem) {
                $(this).replaceWith(
                    akasha.partialSync(config, "ak_sitemap.html.ejs", {  })
                );
            });

            if (typeof metadata.content !== "undefined")
                $('ak-insert-body-content').replaceWith(metadata.content);
            else
                $('ak-insert-body-content').remove();
                
            if (typeof metadata.teaser !== "undefined" || typeof metadata["ak-teaser"] !== "undefined") {
                $('ak-teaser').each(function(i, elem) {
                    $(this).replaceWith(
                        akasha.partialSync(config, "ak_teaser.html.ejs", {
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
            
        config.mahabhuta.push(function(akasha, config, $, metadata, done) {
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
                // logger.trace('partial tag fname='+ fname +' attrs '+ util.inspect(data));
                akasha.partial(config, fname, d, function(err, html) {
                    if (err) {
                        // logger.trace('partial ERROR '+ util.inspect(err));
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
                // logger.trace('partial Errored with '+ util.inspect(err));
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
        
        var val = akasha.partialSync(config, "ak_headermeta.html.ejs", data);
        if (callback) callback(undefined, val);
        return val;
    }
}