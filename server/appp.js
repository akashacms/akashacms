
/**
 * Experimental server that renders each page on each page view.  It's plausible as
 * an alternate user interface to admin'ing the site.  
 **/
 
var http = require('http');
var url  = require('url');
var path = require('path');
var util = require('util');
var fs   = require('fs');
var find = require('../lib/find');
var mime = require('mime');

var express = require('express');
// Not Needed: var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var app = express();

var routes = require('./routes');

var logger;

var akasha, config;

module.exports = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("server");
	routes.config(akasha, config);
    routes.readFiles(function(err) {
        if (err) {
            throw err;
        } else {
            var server = app.listen(8080, function () {

			  var host = server.address().address;
			  var port = server.address().port;

			  util.log('Example app listening at http://'+ host +':'+ port);

			});
        }
    });

};


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.get(/\.(css|js|jpg|gif|png|pdf)$/i, 
	function(req, res) {
		logger.trace(req.method +' '+ req.url);
		logger.trace(util.inspect(url.parse(req.url, true)));
		// logger.trace(util.inspect(req.params));
		var requrl = url.parse(req.url, true);
		find.assetFile(config, requrl.pathname, function(err, fname) {
			if (err) { logger.error(err); res.status(404).end(err); }
			else {
				logger.info('streaming '+ fname);
				fs.stat(fname, function(err, status) {
					if (err) {
						logger.error(err);
						res.status(404).end("file "+ fname +" not found "+err);
					} else {
						var m = mime.lookup(fname);
						logger.trace(fname +' '+ m +' '+ status.size);
						res.status(200);
						res.set({
							'Content-Type':  m,
							'Content-Length': status.size
						});
						var readStream = fs.createReadStream(fname);
						readStream.on('error', function(err) {
							res.end();
						});
						readStream.pipe(res);
					}
				});
			}
		});
	});

app.get(/\.html$/i, function(req, res, next) {

	var requrl = url.parse(req.url, true);
	logger.trace('akasha.express '+ requrl.pathname);
	var docEntry = module.exports.findDocumentForUrlpath(config, requrl.pathname);
	if (docEntry) {
		logger.trace('about to render '+ docEntry.path +' to '+ docEntry.renderedPathName);
		var renderopts = config2renderopts(config, docEntry);
		renderer.render(module.exports, config, docEntry, undefined, renderopts, function(err, rendered) {
			if (err) {
				logger.error(err);
				res.status(404).end(err);
			} else {
				logger.trace('success ... rendered='+ util.inspect(rendered));
				res.status(200).end(rendered.content);
			}
		});
	} else {
		logger.error(requrl.pathname +' not found');
		res.status(400).end(requrl.pathname +' not found');
	}

	// The above can be added as a function in AkashaCMS 
	// akasha.express(req, res, next);
});

app.get(/^\//, function(req, res) { res.redirect('/index.html'); });

