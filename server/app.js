
var http  = require('http');
var url   = require('url');
var path  = require('path');
var util  = require('util');
var fs    = require('fs');
var async = require('async');
var sse   = require('sseasy');
var log4js  = require('log4js');

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
	log4js.addAppender(streamAppender.appender, 'akashacms', 'routes');
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
}


//*********** Catch errors using domain module
var domain = require('domain');
var useDomain = function(req, res, next) {
    var reqd = domain.create();
    reqd.add(req);
    reqd.add(res);
    reqd.on('error', function(er) {
      console.error('Error', er, req.url);
      try {
        res.writeHead(500);
        res.end('Error occurred, sorry.');
      } catch (er) {
        console.error('Error sending 500', er, req.url);
      }
    });
    next();
}
//*********** End domain module

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//  Not Needed: app.use(cookieParser());

var streamAppender = {
	openRes: [],
	appender: function(loggingEvent) {
		// Work around a problem with sseasy in which it's only sending 158 or so messages
		// to the browser.  This ensures we're only sending INFO messages to the browser,
		// and some code above limits the messages to the akashacms and routes modules.
		// Hence, the user see's more of the activity log and isn't inundated if the logging
		// happens to be turned all the way up.
		if (loggingEvent.level.levelStr === "INFO") {
			// util.log('streamAppender loggingEvent='+ util.inspect(loggingEvent));
			var tolog = '['+ loggingEvent.startTime +'] '+ loggingEvent.categoryName 
					   +' '+ loggingEvent.level.levelStr +' '+ loggingEvent.data;
			// util.log(tolog);
			async.each(streamAppender.openRes, function(res, done) {
				res.sse.write(tolog, "utf8");
				done();
			},
			function(err) {
			});
		}
	},
	configure: function(log4jsconfig, options) {
	},
	shutdown: function(cb) {
		util.log('***** SHUTDOWN streamAppender.shutdown');
		async.each(streamAppender.openRes, function(res, done) {
			if (!res.sse.write('\n', "utf-8")) {
				res.sse.once('drain', function() {
					res.sse.end(done);
				});
			} else {
				res.sse.end(done);
			}
		}, cb);
	},
	register: function(req, res) {
		streamAppender.openRes.push(res);
		res.sse.write(config.data.metaOGsite_name, "utf-8");
		res.on('close', function() {
			util.log('***** CLOSE streamAppender.close');
			var indx = streamAppender.openRes.indexOf(res);
			if (indx >= 0) streamAppender.openRes.splice(indx, 1);
		});
	}
};
process.on('exit', function() {
	streamAppender.shutdown(function(err) { });
});

app.get(/^\/\.\.stream-logs/, sse(), streamAppender.register);

app.get(/^\/\.\.assets(\/.*)/, 
	useDomain,
	routes.checkEditorAssetsDirectory,
	function(req, res) {
		// logger.trace(req.method +' '+ req.url);
		// logger.trace(util.inspect(url.parse(req.url, true)));
		// logger.trace(util.inspect(req.params));
		var requrl = url.parse(req.params[0], true);
		routes.streamFile(req, res, requrl, path.join(__dirname, 'assets', requrl.pathname));
	});

app.get(/^\/\.\.api\/download(\/.*)/,
	useDomain,
	routes.apiDownloadFile);

app.get(/^\/\.\.api\/breadcrumbTrail/, // (\/.*)/,
	useDomain,
	routes.apiBreadcrumbTrail);

app.get(/^\/\.\.api\/sidebarFilesList/, // (\/.*)/,
	useDomain,
	routes.apiSidebarFilesList);

app.get(/^\/\.\.api\/docData/, // (\/.*)/,
	useDomain,
	routes.docData);
	
app.get(/^\/\.\.api\/fileViewer/, // (\/.*)/,
	useDomain,
	routes.apiFileViewer);
	
app.get(/^\/\.\.api\/showViewerModalEditorLinkPage/, // (\/.*)/,
	useDomain,
	routes.apiShowViewerModalEditorLinkPage);
	
app.post(/^\/\.\.api\/addnewdir/,
	useDomain,
	routes.apiPostAddNewDir);

app.post(/^\/\.\.api\/saveNewFile/,
	useDomain,
	routes.apiPostAddNewFile);

app.post(/^\/\.\.api\/saveEditedFile/,
	useDomain,
	routes.apiPostAddEditedFile);

app.post(/^\/\.\.api\/deleteFileConfirm/,
	useDomain,
	routes.apiDeleteFileConfirm);

app.post(/^\/\.\.api\/uploadFiles/,
	useDomain,
	routes.apiUploadFiles);

app.get(/^\/\.\.api\/fullbuild/,
	useDomain,
	routes.apiFullBuild);
	
app.get(/^\/\.\.api\/deploysite/,
	useDomain,
	routes.apiDeploySite);
	
app.get(/^(\/.+)/, 
	useDomain,
	function(req, res) {
		logger.trace(req.method +' '+ req.url +' path='+ unescape(req.path));
		logger.trace(util.inspect(url.parse(req.url, true)));
		// logger.trace(util.inspect(req.params));
		// var requrl = url.parse(req.params[0], true);
		var requrl;
		var fname = path.join(config.root_out, unescape(req.path));
		fs.stat(fname, function(err, stats) {
			if (stats) {
				// logger.trace('streaming '+ fname +' for '+ requrl.pathname);
				routes.streamFile(req, res, requrl, fname);
			} else {
				akasha.readDocumentEntry(config, unescape(req.path), function(err, entry) {
					if (err) {
						logger.error('not found '+ err);
						res.status(404).end(err.toString());
					} else {
						// logger.trace('streaming entry '+ entry.renderedFileName +' for '+ requrl.pathname);
						// logger.trace(util.inspect(entry));
						routes.streamFile(req, res, requrl, entry.renderedFileName);
					}
				});     	
			}
		});
	});

app.get(/^(\/)/, 
	useDomain,
	routes.baseTemplate,
	routes.breadcrumbTrail,
	routes.sidebarFilez,
	routes.serveHtml);



