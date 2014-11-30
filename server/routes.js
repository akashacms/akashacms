
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var async   = require('async');
var util    = require('util');
var cheerio = require('cheerio');

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
	{ name: "toolbar", fname: path.join(__dirname, "toolbar.html") }
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
	logger.trace('nm='+ nm +' template='+ util.inspect(templates[nm]));
	return templates[nm];
}

exports.editPage = function(req, res) {
	var urlpath = req.params[0];
	// logger.trace(util.inspect(matches));
	// logger.trace('urlpath '+ urlpath);
	var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
	if (docEntry) {
		var $ = newCheerio(findTemplate("baseHtml"));
		$('body').append(prepareDocEditForm(
					urlpath,
					docEntry.frontmatter.yamltext,
					docEntry.frontmatter.text));
		logger.trace($.html());
		res.end($.html());
	} else {
		res.status(404).end("file "+ urlpath +" doesn't exist");
	}
};

exports.addNewDir = function(req, res) {
	var urlpath = req.params[0];
	var $ = newCheerio(findTemplate("baseHtml"));
	$('body').append(prepareDirCreateForm(urlpath));
	logger.trace($.html());
	res.end($.html());
};

exports.addNewPage = function(req, res) {
	var urlpath = req.params[0];
	var $ = newCheerio(findTemplate("baseHtml"));
	$('body').append(prepareDocCreateForm(
					urlpath,
					path.dirname(urlpath)));
	logger.trace($.html());
	res.end($.html());
};

exports.addIndexPage = function(req, res) {
	var urlpath = req.params[0];
	var $ = newCheerio(findTemplate("baseHtml"));
	$('body').append(prepareIndexCreateForm(urlpath));
	logger.trace($.html());
	res.end($.html());
};

exports.deletePage = function(req, res) {
	var urlpath = req.params[0];
	var $ = newCheerio(findTemplate("baseHtml"));
	$('body').append(prepareDocDeleteForm(urlpath));
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
	var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
	if (docEntry) {
		logger.trace('docData result '+ urlpath);
		res.status(200).json({
			urlpath: urlpath,
			metadata: docEntry.frontmatter.yamltext,
			content: docEntry.frontmatter.text
		});
	} else {
		res.status(404).end("file "+ urlpath +" doesn't exist");
	}
};

exports.postEdit = function(req, res) {
	logger.trace("in postEdit");
	var docEntry = akasha.findDocumentForUrlpath(config, req.body.urlpath);
	if (docEntry) {
		// logger.trace('found docEntry for urlpath '+ body.urlpath +' '+ util.inspect(docEntry));
		akasha.updateDocumentData(config, docEntry,
				 trimtxt(req.body.metadata), trimtxt(req.body.content),
				 function(err) {
			logger.trace("Inside updateDocumentData");
			if (err) {
				// Need to send an error message instead
				res.status(404).end("Could not update "+ docEntry.fullpath +" because "+ err);
			} else {
				logger.trace('before renderFile '+ docEntry.path);
				akasha.renderFile(config, docEntry.path, function(err) {
					if (err) {
						res.status(404).end("Could not render "+ docEntry.fullpath +" because "+ err);
					} else {
						res.status(200).json({
							newlocation: req.body.urlpath
						});
					}
				});
			}
		});
	} else {
		// Need to send an error message instead
		res.status(404).end("No docEntry found for "+ req.body.urlpath);
	}
};

exports.postAdd = function(req, res) {
	logger.trace('in /..admin/add');
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
						res.status(404).end("Could not render "+ docEntry.fullpath +" because "+ err);
					} else {
						// redirect(res, path.join(path.dirname(body.urlpath), path.basename(docEntry.renderedFileName)));
						res.status(200).json({
							newlocation: path.join(req.body.dirname, path.basename(docEntry.renderedFileName))
						});
					}
				});
			}
	});
};

exports.postDelete = function(req, res) {
	var docEntry = akasha.findDocumentForUrlpath(config, req.body.urlpath);
	if (docEntry) {
		// logger.trace(util.inspect(docEntry));
		// logger.trace('deleting docEntry '+ docEntry.path);
		akasha.deleteDocumentForUrlpath(config, docEntry.path, function(err) {
			if (err) {
				res.status(404).end("Could not delete "+ req.body.urlpath +" because "+ err);
			} else {
				// logger.trace('deleting '+ path.join(config.root_out, req.body.urlpath));
				fs.unlink(path.join(config.root_out, req.body.urlpath), function(err2) {
					if (err2) {
						res.status(404).end("Could not delete "+ path.join(config.root_out, req.body.urlpath) +" because "+ err);
					} else {
						res.status(200).redirect(path.join(path.dirname(req.body.urlpath), "index.html"));
					}
				});
			}
		});
	} else {
		res.status(404).end("Could not delete "+ body.urlpath +" because it doesn't exist");
	}
};

exports.postAddDir = function(req, res) {
	var dirnm = path.join(config.root_docs[0], req.body.dirname, req.body.pathname);
	fs.mkdir(dirnm, function(err) {
		if (err) {
			res.status(404).end("Could not create directory "+ dirnm +" because "+ err);
		} else {
			var dirnm2 = path.join(config.root_out, req.body.dirname, req.body.pathname);
			fs.mkdir(dirnm2, function(err) {
				if (err) {
					res.status(404).end("Could not create directory "+ dirnm2 +" because "+ err);
				} else {
					// Now what?
					// Need to make the user create dirnm/index.html
					res.status(200).redirect(path.join('/..admin/addindexpage', req.body.dirname, req.body.pathname));
				}
			});
		}
	});
};


exports.streamFile = function(req, res, requrl, fname) {
    logger.info('streamFile '+ fname /*+' '+ util.inspect(requrl)*/);
    if (requrl.pathname.match(/\.html$/)) {
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
                );*/
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
    } else {
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
    }
};

var prepareDocEditForm = function(urlpath, metadata, content) {
    var $ = newCheerio(findTemplate("txtEditForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDirCreateForm = function(urlpath) {
	// logger.trace('prepareDirCreateForm urlpath='+ urlpath);
	var t = findTemplate("dirAddForm");
	logger.trace(t);
    var $ = newCheerio(t);
    $('#ak-adddir-urlpath').attr('value', urlpath);
    $('#ak-adddir-dirname').attr('value', path.dirname(urlpath));
    $('#ak-adddir-add-dirname').append(path.dirname(urlpath));
    logger.trace($.html());
    return $.html();
};

var prepareDocCreateForm = function(urlpath, dirname /*, fname, metadata, content */) {
	// logger.trace('prepareDocCreateForm urlpath='+ urlpath +' dirname='+ dirname);
    var $ = newCheerio(findTemplate("txtAddForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-pathname-input').attr('value', "");
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
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDocDeleteForm = function(urlpath) {
    var $ = newCheerio(findTemplate("txtDeleteForm"));
    $('#ak-editor-urlpath').attr('value', urlpath);
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
