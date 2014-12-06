
var cheerio = require('cheerio');
var util    = require('util');
var async   = require('async');

var logger;
var akasha, config;

exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
	logger = akasha.getLogger("mahabhuta");
};

exports.render = function(text, options, done) {
    // util.log(util.inspect(options));
    var $ = exports.parse(text);
    // util.log(util.inspect($));
    options.process($, options, function(err) {
        if (err) done(err);
        else done(undefined, $.html());
    });
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
    var $ = exports.parse(text);
	if (mahabhutaFuncs && mahabhutaFuncs.length > 0) {
		async.eachSeries(mahabhutaFuncs,
			function(mahafunc, next) {
				mahafunc($, metadata, function(err) {
					if (err) next(err);
					else next();
				});
			},
			function(err) {
				if (err) done(err);
				else done(undefined, $.html());
			});
	} else {
		done(undefined, $.html());
	}
};

exports.process1 = function(text, mahafunc, done) {
    var $ = exports.parse(text);
	mahafunc($, function(err) {
		if (err) done(err);
		else done(undefined, $.html());
	});
};
