
var http = require('http');
var url  = require('url');
var mime = require('mime');
var fs   = require('fs');
var path = require('path');
var util = require('util');

var cheerio = require('cheerio');
var anyBody = require("body/any");

/* Redo this so the UI is a frame - one frame contains the toolbar - other contains the content
No need to modify the content while serving it, just stream it to the browser


server/assets contains the code for the toolbar

Needs two server objects
- one to serve the content frame
- the other to serve the toolbar frame and handle requests

Toolbar has two modes
- Manipulating current file
- Showing info or manipulating the whole site */

var txtEditForm, txtAddForm, txtDeleteForm;

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

var startServer = function(akasha, config) {
    http.createServer(function (request, res) {
        util.log(request.method +' '+ util.inspect(request.url));
        var requrl = url.parse(request.url, true);
        if (request.method === "GET") {
            if (requrl.pathname.match(/^\/\.\.admin\//)) {
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
                            fname = path.join(fname, "index.html");
                            fs.exists(fname, function(exists) {
                                if (exists) {
                                    streamFile(akasha, config, res, requrl, fname);
                                } else {
                                    showError(res, 404, "file "+ fname +" not found "+ err);
                                }
                            });
                        } else {
                            streamFile(akasha, config, res, requrl, fname);
                        }
                    }
                });
            }
        } else if (request.method === "POST") {
            util.log(util.inspect(requrl));
            // util.log(util.inspect(request));
            
            anyBody(request, res, function (err, body) {
                if (err) {
                    showError(res, 404, "POST received error "+err);
                } else {
                    util.log(util.inspect(body));
                    
                    if (requrl.pathname === "/..admin/edit") {
                        var docEntry = akasha.findDocumentForUrlpath(config, body.urlpath);
                        if (docEntry) {
                            util.log('found docEntry for urlpath '+ body.urlpath +' '+ util.inspect(docEntry));
                            akasha.updateDocumentData(config, docEntry, trimtxt(body.metadata), trimtxt(body.content), function(err) {
                                if (err) {
                                    var fname = path.join(config.root_out, body.urlpath);
                                    fs.readFile(fname, { encoding: 'utf8' }, function(readerr, data) {
                                        if (readerr) {
                                            data = '<html><head></head><body></body></html>';
                                        }
                                        
                                        var $ = cheerio.load(data, {
                                            recognizeSelfClosing: true,
                                            recognizeCDATA: true
                                        });
                
                                        $('body').empty();
                                        $('body').append(prepareDocEditForm(
                                                    body.urlpath,
                                                    trimtxt(body.metadata),
                                                    trimtxt(body.content)));
                                        $('body').prepend('<strong>Could not save '
                                                + body.urlpath +' because '+ err +'</strong>');
                                        res.end($.html());
                                    });
                                } else {
                                    util.log('before renderFile '+ docEntry.path);
                                    akasha.renderFile(config, docEntry.path, function(err) {
                                        if (err) {
                                            showError(res, 404, "Could not render "+ docEntry.fullpath +" because "+ err);
                                        } else {
                                            redirect(res, body.urlpath);
                                        }
                                    });
                                }
                            });
                        } else {
                            var fname = path.join(config.root_out, body.urlpath);
                            fs.readFile(fname, { encoding: 'utf8' }, function(readerr, data) {
                                if (readerr) {
                                    data = '<html><head></head><body></body></html>';
                                }
                                var $ = cheerio.load(data, {
                                    recognizeSelfClosing: true,
                                    recognizeCDATA: true
                                });
        
                                $('body').empty();
                                $('body').append(prepareDocCreateForm(
                                        body.urlpath,
                                        path.dirname(body.urlpath),
                                        path.basename(body.urlpath),
                                        trimtxt(body.metadata), trimtxt(body.content)));
                                $('body').append(txtAddForm);
                                $('body').prepend('<strong>Could not save '
                                        + body.urlpath +' because '+ err +'</strong>');
                                res.end($.html());
                            });
                        }
                    } else if (requrl.pathname === "/..admin/add") {
                        var fname = path.join(config.root_docs[0], path.dirname(body.urlpath), body.pathname.trim());
                        akasha.createDocument(config, config.root_docs[0],
                            path.join(path.dirname(body.urlpath), body.pathname.trim()),
                            trimtxt(body.metadata), trimtxt(body.content), function(err, docEntry) {
                                if (err) {
                                    var fname = path.join(config.root_out, body.urlpath.trim());
                                    fs.readFile(fname, { encoding: 'utf8' }, function(readerr, data) {
                                        if (readerr) {
                                            data = '<html><head></head><body></body></html>';
                                        }
                                        var $ = cheerio.load(data, {
                                            recognizeSelfClosing: true,
                                            recognizeCDATA: true
                                        });
                
                                        $('body').empty();
                                        $('body').append(prepareDocCreateForm(
                                                body.urlpath.trim(),
                                                path.dirname(body.urlpath.trim()),
                                                path.basename(body.urlpath.trim()),
                                                trimtxt(body.metadata), trimtxt(body.content)));
                                        $('body').prepend('<strong>Could not save '
                                                + body.urlpath +' because '+ err +'</strong>');
                                        res.end($.html());
                                    });
                                } else {
                                    akasha.renderFile(config, docEntry.path, function(err) {
                                        if (err) {
                                            showError(res, 404, "Could not render "+ docEntry.fullpath +" because "+ err);
                                        } else {
                                            redirect(res, path.join(path.dirname(body.urlpath), path.basename(docEntry.renderedFileName)));
                                        }
                                    });
                                }
                        });
                    } else if (requrl.pathname === "/..admin/delete") {
                        var docEntry = akasha.findDocumentForUrlpath(config, body.urlpath);
                        if (docEntry) {
                            util.log(util.inspect(docEntry));
                            akasha.deleteDocumentForUrlpath(config, docEntry.path, function(err) {
                                if (err) {
                                    showError(res, 404, "Could not delete "+ body.urlpath +" because "+ err);
                                } else {
                                    redirect(res, path.dirname(body.urlpath));
                                }
                            });
                        } else {
                            showError(res, 404, "Could not delete "+ body.urlpath +" because it doesn't exist");
                        }
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
                var $ = cheerio.load(buf, {
                    recognizeSelfClosing: true,
                    recognizeCDATA: true
                });
                
                var docEntry = akasha.findDocumentForUrlpath(config, requrl.pathname);
                // util.log('streamFile '+ requrl.pathname);
                // util.log(util.inspect(docEntry));
                // $('body').wrapInner('<div id="ak-original-content"></div>');
                $('body').prepend(
                     '<div id="ak-editor-toolbar">'
                    +'<span id="ak-editor-file-name"></span>'
                    +'<span class="ak-editor-button" id="ak-editor-edit-button">Edit</span>'
                    +'<span class="ak-editor-button" id="ak-editor-delete-button">Delete</span>'
                    +'<span class="ak-editor-button" id="ak-editor-add-new-button">Add NEW</span>'
                    +'</div>'
                    +'<script type="text/html" class="ak-editor-form-edit">'
                    +prepareDocEditForm(
                                requrl.pathname,
                                docEntry ? trimtxt(docEntry.frontmatter.yamltext) : "",
                                docEntry ? trimtxt(docEntry.frontmatter.text) : "")
                    +'</script>'
                    +'<script type="text/html" class="ak-editor-form-add">'
                    +prepareDocCreateForm(
                                requrl.pathname,
                                path.dirname(requrl.pathname), "",
                                "", "")
                    +'</script>'
                    +'<script type="text/html" class="ak-editor-form-delete">'
                    +prepareDocDeleteForm(requrl.pathname)
                    +'</script>'
                );
                $("#ak-editor-file-name").append("<strong>File Name: "+ requrl.pathname +"</strong>");
                
                $('body').append(
                    '<script src="/..admin/bower_components/overlay-js/overlay.js"></script>'
                   +'<script src="/..admin/js/toolbar.js"></script>'
                );
                $('html head').append(
                    '<link rel="stylesheet" href="/..admin/bower_components/overlay-js/overlay.css" type="text/css"/>'
                   +'<link rel="stylesheet" href="/..admin/css/toolbar.css" type="text/css"/>'
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
    var $ = cheerio.load(txtEditForm, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    $('#ak-editor-content-input').append(content ? content : "");
    util.log("prepareDocEditForm urlpath="+ urlpath +" metadata="+ metadata +" content="+ content);
    util.log($.html());
    return $.html();
};

var prepareDocCreateForm = function(urlpath, dirname, fname, metadata, content) {
    var $ = cheerio.load(txtAddForm, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
    $('#ak-editor-urlpath').attr('value', urlpath);
    $('#ak-editor-add-dirname').append(dirname);
    $('#ak-editor-pathname-input').attr('value', fname);
    $('#ak-editor-metadata-input').append(metadata ? metadata : "");
    $('#ak-editor-content-input').append(content ? content : "");
    return $.html();
};

var prepareDocDeleteForm = function(urlpath) {
    var $ = cheerio.load(txtDeleteForm, {
        recognizeSelfClosing: true,
        recognizeCDATA: true
    });
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
    while (lines[lines.length - 1].length === 0) {
        lines.pop();
    }
    while (lines[0].length === 0) {
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