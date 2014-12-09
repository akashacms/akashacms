
var fs        = require('fs');
var path      = require('path');
var mime      = require('mime');
var async     = require('async');
var util      = require('util');
var url       = require('url');
var mahabhuta = require('../lib/mahabhuta');
var cheerio   = require('cheerio');

var akasha, config, logger;

exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("routes");
};

var templateList = [
	{ name: "baseHtml", fname: path.join(__dirname, "base.html") },
	{ name: "txtEditForm", fname: path.join(__dirname, "form-edit.html") },
	{ name: "txtAddForm", fname: path.join(__dirname, "form-add.html") },
	{ name: "dirAddForm", fname: path.join(__dirname, "form-adddir.html") },
	{ name: "txtDeleteForm", fname: path.join(__dirname, "form-delete.html") },
	{ name: "toolbar", fname: path.join(__dirname, "toolbar.html") },
	{ name: "viewPage", fname: path.join(__dirname, "viewer-page.html") }
];

var templates = [];

exports.readFiles = function(cb) {
	async.eachSeries(templateList,
	function(template, next) {
		fs.readFile(template.fname, { encoding: 'utf8' }, function(err, data) {
			if (err) next(err);
			else {
				templates[template.name] = data;
				next();
			}
		});
	},
	function(err) {
		// logger.trace(util.inspect(templates));
		if (err) cb(err);
		else cb();
	});
	
}

var findTemplate = function(nm) {
	// logger.trace('nm='+ nm +' template='+ util.inspect(templates[nm]));
	return templates[nm];
};

exports.serveHtml = function(req, res, next) {
	res.status(200).end(req.$.html());
};

exports.baseTemplate = function(req, res, next) {
	req.$ = newCheerio(findTemplate("baseHtml"));
	next();
};

exports.setupTemplate = function(templateName) {
	return function(req, res, next) {
		req.$ = newCheerio(findTemplate("baseHtml"));
		req.$('body').append(findTemplate(templateName));
		next();
	};
};

var doCheckDirectory = function(req, res, next, basepath) {
	var urlpath = req.params[0];
	var fname = path.join(basepath, urlpath);
	var requrl = url.parse(req.url);
	logger.trace('doCheckDirectory '+ urlpath +' '+ fname);
	fs.stat(fname, function(err, status) {
		if (err) {
			res.status(404).end("file "+ fname +" not found "+ err);
		} else {
			if (status.isDirectory()) {
				res.redirect(path.join(requrl.pathname, "index.html"));
			} else {
				next();
			}
		}
	});
};

exports.checkEditorAssetsDirectory = function(req, res, next) {
	doCheckDirectory(req, res, next, path.join(__dirname, "assets"));
};

exports.checkDirectory = function(req, res, next) {
	doCheckDirectory(req, res, next, config.root_out);
};

var mkBreadcrumbTrail = function(urlpath, done) {
	var ret = '<li><button type="button" class="btn btn-primary" autocomplete="off" ak-path="/"><span class="glyphicon glyphicon-home" aria-hidden="true"></span>HOME</button></li>';
	var cmps = urlpath.split('/');
	if (cmps.length > 0) {
		var path = '';
		logger.trace(util.inspect(cmps));
		async.eachSeries(cmps,
			function(cmp, next) {
				logger.trace(cmp);
				if (cmp.length > 0) {
					mahabhuta.process1('<li><button type="button" class="btn btn-primary" autocomplete="off" ak-path=""></button></li>',
						function($, done) {
							path += '/'+ cmp;
							$('button').attr('ak-path', path);
							$('button').text(cmp);
							done();
						},
						function(err, html) {
							if (err) next(err);
							else {
								logger.trace(html);
								ret += html;
								next();
							}
						});
				} else next();
			},
			function(err) {
				if (err) done(err);
				else done(undefined, ret);
			});
	} else {
		done(undefined, ret);
	}
};

