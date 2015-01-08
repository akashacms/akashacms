// Mock out enough of AkashaCMS so the tests run

var find       = require('../lib/find');
var renderer   = require('../lib/renderer2');
var mahabhuta  = require('../lib/mahabhuta');
var globcopy   = require('../lib/globcopy');
var fileCache  = require('../lib/fileCache');

var config;

module.exports.config = function(_config) {
	config = _config;
    fileCache.config(module.exports, config);
    find.config(module.exports, config);
    renderer.config(module.exports, config);
    mahabhuta.config(module.exports, config);
};

module.exports.getLogger = function(nm) {
	return {
		info: function() { },
		warn: function() { },
		error: function() { },
		trace: function() { }
	};
};