
var cheerio = require('cheerio');

module.exports.render = function(text, options, done) {
    var $ = cheerio.load(text);
    options.process($, options, function(err) {
        if (err) done(err);
        else done(err, $.html());
    });
}

