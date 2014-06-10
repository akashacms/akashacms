/**
 *
 * Copyright 2013 David Herron
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

var fs = require('fs');
var path = require('path');
var util = require('util');

module.exports.theme = function(options, themeName) {
    // Does the file match on its own?
    var stat = fs.existsSync(themeName)
            ? fs.statSync(themeName)
            : undefined;
    if (stat) {
        return themeName;
    }
    if (options.root_theme) {
        for (var i = 0; i < options.root_theme.length; i++) {
            var theme = options.root_theme[i];
            // Is it in a theme directory?
            stat = fs.existsSync(path.join(theme, themeName))
                ? fs.statSync(path.join(theme, themeName))
                : undefined;
            if (stat) {
                return path.join(theme, themeName);
            }
        }
    }
    return undefined;
    
}

/**
 * Find a template file whether it's directly specified, or whether its in the layout directory
 **/
module.exports.template = function(options, tmplName) {
    // Does the file match on its own?
    // util.log('find.template ' + util.inspect(tmplName));
    // util.log(util.inspect(options));
    var stat = fs.existsSync(tmplName)
            ? fs.statSync(tmplName)
            : undefined;
    if (stat) {
        return {
            rootdir: undefined,
            path: tmplName,
            fullpath: tmplName
        };
    }
    // util.log(util.inspect(options.root_layouts));
    if (options.root_layouts) {
        for (var i = 0; i < options.root_layouts.length; i++) {
            var root = options.root_layouts[i];
            // Is it in a layouts directory?
            // util.log('root: '+ root);
            // util.log('find.template ' + path.join(root, tmplName));
            stat = fs.existsSync(path.join(root, tmplName))
                ? fs.statSync(path.join(root, tmplName))
                : undefined;
            if (stat) {
                return {
                    rootdir: root,
                    path: tmplName,
                    fullpath: path.join(root, tmplName)
                };
            }
        }
    }
    return undefined;
}


/**
 * Find a partial/template file whether it's directly specified, or whether its in a partials directory
 **/
module.exports.partial = function(options, tmplName) {
    // Does the file match on its own?
    // util.log('find.partial '+ tmplName);
    var stat = fs.existsSync(tmplName)
            ? fs.statSync(tmplName)
            : undefined;
    if (stat) {
        return tmplName;
    }
    // util.log(util.inspect(options));
    if (options.root_partials) {
        // util.log(util.inspect(options.root_partials));
        for (var i = 0; i < options.root_partials.length; i++) {
            var partial = options.root_partials[i];
            // util.log('Looking for '+ tmplName +' in '+ util.inspect(partial));
            // Is it in a partials directory?
            stat = fs.existsSync(path.join(partial, tmplName))
                ? fs.statSync(path.join(partial, tmplName))
                : undefined;
            if (stat) {
                // util.log('FOUND '+ tmplName +' in '+ util.inspect(partial));
                return path.join(partial, tmplName);
            }
        }
    }
    return undefined;
}

/**
 * Find a Document file whether it's directly specified, or whether it's in a document directory.
 **/
module.exports.document = function(options, docName) {
    // Does the docName match on its own?
    var stat = fs.existsSync(docName)
            ? fs.statSync(docName)
            : undefined;
    if (stat) {
        return {
            rootdir: undefined,
            path: docName,
            fullpath: docName
        };
    }
    // util.log(util.inspect(options));
    if (options.root_docs) {
        for (var i = 0; i < options.root_docs.length; i++) {
            var docroot = options.root_docs[i];
            // Is it in a partials directory?
            stat = fs.existsSync(path.join(docroot, docName))
                ? fs.statSync(path.join(docroot, docName))
                : undefined;
            if (stat) {
                return {
                    rootdir: docroot,
                    path: docName,
                    fullpath: path.join(docroot, docName)
                };
            }
        }
    }
    return undefined;
}

/**
 * Find a directory within one of the root_docs directories that
 * matches the name given in docName.  docName can be either a file
 * within a root_docs directory, or a directory.  If this function is
 * given a file name, it will locate the containing directory.
 *
 * In either case, once this function locates a directory it returns a
 * little object describing that directory.
 **/
module.exports.documentDir = function(options, docName) {
    // Does the docName match on its own?
    var stat = fs.existsSync(docName)
            ? fs.statSync(docName)
            : undefined;
    if (stat) {
        if (! stat.isDirectory()) {
            docName = path.dirname(docName);
            stat = fs.existsSync(docName)
                ? fs.statSync(docName)
                : undefined;
            if (!stat || !stat.isDirectory()) {
                throw new Error("Shouldn't get here");
            }
        }
        return {
            rootdir: undefined,
            path: docName,
            fullpath: docName,
            stat: stat
        };
    } else {
        if (options.root_docs) {
            for (var i = 0; i < options.root_docs.length; i++) {
                var docroot = options.root_docs[i];
                stat = fs.existsSync(path.join(docroot, docName))
                    ? fs.statSync(path.join(docroot, docName))
                    : undefined;
                if (stat) {
                    if ( ! stat.isDirectory()) {
                        docName = path.dirname(docName);
                        stat = fs.existsSync(path.join(docroot, docName))
                            ? fs.statSync(path.join(docroot, docName))
                            : undefined;
                        if (!stat || !stat.isDirectory()) {
                            throw new Error("Shouldn't get here");
                        }
                    }
                    return {
                        rootdir: docroot,
                        path: docName,
                        fullpath: path.join(docroot, docName),
                        stat: stat
                    };
                }
            }
        }
    }
    return undefined;
}