exports.breadcrumbTrail = function(req, res, next) {
	if (req.$('#ak-editor-breadcrumbs').length > 0) {
		var urlpath = req.params[0];
		mkBreadcrumbTrail(urlpath, function(err, bdt) {
			if (err) {
				req.$('#ak-editor-breadcrumbs').empty();
				next();
			} else {
				req.$('#ak-editor-breadcrumbs').append('<ol class="breadcrumb"></ol>');
				req.$('#ak-editor-breadcrumbs ol.breadcrumb').append(bdt);
				req.$('#ak-editor-breadcrumbs').attr("ak-path", urlpath);
				next();
			} 
		});
	} else next();
};

exports.apiBreadcrumbTrail = function(req, res, next) {
	var urlpath = req.params[0];
	mkBreadcrumbTrail(urlpath, function(err, bdt) {
		if (err) res.status(404).end("bad path "+ urlpath);
		else {
			logger.trace('apiBreadcrumbTrail '+ urlpath +' '+ bdt);
			res.status(200).json({ 
				akpath: urlpath,
				html: bdt
			});
		}
	});
};

var mkSidebarFiles = function(urlpath, done) {
	akasha.dirPathForDocument(config, urlpath, function(err, dirpathInfo) {
		if (err) {
			done(err);
		} else {
			fs.readdir(dirpathInfo.dirpath, function(err, files) {
				if (err) {
					done(err);
				} else {
					var ret = '';
					
					async.eachSeries(files,
						function(file, next) {
							// logger.trace('mkSidebarFiles file='+ file);
							var akpath = dirpathInfo.path.match(/^\//) ? dirpathInfo.path : '/'+ dirpathInfo.path;
							mahabhuta.process('<span class="label label-default " ak-path=""><span class="glyphicon" aria-hidden="true"></span><span class="ak-label-text"></span></span><br>',
								undefined, [
								function($, metadata, done) {
									var stats = fs.statSync(path.join(dirpathInfo.dirpath, file));
									if (stats.isDirectory()) {
										if (file === "." || file === "..") {
											done();
										} else {
											$('span.glyphicon').addClass('glyphicon-folder-close');
											$('span.label').addClass('folder');
											akpath += akpath.match(/\/$/) ? file : '/'+ file;
											$('span.label').attr('ak-path', akpath);
											$('span.ak-label-text').text(file);
											done();
										}
									} else if (file.match(/\.(png|jpg|jpeg|gif)$/i)) {
										$('span.glyphicon').addClass('glyphicon-picture');
										$('span.label').addClass('image');
										akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									} else if (file.match(/\.(zip|gz)$/i)) {
										$('span.glyphicon').addClass('glyphicon-compressed');
										$('span.label').addClass('compressed');
										// akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									} else if (file.match(/\.(mov|mp4|avi|mkv)$/i)) {
										$('span.glyphicon').addClass('glyphicon-film');
										$('span.label').addClass('movie');
										// akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									} else if (file.match(/\.(doc|pdf)$/i)) {
										$('span.glyphicon').addClass('glyphicon-book');
										$('span.label').addClass('document');
										// akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									} else if (file.match(/\.(html.md|html.ejs.md|html.ejs|php.md|php.ejs.md|php.ejs)$/i)) {
										$('span.glyphicon').addClass('glyphicon-pencil');
										$('span.label').addClass('editable');
										akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									} else {
										$('span.glyphicon').addClass('glyphicon-file');
										$('span.label').addClass('unknown-file');
										// akpath += akpath.match(/\/$/) ? file : '/'+ file;
										$('span.label').attr('ak-path', akpath);
										$('span.ak-label-text').text(file);
										done();
									}
								} ],
								function(err, html) {
									if (err) next(err);
									else {
										// logger.trace(html);
										ret += html;
										next();
									}
								});
						},
						function(err) {
							if (err) done(err);
							else done(undefined, ret, dirpathInfo.dirname);
						});
				}
			});
		}
	});
};

exports.sidebarFilez = function(req, res, next) {
	if (req.$("#ak-editor-files-sidebar").length > 0) {
		var urlpath = req.params[0];
		mkSidebarFiles(urlpath, function(err, list, dirpath) {
			if (err) res.status(500).end(err);
			else {
				req.$("#ak-editor-files-sidebar").append(list);
				req.$("#ak-editor-files-sidebar").attr("ak-path", urlpath);
				req.$("#ak-editor-files-sidebar").attr("dirpath", dirpath);
				next();
			}
		});
	} else next();
};

exports.apiSidebarFilesList = function(req, res, next) {
	var urlpath = req.params[0];
	mkSidebarFiles(urlpath, function(err, list, dirpath) {
		logger.trace('apiSidebarFilesList '+ urlpath +' '+ list);
		if (err) res.status(500).end(err);
		else res.status(200).json({ 
			akpath: urlpath,
			dirpath: dirpath,
			html: list
		});
	});
};

exports.apiImageViewer = function(req, res, next) {
	var urlpath = req.params[0];
	mahabhuta.process1('<img src="" class="img-responsive">', 
		function($, done) {
			$('img').attr("src", urlpath);
			done();
		}, 
		function(err, html) {
			res.status(200).json({ html: html });
		});
};

exports.apiPageViewer = function(req, res, next) {
	var urlpath = req.params[0];
	var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
	mahabhuta.process1(findTemplate("viewPage"), 
		function($, done) {
			$('iframe').attr("src", docEntry.renderedFileName);
			done();
		}, 
		function(err, html) {
			res.status(200).json({ html: html });
		});
};

exports.apiPostAddNewDir = function(req, res) {
	logger.trace(util.inspect(req.body));
	var dirnm = path.join(config.root_docs[0], req.body.urlpath, req.body.pathname);
	logger.trace('apiPostAddNewDir '+ dirnm);
	fs.mkdir(dirnm, function(err) {
		if (err) {
			logger.error("Could not create directory "+ dirnm +" because "+ err);
			res.status(404).end("Could not create directory "+ dirnm +" because "+ err);
		} else {
			var dirnm2 = path.join(config.root_out, req.body.urlpath, req.body.pathname);
			logger.trace('apiPostAddNewDir #2 '+ dirnm2);
			fs.mkdir(dirnm2, function(err) {
				if (err) {
					logger.error("Could not create directory "+ dirnm2 +" because "+ err);
					res.status(404).end("Could not create directory "+ dirnm2 +" because "+ err);
				} else {
					// Now what?
					// Need to make the user create dirnm/index.html
					res.status(200).json({
						akpath: path.join(req.body.urlpath, req.body.pathname)
					});
					// res.status(200).redirect(path.join('/..admin/addindexpage', req.body.dirname, req.body.pathname));
				}
			});
		}
	});
};

exports.apiPostAddNewFile = function(req, res) {
	logger.trace('in /..api/saveNewFile' + util.inspect(req.body));
	// var fname = path.join(config.root_docs[0], path.dirname(body.urlpath), body.pathname.trim());
	var fname = path.join(req.body.dirname, req.body.pathname.trim());
	if (req.body.fnextension) fname += req.body.fnextension;
	// logger.trace('fname='+ fname);
	akasha.createDocument(config, config.root_docs[0],
		fname,
		trimtxt(req.body.metadata), trimtxt(req.body.content), function(err, docEntry) {
			if (err) {
				// Need to send an error message instead
				res.status(500).end("Error while creating "+ fname +" "+ err);
				logger.error('FAIL received from createDocument because '+ err);
			} else {
				// logger.trace(util.inspect(docEntry));
				akasha.renderFile(config, docEntry.path, function(err) {
					if (err) {
						logger.error("Could not render "+ docEntry.fullpath +" because "+ err);
						res.status(404).end("Could not render "+ docEntry.fullpath +" because "+ err);
					} else {
						// redirect(res, path.join(path.dirname(body.urlpath), path.basename(docEntry.renderedFileName)));
						res.status(200).json({
							akpath: '/'+ docEntry.path
						});
					}
				});
			}
	});
};

exports.apiPostAddEditedFile = function(req, res) {
	logger.trace('in /..api/saveEditedFile' + util.inspect(req.body));
	var docEntry = akasha.findDocumentForUrlpath(config, req.body.urlpath);
	if (docEntry) {
		// logger.trace('found docEntry for urlpath '+ body.urlpath +' '+ util.inspect(docEntry));
		akasha.updateDocumentData(config, docEntry,
				 trimtxt(req.body.metadata), trimtxt(req.body.content),
				 function(err) {
			logger.trace("Inside updateDocumentData");
			if (err) {
				// Need to send an error message instead
				logger.error("Could not update "+ docEntry.fullpath +" because "+ err);
				res.status(404).end("Could not update "+ docEntry.fullpath +" because "+ err);
			} else {
				logger.trace('before renderFile '+ docEntry.path);
				akasha.renderFile(config, docEntry.path, function(err) {
					if (err) {
						logger.error("Could not render "+ docEntry.fullpath +" because "+ err);
						res.status(404).end("Could not render "+ docEntry.fullpath +" because "+ err);
					} else {
						res.status(200).json({
							akpath: req.body.urlpath
						});
					}
				});
			}
		});
	} else {
		// Need to send an error message instead
		logger.error("No docEntry found for "+ req.body.urlpath);
		res.status(404).end("No docEntry found for "+ req.body.urlpath);
	}
};

exports.apiDeleteFileConfirm = function(req, res) {
	logger.trace('in /..api/deleteFileConfirm ' + util.inspect(req.body));
	
	var docEntry = akasha.findDocumentForUrlpath(config, req.body.urlpath);
	if (docEntry) {
		// logger.trace(util.inspect(docEntry));
		// logger.trace('deleting docEntry '+ docEntry.path);
		akasha.deleteDocumentForUrlpath(config, docEntry.path, function(err) {
			if (err) {
				logger.error("Could not delete "+ req.body.urlpath +" because "+ err);
				res.status(404).end("Could not delete "+ req.body.urlpath +" because "+ err);
			} else {
				// logger.trace('deleting '+ path.join(config.root_out, docEntry.renderedFileName));
				fs.unlink(path.join(config.root_out, docEntry.renderedFileName), function(err2) {
					if (err2) {
						logger.error("Could not delete "+ path.join(config.root_out, docEntry.renderedFileName) +" because "+ err2);
						res.status(404).end("Could not delete "+ path.join(config.root_out, docEntry.renderedFileName) +" because "+ err2);
					} else {
						// logger.trace('redirecting to '+ path.dirname(req.body.urlpath));
						res.status(200).json({
							akpath: path.dirname(req.body.urlpath)
						});
					}
				});
			}
		});
	} else {
		logger.error("Could not delete "+ req.body.urlpath +" because it doesn't exist");
		res.status(404).end("Could not delete "+ req.body.urlpath +" because it doesn't exist");
	}
};

////////////////////// OLD FUNCTIONS TO BE REPLACED MAYBE

exports.addIndexPage = function(req, res) {
	var urlpath = req.params[0];
	var $ = newCheerio(findTemplate("baseHtml"));
	$('body').append(prepareIndexCreateForm(urlpath));
	logger.trace($.html());
	res.end($.html());
};

exports.fullBuild = function(req, res) {
	var urlpath = req.params[0];
	akasha.process(config, function(err) {
		if (err) res.status(404).end("Failed to rebuild site because "+ err);
		else {
			logger.trace(urlpath);
			res.redirect(urlpath);
		}
	});
};

exports.docData = function(req, res) {
	var urlpath = req.params[0];
	logger.trace('docData call '+ urlpath);
	var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
	if (docEntry) {
		logger.trace('docData result '+ urlpath);
		res.status(200).json({
			urlpath: urlpath,
			metadata: docEntry.frontmatter.yamltext,
			content: docEntry.frontmatter.text
		});
	} else {
		logger.trace("file "+ urlpath +" doesn't exist");
		res.status(404).end("file "+ urlpath +" doesn't exist");
	}
};

exports.streamFile = function(req, res, requrl, fname) {
    logger.info('streamFile '+ fname /*+' '+ util.inspect(requrl)*/);
    /*if (requrl.pathname.match(/\.html$/)) {
        fs.readFile(fname, { encoding: 'utf8' }, function(err, buf) {
            if (err) {
                res.status(404).end("file "+ fname +" not readable "+ err);
            } else {
                var $ = newCheerio(buf);
                var docEntry = akasha.findDocumentForUrlpath(config, requrl.pathname);
                // logger.trace('streamFile '+ requrl.pathname);
                // logger.trace(util.inspect(docEntry));
                // $('body').wrapInner('<div id="ak-original-content"></div>');
                $('body').prepend(findTemplate("toolbar"));
                $("#ak-editor-file-name").append("<strong>File Name: "+ requrl.pathname +"</strong>");
                $("#ak-editor-edit-link").attr('href', "/..admin/editpage"+requrl.pathname);
                $("#ak-editor-delete-link").attr('href', "/..admin/deletepage"+requrl.pathname);
                $("#ak-editor-addnew-link").attr('href', "/..admin/addnewpage"+requrl.pathname);
                $("#ak-editor-addnewdir-link").attr('href', "/..admin/addnewdir"+requrl.pathname);
                $("#ak-editor-full-build-link").attr('href', "/..admin/fullbuild"+requrl.pathname);
                /*$('body').append(
                    '<script src="/..admin/js/editor.js"></script>'
                   +'<script src="/..admin/vendor/ace-1.1.7/ace.js" type="text/javascript" charset="utf-8"></script>'
                );* /
                $('html head').append(
                    '<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
                );
                var ht = $.html();
                res.status(200).set({
                    'Content-Type': mime.lookup(fname),
                    'Content-Length': ht.length
                });
                res.end(ht);
            }
        });
    } else {*/
        fs.stat(fname, function(err, status) {
            if (err) {
                res.status(404).end("file "+ fname +" not found "+err);
            } else {
            	logger.info('fname = '+ fname);
            	var m = mime.lookup(fname);
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
    /*} */
};

var prepareDocEditForm = function(urlpath, metadata, content) {
    var $ = newCheerio(findTemplate("txtEditForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
    doBreadcrumb($, urlpath, '/..admin/editPage');
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDirCreateForm = function(urlpath) {
	// logger.trace('prepareDirCreateForm urlpath='+ urlpath);
	var t = findTemplate("dirAddForm");
	// logger.trace(t);
    var $ = newCheerio(t);
    $('#ak-adddir-urlpath').attr('value', urlpath);
    $('#ak-adddir-dirname').attr('value', path.dirname(urlpath));
    $('#ak-adddir-add-dirname').append(path.dirname(urlpath));
    doBreadcrumb($, urlpath, '/..admin/addnewdir');
    // logger.trace($.html());
    return $.html();
};

var prepareDocCreateForm = function(urlpath, dirname /*, fname, metadata, content */) {
	// logger.trace('prepareDocCreateForm urlpath='+ urlpath +' dirname='+ dirname);
    var $ = newCheerio(findTemplate("txtAddForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-pathname-input').attr('value', "");
    doBreadcrumb($, urlpath, '/..admin/addnewpage');
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareIndexCreateForm = function(dirname) {
	// logger.trace('prepareDirCreateForm dirname='+ dirname);
    var $ = newCheerio(findTemplate("txtAddForm"));
    $('#ak-editor-urlpath').attr('value', dirname);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-fnextension').remove();
    $('#ak-editor-pathname-input').replaceWith(
    	'<input type=hidden name=pathname id="ak-editor-pathname-input" value="index.html.md">'
       +'<span id="ak-editor-add-dirname">/index.html.md</span>'
    );
    $('#ak-editor-metadata-input').append("layout: index-page.html.ejs\ntitle: \n");
    doBreadcrumb($, urlpath, '/..admin/addindexpage');
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDocDeleteForm = function(urlpath) {
    var $ = newCheerio(findTemplate("txtDeleteForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
    doBreadcrumb($, urlpath, '/..admin/deletepage');
    return $.html();
};

// The normal Javascript String.strim function only removes whitespace
// However we observe excess \r's and blank lines sometimes inserted at beginning and end of text

var trimtxt = function(txt) {
    var lines = txt.split('\n');
    var i;
    for (i = 0; i < lines.length; i++) {
        lines[i] = lines[i].replace(/\r*$/, "");
    }
    while (lines.length > 0 && lines[lines.length - 1].length === 0) {
        lines.pop();
    }
    while (lines.length > 0 && lines[0].length === 0) {
        lines.shift();
    }
    return lines.join('\n');
};

var newCheerio = function(buf) {
	if (!buf) throw new Error("no text buffer supplied");
    return cheerio.load(buf, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
};
