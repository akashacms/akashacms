/**
 *
 * Copyright 2013-2014 David Herron
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

var fs    = require('fs');
var path  = require('path');
var util  = require('util');
var async = require('async');

var logger;

module.exports.config = function(akasha, config) {
	logger = akasha.getLogger("find");
};


module.exports.theme = function(config, themeName) {
    // Does the file match on its own?
    var stat = fs.existsSync(themeName)
            ? fs.statSync(themeName)
            : undefined;
    if (stat) {
        return themeName;
    }
    if (config.root_theme) {
        for (var i = 0; i < config.root_theme.length; i++) {
            var theme = config.root_theme[i];
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

module.exports.themeAsync = function(config, themeName, done) {
	logger.trace('themeAsync '+ themeName);
	var fnTheme, themeroot;
	async.eachSeries(config.root_theme, 
		function(root, next) {
			if (!fnTheme) {
				var fntheme = path.join(root, themeName);
				fs.stat(fntheme, function(err, stats) {
					if (err) next();
					else if (! stats.isFile()) {
						next(new Error(fntheme +' is not a file'));
					} else {
						fnTheme = fntheme;
						themeroot = root;
						next();
					}
				});
			} else next();
		},
		function(err) {
			if (err) { logger.error(err); done(err); }
			else {
				if (fnTheme) {
					done(undefined, {
						path: themeName,
						fullpath: fnTheme,
						rootdir: themeroot
					});
				} else done(new Error('NOT FOUND '+ themeName));
			}
		});
};

/**
 * Find a template file whether it's directly specified, or whether its in the layout directory
 **/
module.exports.template = function(config, tmplName) {
    // Does the file match on its own?
    logger.trace('find.template ' + util.inspect(tmplName));
    // util.log(util.inspect(config));
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
    if (config.root_layouts) {
        for (var i = 0; i < config.root_layouts.length; i++) {
            var root = config.root_layouts[i];
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

module.exports.templateAsync = function(config, tmplName, done) {
	logger.trace('templateAsync '+ tmplName);
	var found;
	async.eachSeries(config.root_layouts, 
		function(root, next) {
			if (!found) {
				var fntemplate = path.join(root, tmplName);
				logger.trace(fntemplate);
				fs.stat(fntemplate, function(err, stats) {
					if (err) { logger.error(err); next(); }
					else if (! stats.isFile()) {
						next(new Error(fntemplate +' is not a file'));
					} else {
						found = {
							path: tmplName,
							fullpath: fntemplate,
							rootdir: root,
							stat: stats
						};
						next();
					}
				});
			} else next();
		},
		function(err) {
			if (err) { logger.error(err); done(err); }
			else if (found) done(undefined, found);
			else done(new Error('NOT FOUND '+ tmplName));
		});
};

/**
 * Find a partial/template file whether it's directly specified, or whether its in a partials directory
 **/
module.exports.partial = function(config, tmplName) {
    // Does the file match on its own?
    logger.trace('find.partial '+ tmplName);
    var stat = fs.existsSync(tmplName)
            ? fs.statSync(tmplName)
            : undefined;
    if (stat) {
        return tmplName;
    }
    // util.log(util.inspect(options));
    if (config.root_partials) {
        // util.log(util.inspect(options.root_partials));
        for (var i = 0; i < config.root_partials.length; i++) {
            var partial = config.root_partials[i];
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

module.exports.partialAsync = function(config, tmplName, done) {
	logger.trace('partialAsync '+ tmplName);
	var found;
	async.eachSeries(config.root_partials, 
		function(root, next) {
			if (!found) {
				var fnpartial = path.join(root, tmplName);
				logger.trace(fnpartial);
				fs.stat(fnpartial, function(err, stats) {
					if (err) { logger.error('SKIP '+ err); next(); }
					else if (! stats.isFile()) {
						next(new Error(fnpartial +' is not a file'));
					} else {
						found = {
							path: tmplName,
							fullpath: fnpartial,
							rootdir: root,
							stat: stats
						};
						next();
					}
				});
			} else next();
		},
		function(err) {
			if (err) { logger.error('FAIL '+ err); done(err); }
			else if (found) done(undefined, found);
			else done(new Error('NOT FOUND '+ tmplName));
		});
};

/**
 * Find a Document file whether it's directly specified, or whether it's in a document directory.
 **/
module.exports.document = function(config, docName) {
    // Does the docName match on its own?
    logger.trace('find.document '+ docName);
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
    // util.log(util.inspect(config));
    if (config.root_docs) {
        for (var i = 0; i < config.root_docs.length; i++) {
            var docroot = config.root_docs[i];
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

module.exports.documentAsync = function(config, docName, done) {
	logger.trace('documentAsync '+ docName);
	var found
	async.eachSeries(config.root_docs, 
		function(root, next) {
			if (!found) {
				var fndocument = path.join(root, docName);
				logger.trace(fndocument);
				fs.stat(fndocument, function(err, stats) {
					if (err) { logger.error('SKIP '+ err); next(); }
					else if (! stats.isFile()) {
						next(new Error(fndocument +' is not a file'));
					} else {
						found = {
							path: docName,
							fullpath: fndocument,
							rootdir: root,
							stat: stats
						};
						next();
					}
				});
			} else next();
		},
		function(err) {
			if (err) { logger.error('FAIL '+ err); done(err); }
			else if (found) done(undefined, found);
			else done(new Error('NOT FOUND '+ docName));
		});
};

module.exports.assetFile = function(config, assetFname, done) {
	var found;
	
	async.eachSeries([ config.root_docs, config.root_assets ],
	function(dirs, next) {
		logger.trace('search for '+ assetFname +' in '+ util.inspect(dirs));
		if (!found) async.eachSeries(dirs,
			function(docroot, next2) {
				logger.trace('search for '+ assetFname +' in '+ docroot);
				if (!found)	
					fs.stat(path.join(docroot, assetFname), function(err, stats) {
						if (err) next2(); // ignoring errors
						else if (! stats.isFile()) next2(new Error(assetFname +" is NOT a file"));
						else {
							found = path.join(docroot, assetFname);
							logger.trace(' found = '+ found);
							next2();
						}
					});
				else next2();
			},
			function(err) {
				if (err) next(err);
				else next();
			});
		else next();
	},
	function(err) {
		if (err) { logger.error(err); done(err); }
		else if (found) done(undefined, found);
		else { logger.error(assetFname +" not found"); done(assetFname +" not found"); }
	});
};


