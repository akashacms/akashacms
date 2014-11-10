
var cheerio = require('cheerio');
var util    = require('util');

var logger;

module.exports.config = function(akasha, config) {
	logger = akasha.getLogger("mahabhuta");
};

module.exports.render = function(text, options, done) {
    // util.log(util.inspect(options));
    var $ = options.cheerio ? cheerio.load(text, options.cheerio) : cheerio.load(text);
    // util.log(util.inspect($));
    options.process($, options, function(err) {
        if (err) done(err);
        else done(err, $.html());
    });
}

