/**
 *
 * Copyright 2012 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var async    = require('async');
var util     = require('util');
var url      = require('url');
var renderer = require('./lib/renderer');
var fs       = require('fs');
var FS       = require('meta-fs');
var path     = require('path');
var fileCache = require('./lib/fileCache');
var smap     = require('sightmap');
var minify     = require('minify');
var filewalker = require('filewalker');

// Set up an eventEmitter so we can tell other modules what's going on
var events = require('events');
var emitter = module.exports.emitter = new events.EventEmitter();

module.exports.config = function(options) {
    // MOOT???? Make functions available to any code located in the configuration
    // MOOT???? These functions need to be ones that are useful to code in configurations
    // MOOT???? options.partial = module.exports.partial;
    // options.akashacms = module.exports; // Do we need this instead?
    // util.log('process ' + util.inspect(options));
    /*renderer.setRootLayouts(options.root_layouts);
    renderer.setRootPartials(options.root_partials);*/
    renderer.config(options);
    
    // Pull in any plugins to extend AkashaCMS
    for (var i = 0; i < options.plugins.length; i++) {
        require(options.plugins[i]).config(module.exports, options);
    }
    
    // Then give the configuration file a shot at extending us
    if (options.config) {
        options.config(module.exports);
    }
}

module.exports.process = function(options, callback) {
    var cleanDir = function(done) {
        util.log('removing ' + options.root_out);
        FS.remove(options.root_out, function(err) {
            if (err) done(err);
            else {
                util.log('making empty ' + options.root_out);
                FS.mkdir_p(options.root_out, function(err) {
                    if (err) done(err);
                    else done();
                });
            }
        });
    }
    
    var copyAssets = function(done) {
        async.forEachSeries(options.root_assets,
            function(assetdir, done) {
                util.log('copy assetdir ' + assetdir + ' to ' + options.root_out);
                FS.copy(assetdir, options.root_out, function(err) {
                    if (err) done(err);
                    else done();
                });
            },
            function(err) {
                if (err) done(err);
                else done();
            });
    }
    
    cleanDir(function(err) {
        if (err) throw new Error(err);
        else {
            copyAssets(function(err) {
                if (err) throw new Error(err);
                else {
                    make_directories(options, function (err) {
                        if (err) throw new Error(err);
                        else {
                            options.gatheredDocuments = [];
                            gather_documents(options, function(err, data) {
                                // util.log('gather_documents FINISHED');
                                if (err) throw new Error(err);
                                else {
                                    // util.log('process '+ options.gatheredDocuments.length +' entries');
                                    process_and_render_files(options, function(err) {
                                        if (err) throw new Error(err);
                                        else {
                                            generate_sitemap(options, function(err) {
                                                if (err) throw new Error(err);
                                                else {
                                                    if (options.doMinimize) {
                                                        module.exports.minimize(options, function(err) {
                                                            if (err) throw new Error(err);
                                                            else callback();
                                                        });
                                                    } else callback();
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            })
        }
    });
}

module.exports.partial = function(name, locals, callback) {
    renderer.partial(name, locals, callback);
}

module.exports.partialSync = function(theoptions, name, locals, callback) {
    return renderer.partialSync(theoptions, name, locals, callback);
}

module.exports.getFileEntry = function(theoptions, fileName) {
    return fileCache.readDocument(theoptions, fileName);
}

module.exports.findIndexFile = function(options, dirname) {
    return fileCache.findIndex(options, dirname);
}

module.exports.findSiblings = function(theoptions, fileName) {
    var bnm   = path.basename(fileName);
    var dirname = path.dirname(fileName);
    var entry = fileCache.readDocument(theoptions, fileName);
    var entries = [];
    var filedir = path.dirname(fileName);
    var dirnm = path.dirname(entry.fullpath);
    var fnames = fs.readdirSync(dirnm);
    for (var i = 0; i < fnames.length; i++) {
        var fn = fnames[i];
        var fpath = path.join(filedir, fn);
        if (fileCache.supportedForHtml(fpath)) {
            entries.push(fileCache.readDocument(theoptions, fpath));
        }
    }
    return entries;
}

module.exports.urlForFile = function(fileName) {
    return '/'+ fileCache.renderedFileName(fileName);
}

module.exports.eachDocument = function(theoptions, doccb) {
    fileCache.eachDocument(theoptions, doccb);
}

module.exports.renderFile = function(options, fileName, callback) {
    renderer.config(options);
    var entry = fileCache.readDocument(options, fileName);
    if (!entry) throw new Error('File '+fileName+' not found');
    
    if (fileCache.supportedForHtml(entry.path)) {
        process2html(options, entry, callback);
    } else if (entry.path.match(/\.css\.less$/)) {
        // render .less files; rendered.fname will be xyzzy.css
        render_less(options, entry, callback);
    } else {
        // for anything not rendered, simply copy it
        copy_to_outdir(options, entry, callback);
    }
}

/**
 * Minimize a directory tree using the minify library.
 **/
module.exports.minimize = function(options, done) {
    filewalker(options.root_out, { maxPending: -1, maxAttempts: 3, attemptTimeout: 3000 })
    .on('file', function(path, s, fullPath) {
        if (fullPath.match(/\.js$/) || fullPath.match(/\.html$/) || fullPath.match(/\.css$/)) {
            var stat = fs.statSync(fullPath);
            // util.log("Minimizing " + fullPath);
            minify.optimize([fullPath], {
                cache: true,
                callback: function(pMinData) {
                    // util.log("Writing Minimized file " + fullPath);
                    fs.writeFile(fullPath, pMinData, 'utf8', function (err) {
                        if (err) done(err);
                        else {
                            fs.utimes(fullPath, stat.atime, stat.mtime, function(err) {
                                if (err)
                                    done(err);
                                else
                                    done();
                            });
                        }
                    });
                }
            });
        }
    })
    .on('error', function(err) {
        if (err) done(err);
        else { done(); } 
    })
    .walk();
}

module.exports.gatherDir = function(options, docroot, done) {
    util.log(util.inspect(docroot));
    filewalker(docroot, { maxPending: -1, maxAttempts: 3, attemptTimeout: 3000 })
    .on('file', function(path, s, fullPath) {
        // util.log(docroot + ' FILE ' + path + ' ' + fullPath);
        options.gatheredDocuments.push(fileCache.readDocument(options, path));
    })
    .on('error', function(err) {
        // util.log('gather_documents ERROR '+ err);
        done(err);
    })
    .on('done', function() {
        util.log('gather_documents DONE '+ docroot +' '+ options.gatheredDocuments.length);
        done();
    })
    .walk();
}

var gather_documents = function(options, done) {
    async.forEachSeries(options.root_docs,
        function(docroot, done) {
            module.exports.gatherDir(options, docroot, function(err) {
                if (err) done(err); else done();
            });
        },
        function(err) {
            if (err) done(err); else done();
        });
}

/**
 * For the directories in the input list, make matching directories in the output directory tree.
 **/
var make_directories = function(options, done) {
    async.forEachSeries(options.root_docs,
        function(docroot, cb) {
            filewalker(docroot, { maxPending: -1, maxAttempts: 3, attemptTimeout: 3000 })
            .on('dir', function(filepath, s, fullPath) {
                util.log(docroot + ' DIR ' + filepath);
                if (fs.existsSync(options.root_out +"/"+ filepath)) {
                    var stat = fs.statSync(options.root_out +"/"+ filepath);
                    if (! stat.isDirectory()) {
                        emitter.emit('done-make-directories');
                        cb('NON-DIRECTORY '+ options.root_out +"/"+ filepath +' ALREADY EXISTS');
                    }
                } else {
                    FS.mkdir_p(path.join(options.root_out, filepath), function(msg) {
                        //
                    });
                }
            })
            .on('error', function(err) {
                util.log('make_directories ERROR '+ err);
                cb(err, data);
            })
            .on('done', function() {
                cb();
            })
            .walk();
        },
        function(err) {
            done(err ? err : null);
        });
    
    done();
}

/**
 * For files that are processed into an HTML, run the processing.
 **/
var process2html = function(options, entry, done) {
    if (! fileCache.supportedForHtml(entry.path)) {
        throw 'UNKNOWN template engine for ' + entry.path;
    }
    // Start with a base object that will be passed into the template
    var renderopts = { };
    // Copy in any data or functions passed to us
    if ('data' in options) {
        for (var prop in options.data) {
            renderopts[prop] = options.data[prop];
        }
    }
    if ('funcs' in options) {
        for (var prop in options.funcs) {
            renderopts[prop] = options.funcs[prop];
        }
    }
    renderopts["root_url"] = options.root_url;
    if (! renderopts.rendered_date) {
        renderopts.rendered_date = entry.stat.mtime;
    }
    
    // util.log('process2html '+ entry.path /* path.join(entry.rootdir, entry.path) */);
    renderer.render(options, entry.path /* path.join(entry.rootdir, entry.path) */, renderopts, function(err, rendered) {
        // util.log('***** DONE RENDER ' + util.inspect(rendered));
        if (err) throw err;
        else {
            var ind = rendered.fname; //.indexOf('/');
            var renderTo = options.root_out +"/"+ rendered.fname; // .substr(ind+1);
            var outPath = path.dirname(renderTo);
            util.log('rendered '+ entry.path +' as '+ renderTo);
            FS.mkdir_p(outPath, function(msg) {
                fs.writeFile(renderTo, rendered.content, 'utf8', function (err) {
                    if (err) done(err);
                    else {
                        fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
                            if (err) {
                                done(err);
                            } else {
                                add_sitemap_entry(options.root_url +'/'+ rendered.fname /*.substr(ind+1) */,
                                                  0.5, entry.stat.mtime);
                                done();
                            }
                        });
                    }
                });
            });
        }
    });
}

var copy_to_outdir = function(options, entry, done) {
    // for anything not rendered, simply copy it
    var renderTo = options.root_out +"/"+ entry.path;
    FS.copy(entry.fullpath, renderTo, function(msg) {
        fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
            if (err) done(err);
            else done();
        });
    });
}

var render_less = function(options, entry, done) {
    renderer.renderLess(entry.path, function(err, rendered) {
        if (err)
            done(err);
        else {
            var ind = rendered.fname; // .indexOf('/');
            var renderTo = options.root_out +"/"+ rendered.fname; // .substr(ind+1);
            fs.writeFile(renderTo, rendered.css, 'utf8', function (err) {
                if (err) done(err);
                else {
                    fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
                        if (err) done(err);
                        else done();
                    });
                }
            });
        }
    });
}

var process_and_render_files = function(options, done) {
    emitter.emit('before-render-files', function(err) {
        util.log('process_and_render_files '+ options.gatheredDocuments.length +' entries');
        async.eachSeries(options.gatheredDocuments,
        function(entry, cb) {
            util.log('FILE ' + entry.path);
            // support other asynchronous template systems such as
            // https://github.com/c9/kernel - DONE
            // https://github.com/akdubya/dustjs
            // Kernel might be more attractive because of simplicity - DONE
            // dustjs is more comprehensive however
            if (fileCache.supportedForHtml(entry.path)) {
                process2html(options, entry, cb);
            } else if (entry.path.match(/\.css\.less$/)) {
                // render .less files; rendered.fname will be xyzzy.css
                render_less(options, entry, cb);
            } else {
                // for anything not rendered, simply copy it
                copy_to_outdir(options, entry, cb);
            }
        },
        function(err) {
            emitter.emit('done-render-files');
            if (err) done(err); else done();
        });
    });
    
}



///////////////// XML Sitemap Generation .. works by building an array, then dumping it out in XML

var rendered_files = [];

var add_sitemap_entry = function(fname, priority, mtime) {
    // util.log('add_sitemap_entry ' + fname);
    var fDate = new Date(mtime);
    rendered_files.push({
        loc: encodeURI(fname),
        priority: priority,
        lastmod:  fDate.getUTCFullYear() +"-"+ (fDate.getMonth() + 1) +"-"+ fDate.getDate()
    });
    /*
     * This lets us remove the 'index.html' portion of URL's submitted in the sitemap.
     * But we need to also ensure all links within the site pointing at this also do
     * not use 'index.html' in the URL.  Ugh.
     *if (fname.match(/index.html$/)) {
        rendered_files.push({loc: fname.replace(/index.html$/, ''), priority: priority});
    }*/
}

var generate_sitemap = function(options, done) {
    // util.log('generate_sitemap ' + util.inspect(rendered_files));
    smap(rendered_files);
    smap(function(xml) {
        fs.writeFile(options.root_out +"/sitemap.xml", xml, 'utf8', function (err) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });
}
