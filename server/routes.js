
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var cheerio = require('cheerio');

var akasha, config, logger;

var txtEditForm, txtAddForm, dirAddForm, txtDeleteForm;

exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("routes");
};

exports.editPage = function(req, res) {
	var urlpath = req.params[0];
	// logger.trace(util.inspect(matches));
	// logger.trace('urlpath '+ urlpath);
	var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
	if (docEntry) {
		fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
			if (err) {
				buf = '<html><head></head><body></body></html>';
			}
			var $ = newCheerio(buf);
			
			$('body').empty();
			$('body').append(prepareDocEditForm(
						urlpath,
						docEntry.frontmatter.yamltext,
						docEntry.frontmatter.text));
			$('html head').append(
				'<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
			);
			res.end($.html());
		});
	} else {
		res.status(404).end("file "+ urlpath +" doesn't exist");
	}
};

exports.addNewDir = function(req, res) {
	var urlpath = req.params[0];
	fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
		if (err) {
			buf = '<html><head></head><body></body></html>';
		}
		var $ = newCheerio(buf);
		$('body').empty();
		$('body').append(prepareDirCreateForm(urlpath));
		$('html head').append(
			'<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
		);
		res.end($.html());
	});
};

exports.addNewPage = function(req, res) {
	var urlpath = req.params[0];
	fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
		if (err) {
			buf = '<html><head></head><body></body></html>';
		}
		var $ = newCheerio(buf);
		
		$('body').empty();
		$('body').append(prepareDocCreateForm(
						urlpath,
						path.dirname(urlpath)));
		$('html head').append(
			'<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
		);
		res.end($.html());
	});
};

exports.addIndexPage = function(req, res) {
	var urlpath = req.params[0];
	fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
		if (err) {
			buf = '<html><head></head><body></body></html>';
		}
		var $ = newCheerio(buf);
		
		$('body').empty();
		$('body').append(prepareIndexCreateForm(urlpath));
		$('html head').append(
			'<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
		);
		res.end($.html());
	});
};

exports.deletePage = function(req, res) {
	var urlpath = req.params[0];
	fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
		if (err) {
			buf = '<html><head></head><body></body></html>';
		}
		var $ = newCheerio(buf);
		$('body').empty();
		$('body').append(prepareDocDeleteForm(urlpath));
		$('html head').append(
			'<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
		);
		res.end($.html());
	});
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
		res.json({
			urlpath: urlpath,
			metadata: docEntry.frontmatter.yamltext,
			content: docEntry.frontmatter.text
		});
	} else {
		res.status(404).end("file "+ urlpath +" doesn't exist");
	}
};

