
var http = require('http');
var url  = require('url');
var path = require('path');
var util = require('util');
var fs   = require('fs');

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

/*function logErrors(err, req, res, next) {
	logger.trace(req.method +' '+ req.url);
	logger.trace(util.inspect(url.parse(req.url, true)));
	logger.trace(util.inspect(req.params));
  if (err) console.error(err.stack);
  next(err);
}

app.use(logErrors);*/
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//  Not Needed: app.use(cookieParser());

app.get(/^\/\.\.admin\/editpage(\/.*)/, useDomain, routes.editPage);
app.get(/^\/\.\.admin\/addnewdir(\/.*)/, useDomain, routes.addNewDir);
app.get(/^\/\.\.admin\/addnewpage(\/.*)/, useDomain, routes.addNewPage);
app.get(/^\/\.\.admin\/addindexpage(\/.*)/, useDomain, routes.addIndexPage);
app.get(/^\/\.\.admin\/deletepage(\/.*)/, useDomain, routes.deletePage);
app.get(/^\/\.\.admin\/fullbuild(\/.*)/, useDomain, routes.fullBuild);
app.get(/^\/\.\.admin\/docData(\/.*)/, useDomain, routes.docData);

app.get(/^\/\.\.admin(\/.*)/, useDomain, function(req, res) {
	// logger.trace(req.method +' '+ req.url);
	// logger.trace(util.inspect(url.parse(req.url, true)));
	// logger.trace(util.inspect(req.params));
	var requrl = url.parse(req.params[0], true);
	routes.streamFile(req, res, requrl, path.join(__dirname, 'assets', requrl.pathname));
});

app.get(/(\/.*)/, useDomain, function(req, res) {
	var requrl = url.parse(req.url, true);
	var fname  = path.join(config.root_out, requrl.pathname);
	// logger.trace(req.method +' url='+ req.url +' fname='+ fname);
	// logger.trace(util.inspect(url.parse(req.url, true)));
	fs.stat(fname, function(err, status) {
		if (err) {
			res.status(404).send("file "+ fname +" not found "+ err);
		} else {
			if (status.isDirectory()) {
				res.redirect(path.join(requrl.pathname, 'index.html'));
			} else {
				routes.streamFile(req, res, requrl, fname);
			}
		}
	});
});

app.post("/..admin/edit", useDomain, routes.postEdit);
app.post("/..admin/add", useDomain, routes.postAdd);
app.post("/..admin/delete", useDomain, routes.postDelete);
app.post("/..admin/adddir", useDomain, routes.postAddDir);


