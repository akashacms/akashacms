
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
			
			async.eachSeries(files,
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