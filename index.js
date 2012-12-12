
/**
 *
 * Copyright 2012 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *   AkashaCMS is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   AkashaCMS is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with AkashaCMS.  If not, see <http://www.gnu.org/licenses/>.
 */

var async    = require('async');
var util     = require('util');
var url      = require('url');
var renderer = require('./lib/renderer');
var fs       = require('fs');
var FS       = require('meta-fs');
var gf       = require('./lib/gatherfiles');

module.exports.partial = function(name, locals, callback) {
    renderer.partial(name, locals, callback);
}

module.exports.partialSync = function(name, locals) {
    return renderer.partialSync(name, locals);
}

// {
//  root_layouts: 'dirname',
//  root_out: 'dirname',
//  root_docs: [ 'dirname', 'dirname', .. ],
//  data: { obj1: data, obj2: data, obj3: data ... }
//  funcs: {
//     func1: function() { },
//     func2: function() { }
//  }
// }
module.exports.process = function(options) {
    options.dirs = [];
    renderer.setRootLayouts(options.root_layouts);
    
    async.series([
        function(done) {
            gather_files_and_directories(options, done);
        },
        function(done) {
            make_directories(options, done);
        },
        function(done) {
            process_and_render_files(options, done);
        }
    ],
    function(err) {
        if (err) throw err;
    });
}

/**
 * Gather a list of input files & directories.
 **/
var gather_files_and_directories = function(options, done) {
    util.log('root_docs ' + util.inspect(options.root_docs));
    async.forEachSeries(options.root_docs,
        function(rootdir, cb) {
            util.log('gathering ' + rootdir);
            gf.gather(rootdir, function(err, data) {
                if (err) {
                    util.log(' error on ' + rootdir + ' ' + err);
                    cb(err);
                }
                else {
                    util.log('gathered ' + rootdir);
                    options.dirs.push(data);
                    cb();
                }
            });
        },
        function(err) {
            done(err ? err : null);
        });
}

/**
 * For the directories in the input list, make matching directories in the output directory tree.
 **/
var make_directories = function(options, done) {
    for (var i = 0; i < options.dirs.length; i++) {
        var dir = options.dirs[i];
        for (var j = 0; j < dir.length; j++) {
            var entry = dir[j]; 
            // util.log(j +' '+ util.inspect(entry));
            if (entry.isdir) {
                util.log('DIR ' + entry.path);
                if (fs.existsSync(options.root_out +"/"+ entry.path)) {
                    var stat = fs.statSync(options.root_out +"/"+ entry.path);
                    if (! stat.isDirectory()) {
                        done('NON-DIRECTORY '+ options.root_out +"/"+ entry.path +' ALREADY EXISTS');
                    }
                } else {
                    FS.mkdir_p(options.root_out +"/"+ entry.path, function(msg) { });
                }
            }
        }
    }
    done();
}

/**
 * For files that are processed into an HTML, run the processing.
 **/
var process2html = function(options, entry) {
    if (! renderer.supportedForHtml(entry.path)) {
        throw 'UNKNOWN template engine for ' + entry.path;
    }
    // Start with a base object that will be passed into the template
    var renderopts = {
        partial: function(template, data) {
            return renderer.renderFile(template, data);
        },
        // TODO - function to search for files in input
        // TODO - function to search for templates ??
    };
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
    if (entry.path.match(/\.html\.kernel$/)) {
        renderer.renderFileAsync(entry.rootdir +'/'+ entry.path, renderopts, function(err, rendered) {
            var ind = rendered.fname.indexOf('/');
            fs.writeFile(options.root_out +"/"+ rendered.fname.substr(ind+1), rendered.content, 'utf8', function (err) {
                if (err) throw err;
            });
        });
    // TODO } else other asynchronous template engines.. or are they handled inside renderFileAsync?
    } else {
        var rendered = renderer.renderFile(entry.rootdir +'/'+ entry.path, renderopts);
        var ind = rendered.fname.indexOf('/');
        fs.writeFile(options.root_out +"/"+ rendered.fname.substr(ind+1), rendered.content, 'utf8', function (err) {
            if (err) throw err;
        });
    }
}

var process_and_render_files = function(options, done) {
    for (var i = 0; i < options.dirs.length; i++) {
        var dir = options.dirs[i];
        for (var j = 0; j < dir.length; j++) {
            var entry = dir[j];
            if (entry.isdir) continue;
            util.log(j +' '+ 'FILE ' + entry.path);
            // TODO support other asynchronous template systems such as
            // https://github.com/c9/kernel - DONE
            // https://github.com/akdubya/dustjs
            // Kernel might be more attractive because of simplicity - DONE
            // dustjs is more comprehensive however
            if (renderer.supportedForHtml(entry.path)) {
                process2html(options, entry);
            } else if (entry.path.match(/\.css\.less$/)) {
                // render .less files; rendered.fname will be xyzzy.css
                renderer.renderLess(entry.rootdir +'/'+ entry.path, function(err, rendered) {
                    if (err)
                        done(err);
                    else {
                        var ind = rendered.fname.indexOf('/');
                        fs.writeFile(options.root_out +"/"+ rendered.fname.substr(ind+1), rendered.css, 'utf8', function (err) {
                            if (err) throw err;
                        });
                    }
                });
            } else {
                // for anything not rendered, simply copy it
                FS.copy(entry.fullpath, options.root_out +"/"+ entry.path, function(msg) { });
            }
        }
    }
    done();
}
