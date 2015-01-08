/**
 *
 * Copyright 2015-2015 David Herron
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

var glob  = require('glob');
var async = require('async');
var fs    = require('fs-extra');
var util  = require('util');
var path  = require('path');

module.exports = function(basedir, pattern, destdir, done) {

	glob(pattern, {
		cwd: basedir
	},
	function(err, files) {
		if (err) { 
			// util.error(err);
			done(err);
		} else { 
			// util.log(basedir +' '+ util.inspect(files));
			
			async.eachLimit(files, 10,
			function(fpath, next) {
				
				var fnCopyFrom = path.join(basedir, fpath);
				var fnCopyTo   = path.join(destdir, fpath);
				var dirCopyTo  = path.dirname(fnCopyTo);
				
				fs.stat(fnCopyFrom, function(err, stats) {
					if (err) { 
						// util.error(err);
						next(err);
					} else if (! stats.isFile()) next();
					else {
						fs.mkdirs(dirCopyTo, function(err) {
							if (err) { util.error('mkdirs '+ err); }
							else {
						
								// util.log('copy '+ fnCopyFrom +' to '+ fnCopyTo);
						
								var rd = fs.createReadStream(fnCopyFrom);
								rd.on("error", function(err) {
									util.error('createReadStream '+ err);
								});
								var wr = fs.createWriteStream(fnCopyTo);
								wr.on("error", function(err) {
									util.error('createWriteStream '+ err);
									next(err);
								});
								wr.on("finish", function(ex) {
									next();
								});
								rd.pipe(wr);
							}
						});
					}
				});
			},
			function(err) {
				if (err) done(err);
				else { 
					// util.log('docopy FINI '+ basedir); 
					done();
				}
			});
			
		}
	});
};