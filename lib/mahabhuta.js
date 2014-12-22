
var cheerio = require('cheerio');
var util    = require('util');
var async   = require('async');

var logger;
var akasha, config;

/* NOTE: The only dependency on AkashaCMS is getLogger and the config.cheerio use below.
 * For the long term we want to dissociate Mahabhuta from AkashaCMS.
 *
 * Maybe some of what's currently AkashaCMS plugins could be separated into Mahabhuta.
 * Maybe a rendering engine for Express etc could be built?
 */
exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("mahabhuta");
};

/**
 * Simply parse the text, returning $ so the caller can do whatever they want.
 */
exports.parse = function(text) {
    return config.cheerio ? cheerio.load(text, config.cheerio) : cheerio.load(text);
};

/**
 * Process the text using functions supplied in the array mahabhutaFuncs.
 */
exports.process = function(text, metadata, mahabhutaFuncs, done) {

	// If we were on a Synchronous platform, this might be
	//
	// var cleanOrDirty = 'first-time';
	// while (dirtyOrClean !== 'dirty' && dirtyOrClean !== 'first-time') {
	// 		cleanOrDirty = 'dirty';
	//		mahabhutaFuncs.forEach(function(mahafunc) {
	//			mahafunc($, metadata, setDirty, function(err) { ... });
	//      }
	// }

    if (!mahabhutaFuncs || mahabhutaFuncs.length < 0) mahabhutaFuncs = [];
    
	var cleanOrDirty = 'first-time';
	var setDirty = function() { cleanOrDirty = 'dirty'; };

    var $ = exports.parse(text);
    
    var runMahaFuncs = function() {
    	if (cleanOrDirty === 'dirty' || cleanOrDirty === 'first-time') {
    		cleanOrDirty = 'clean';
			async.eachSeries(mahabhutaFuncs,
				function(mahafunc, next) {
					// logger.trace('mahafunc run');
					mahafunc($, metadata, setDirty, function(err) {
						if (err) next(err);
						else next();
					});
				},
				function(err) {
					if (err) done(err);
					else runMahaFuncs();
				});
		} else {
			done(undefined, $.html());
		}
	}
	runMahaFuncs();
};

exports.process1 = function(text, metadata, mahafunc, done) {
	exports.process(text, metadata, [ mahafunc ], done);
};

/**
 * The beginnings of Express integration for Mahabhuta.  The only unclarity is
 * the source for the function array.
 */
exports.express = function(filePath, options, callback) {
	fs.readFile(filePath, function (err, content) {
		if (err) callback(new Error(err));
		else {
			exports.process(content, options, "TBD - FUNCTIONS", function(err, html) {
				if (err) callback(err);
				else callback(null, html);
			});
		}
	})
};
