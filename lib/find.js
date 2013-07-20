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
    util.log('find.template ' + tmplName);
    var stat = fs.existsSync(tmplName)
            ? fs.statSync(tmplName)
            : undefined;
    if (stat) {
        return tmplName;
    }
    if (options.root_layouts) {
        for (var i = 0; i < options.root_layouts.length; i++) {
            var root = options.root_layouts[i];
            // Is it in a layouts directory?
            // util.log('find.template ' + path.join(root, tmplName));
            stat = fs.existsSync(path.join(root, tmplName))
                ? fs.statSync(path.join(root, tmplName))
                : undefined;
            if (stat) {
                return path.join(root, tmplName);
            }
        }
    }
    return undefined;
}


/**
 * Find a partial/template file whether it's directly specified, or whether its in the layout directory
 **/
module.exports.partial = function(options, tmplName) {
    // Does the file match on its own?
    var stat = fs.existsSync(tmplName)
            ? fs.statSync(tmplName)
            : undefined;
    if (stat) {
        return tmplName;
    }
    // util.log(util.inspect(options));
    if (options.root_partials) {
        for (var i = 0; i < options.root_partials.length; i++) {
            var partial = options.root_partials[i];
            // Is it in a partials directory?
            stat = fs.existsSync(path.join(partial, tmplName))
                ? fs.statSync(path.join(partial, tmplName))
                : undefined;
            if (stat) {
                return path.join(partial, tmplName);
            }
        }
    }
    return undefined;
}