
var http = require('http');
var url  = require('url');
var mime = require('mime');
var fs   = require('fs');
var path = require('path');
var util = require('util');

var cheerio = require('cheerio');
var anyBody = require("body/any");

/* 
server/assets contains the code for the toolbar

Needs two server objects
- one to serve the content frame
- the other to serve the toolbar frame and handle requests

Toolbar has two modes
- Manipulating current file
- Showing info or manipulating the whole site */

var txtEditForm, txtAddForm, dirAddForm, txtDeleteForm;

module.exports = function(akasha, config) {
    readFiles(function(err) {
        if (err) {
            throw err;
        } else {
            startServer(akasha, config);
        }
    });
}

var readFiles = function(cb) {
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

var startServer = function(akasha, config) {
    http.createServer(function (request, res) {
        util.log(request.method +' '+ util.inspect(request.url));
        var requrl = url.parse(request.url, true);
        if (request.method === "GET") {
            var matches;
            if ((matches = requrl.pathname.match(/^\/\.\.admin\/editpage(\/.*)/)) !== null) {
                var urlpath = matches[1];
                // util.log(util.inspect(matches));
                // util.log('urlpath '+ urlpath);
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
                    showError(res, 404, "file "+ urlpath +" doesn't exist");
                }
            } else if ((matches = requrl.pathname.match(/^\/\.\.admin\/addnewdir(\/.*)/)) !== null) {
                var urlpath = matches[1];
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
            } else if ((matches = requrl.pathname.match(/^\/\.\.admin\/addnewpage(\/.*)/)) !== null) {
                var urlpath = matches[1];
                // util.log(util.inspect(matches));
                // util.log('urlpath '+ urlpath);
                fs.readFile(path.join(config.root_out, urlpath), { encoding: 'utf8' }, function(err, buf) {
                    if (err) {
                        buf = '<html><head></head><body></body></html>';
                    }
                    var $ = newCheerio(buf);
                    
                    $('body').empty();
                    $('body').append(prepareDocCreateForm(
                                    urlpath,
                                    path.dirname(urlpath),
                                    path.basename(urlpath)));
                    $('html head').append(
                        '<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
                    );
                    res.end($.html());
                });
            } else if ((matches = requrl.pathname.match(/^\/\.\.admin\/deletepage(\/.*)/)) !== null) {
                var urlpath = matches[1];
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
            } else if ((matches = requrl.pathname.match(/^\/\.\.admin\/docData(\/.*)/)) !== null) {
                var urlpath = matches[1];
                var docEntry = akasha.findDocumentForUrlpath(config, urlpath);
                if (docEntry) {
					sendJSON(res, 200, {
						urlpath: urlpath,
						metadata: docEntry.frontmatter.yamltext,
						content: docEntry.frontmatter.text
					});
                } else {
                    showError(res, 404, "file "+ urlpath +" doesn't exist");
                }
            } else if (requrl.pathname.match(/^\/\.\.admin\//)) {
                var assetsdir = path.join(__dirname, 'assets');
                var fname = path.join(assetsdir, requrl.pathname.substring(9));
                fs.exists(fname, function(exists) {
                    if (exists) {
                        streamFile(akasha, config, res, requrl, fname);
                    } else {
                        showError(res, 404, "file "+ fname +" not yet ready ");
                    }
                });
            } else {
                var fname = path.join(config.root_out, requrl.pathname);
                fs.stat(fname, function(err, status) {
                    if (err) {
                        showError(res, 404, "file "+ fname +" not found "+ err);
                    } else {
                        if (status.isDirectory()) {
                        	redirect(res, path.join(requrl.pathname, "index.html"));
                        } else {
                            streamFile(akasha, config, res, requrl, fname);
                        }
                    }
                });
            }
        } else if (request.method === "POST") {
            util.log('POST URL '+ util.inspect(requrl));
            // util.log('POST URL '+ util.inspect(request.query));
            // util.log(util.inspect(request));
            
            anyBody(request, res, function (err, body) { // parse request body
                // util.log('POST BODY '+ util.inspect(body));
                if (err) {
                    showError(res, 404, "POST received error "+err);
                } else {
                    
                    if (requrl.pathname === "/..admin/edit") {
                        var docEntry = akasha.findDocumentForUrlpath(config, body.urlpath);
                        if (docEntry) {
                            // util.log('found docEntry for urlpath '+ body.urlpath +' '+ util.inspect(docEntry));
                            akasha.updateDocumentData(config, docEntry, trimtxt(body.metadata), trimtxt(body.content), function(err) {
                                if (err) {
                            		// Need to send an error message instead
                                    showError(res, 400, "Could not update "+ docEntry.fullpath +" because "+ err);
                                } else {
                                    // util.log('before renderFile '+ docEntry.path);
                                    akasha.renderFile(config, docEntry.path, function(err) {
                                        if (err) {
                                            showError(res, 404, "Could not render "+ docEntry.fullpath +" because "+ err);
                                        } else {
                                            // redirect(res, body.urlpath);
                                            sendJSON(res, 200, {
                                                newlocation: body.urlpath
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            // Need to send an error message instead
                            
                            showError(res, 400, "No docEntry found for "+ body.urlpath);
                        }
                    } else if (requrl.pathname === "/..admin/add") {
                        // var fname = path.join(config.root_docs[0], path.dirname(body.urlpath), body.pathname.trim());
                        akasha.createDocument(config, config.root_docs[0],
                            path.join(path.dirname(body.urlpath), body.pathname.trim()),
                            trimtxt(body.metadata), trimtxt(body.content), function(err, docEntry) {
                                if (err) {
                                    // Need to send an error message instead
                                    showError(res, 404, "Error while creating "+ body.urlpath +" "+ err);
                                } else {
                                	// util.log(util.inspect(docEntry));
                                    akasha.renderFile(config, docEntry.path, function(err) {
                                        if (err) {
                                            showError(res, 404, "Could not render "+ docEntry.fullpath +" because "+ err);
                                        } else {
                                            // redirect(res, path.join(path.dirname(body.urlpath), path.basename(docEntry.renderedFileName)));
                                            sendJSON(res, 200, {
                                                newlocation: path.join(path.dirname(body.urlpath), path.basename(docEntry.renderedFileName))
                                            });
                                        }
                                    });
                                }
                        });
                    } else if (requrl.pathname === "/..admin/delete") {
                        var docEntry = akasha.findDocumentForUrlpath(config, body.urlpath);
                        if (docEntry) {
                            // util.log(util.inspect(docEntry));
                            akasha.deleteDocumentForUrlpath(config, docEntry.path, function(err) {
                                if (err) {
                                    showError(res, 404, "Could not delete "+ body.urlpath +" because "+ err);
                                } else {
                                	fs.unlink(path.join(config.root_docs[0], body.urlpath), function(err2) {
                                		// purposely ignoring if an error occurs
                                		redirect(res, path.join(path.dirname(body.urlpath), "index.html"));
                                	});
                                }
                            });
                        } else {
                            showError(res, 404, "Could not delete "+ body.urlpath +" because it doesn't exist");
                        }
                    } else if (requrl.pathname === "/..admin/adddir") {
                    	var dirnm = path.join(config.root_docs[0], body.dirname, body.pathname);
                    	fs.mkdir(dirnm, function(err) {
                    		if (err) {
                    			showError(res, 404, "Could not create directory "+ dirnm +" because "+ err);
                    		} else {
                    			var dirnm2 = path.join(config.root_out, body.dirname, body.pathname);
                    			fs.mkdir(dirnm2, function(err) {
                    				if (err) {
                    					showError(res, 404, "Could not create directory "+ dirnm2 +" because "+ err);
                    				} else {
                    					// Now what?
                    					// Need to make the user create dirnm/index.html
                    					redirect(res, path.join('/..admin/addnewpage', body.dirname, body.pathname, "index.html"));
                    				}
                    			});
                    		}
                    	});
                    } else {
                        showError(res, 404, "No handler for POST "+ requrl.pathname);
                    }
                }
            });
        } else {
            showError(res, 404, request.method+" not yet ready ");
        }
    }).listen(8080);
    
};

var streamFile = function(akasha, config, res, requrl, fname) {
    util.log('streamFile '+ fname +' '+ util.inspect(requrl));
    if (requrl.pathname.match(/\.html$/)) {
        fs.readFile(fname, { encoding: 'utf8' }, function(err, buf) {
            if (err) {
                showError(res, 404, "file "+ fname +" not readable "+ err);
            } else {
                var $ = newCheerio(buf);
                var docEntry = akasha.findDocumentForUrlpath(config, requrl.pathname);
                // util.log('streamFile '+ requrl.pathname);
                // util.log(util.inspect(docEntry));
                // $('body').wrapInner('<div id="ak-original-content"></div>');
                $('body').prepend(
                     '<div id="ak-editor-toolbar">'
                    +'<span id="ak-editor-file-name"></span>'
                    +'<a id="ak-editor-edit-link" href=""><span class="ak-editor-button" id="ak-editor-edit-button">Edit</span></a>'
                    +'<a id="ak-editor-delete-link" href=""><span class="ak-editor-button" id="ak-editor-delete-button">Delete</span></a>'
                    +'<a id="ak-editor-addnewdir-link" href=""><span class="ak-editor-button" id="ak-editor-add-newdir-button">Add NEW Directory</span></a>'
                    +'<a id="ak-editor-addnew-link" href=""><span class="ak-editor-button" id="ak-editor-add-new-button">Add NEW File</span></a>'
                    +'</div>'
                );
                $("#ak-editor-file-name").append("<strong>File Name: "+ requrl.pathname +"</strong>");
                $("#ak-editor-edit-link").attr('href', "/..admin/editpage"+requrl.pathname);
                $("#ak-editor-delete-link").attr('href', "/..admin/deletepage"+requrl.pathname);
                $("#ak-editor-addnew-link").attr('href', "/..admin/addnewpage"+requrl.pathname);
                $("#ak-editor-addnewdir-link").attr('href', "/..admin/addnewdir"+requrl.pathname);
                $('body').append(
                    '<script src="/..admin/js/editor.js"></script>'
                   +'<script src="/..admin/vendor/ace-1.1.7/ace.js" type="text/javascript" charset="utf-8"></script>'
                );
                $('html head').append(
                    '<link rel="stylesheet" href="/..admin/css/editor.css" type="text/css"/>'
                );
                var ht = $.html();
                res.writeHead(200, {
                    'Content-Type': mime.lookup(fname),
                    'Content-Length': ht.length
                });
                res.end(ht);
            }
        });
    } else {
        fs.stat(fname, function(err, status) {
            if (err) {
                showError(res, 404, "file "+ fname +" not found "+err);
            } else {
                res.writeHead(200, {
                    'Content-Type': mime.lookup(fname) ,
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
    var $ = newCheerio(txtEditForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    // $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDirCreateForm = function(urlpath) {
    var $ = newCheerio(dirAddForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-dirname').attr('value', path.dirname(urlpath));
    $('#ak-editor-add-dirname').append(path.dirname(urlpath));
    return $.html();
};

var prepareDocCreateForm = function(urlpath, dirname, fname, metadata, content) {
    var $ = newCheerio(txtAddForm);
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-pathname-input').attr('value', fname);
    // $('#ak-editor-metadata-input').append(metadata ? metadata : "");
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
    while (lines.length > 0 && lines[lines.length - 1] && lines[lines.length - 1].length === 0) {
        lines.pop();
    }
    while (lines.length > 0 && lines[0] && lines[0].length === 0) {
        lines.shift();
    }
    return lines.join('\n');
};

var redirect = function(res, url) {
    res.setHeader('Location', url);
    res.statusCode = 302;
    res.end();
};

var showError = function(res, code, message) {
    res.writeHead(code, {
        'Content-Type': 'text/plain'
    });
    res.end(message);
};

var sendJSON = function(res, code, obj) {
    res.setHeader('Content-type','application/json');
    res.setHeader('Charset','utf8');
    res.statusCode = code;
    res.end(JSON.stringify(obj));
}

var newCheerio = function(buf) {
    return cheerio.load(buf, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
}