exports.postEdit = function(req, res) {
	var docEntry = akasha.findDocumentForUrlpath(config, req.body.urlpath);
	if (docEntry) {
		// logger.trace('found docEntry for urlpath '+ body.urlpath +' '+ util.inspect(docEntry));
		akasha.updateDocumentData(config, docEntry,
				 trimtxt(req.body.metadata), trimtxt(req.body.content),
				 function(err) {
			if (err) {
				// Need to send an error message instead
				res.status(404).end("Could not update "+
					docEntry.fullpath +" because "+ err);
			} else {
				// util.log('before renderFile '+ docEntry.path);
				akasha.renderFile(config, docEntry.path, function(err) {
					if (err) {
						res.status(404).end("Could not render "+
							docEntry.fullpath +" because "+ err);
					} else {
						// redirect(res, body.urlpath);
						res.json({
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
						res.json({
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
		logger.trace('deleting docEntry '+ docEntry.path);
		akasha.deleteDocumentForUrlpath(config, docEntry.path, function(err) {
			if (err) {
				res.status(404).end("Could not delete "+ req.body.urlpath +" because "+ err);
			} else {
				logger.trace('deleting '+ path.join(config.root_out, req.body.urlpath));
				fs.unlink(path.join(config.root_out, req.body.urlpath), function(err2) {
					if (err2) {
						res.status(404).end("Could not delete "+ path.join(config.root_out, req.body.urlpath) +" because "+ err);
					} else {
						res.redirect(path.join(path.dirname(req.body.urlpath), "index.html"));
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
					res.redirect(path.join('/..admin/addindexpage', req.body.dirname, req.body.pathname));
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
                $('body').prepend(
                     '<div id="ak-editor-toolbar">'
                    +'<span id="ak-editor-file-name"></span>'
                    +'<a id="ak-editor-edit-link" href=""><span class="ak-editor-button" id="ak-editor-edit-button">Edit</span></a>'
                    +'<a id="ak-editor-delete-link" href=""><span class="ak-editor-button" id="ak-editor-delete-button">Delete</span></a>'
                    +'<a id="ak-editor-addnewdir-link" href=""><span class="ak-editor-button" id="ak-editor-add-newdir-button">Add NEW Directory</span></a>'
                    +'<a id="ak-editor-addnew-link" href=""><span class="ak-editor-button" id="ak-editor-add-new-button">Add NEW File</span></a>'
                    +'<a id="ak-editor-full-build-link" href=""><span class="ak-editor-button" id="ak-editor-full-build-button">FULL Rebuild</span></a>'
                    +'</div>'
                );
                $("#ak-editor-file-name").append("<strong>File Name: "+ requrl.pathname +"</strong>");
                $("#ak-editor-edit-link").attr('href', "/..admin/editpage"+requrl.pathname);
                $("#ak-editor-delete-link").attr('href', "/..admin/deletepage"+requrl.pathname);
                $("#ak-editor-addnew-link").attr('href', "/..admin/addnewpage"+requrl.pathname);
                $("#ak-editor-addnewdir-link").attr('href', "/..admin/addnewdir"+requrl.pathname);
                $("#ak-editor-full-build-link").attr('href', "/..admin/fullbuild"+requrl.pathname);
                $('body').append(
                    '<script src="/..admin/js/editor.js"></script>'
                   +'<script src="/..admin/vendor/ace-1.1.7/ace.js" type="text/javascript" charset="utf-8"></script>'
                );
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

exports.readFiles = function(cb) {
    fs.readFile(path.join(__dirname, "form-edit.html"), { encoding: 'utf8' }, function(err, data) {
        if (err) cb(err);
        else {
            txtEditForm = data;
            fs.readFile(path.join(__dirname, "form-add.html"), { encoding: 'utf8' }, function(err, data) {
                if (err) cb(err);
                else {
                    txtAddForm = data;
                    fs.readFile(path.join(__dirname, "form-adddir.html"), { encoding: 'utf8' }, function(err, data) {
                    	if (err) cb(err);
                    	else {
                    		dirAddForm = data;
							fs.readFile(path.join(__dirname, "form-delete.html"), { encoding: 'utf8' }, function(err, data) {
								if (err) cb(err);
								else {
									txtDeleteForm = data;
									cb();
								}
							});
						}
                    });
                }
            });
        }
    });
}

var prepareDocEditForm = function(urlpath, metadata, content) {
    var $ = newCheerio(txtEditForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDirCreateForm = function(urlpath) {
	// logger.trace('prepareDirCreateForm urlpath='+ urlpath);
    var $ = newCheerio(dirAddForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-dirname').attr('value', path.dirname(urlpath));
    $('#ak-editor-add-dirname').append(path.dirname(urlpath));
    return $.html();
};

var prepareDocCreateForm = function(urlpath, dirname /*, fname, metadata, content */) {
	// logger.trace('prepareDocCreateForm urlpath='+ urlpath +' dirname='+ dirname);
    var $ = newCheerio(txtAddForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-pathname-input').attr('value', "");
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareIndexCreateForm = function(dirname) {
	// logger.trace('prepareDirCreateForm dirname='+ dirname);
    var $ = newCheerio(txtAddForm);
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
    var $ = newCheerio(txtDeleteForm);
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
    return cheerio.load(buf, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
};
