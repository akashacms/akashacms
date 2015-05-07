
var ejs  = require('ejs');
var md   = require('./md');


module.exports.rendererEJS = {
  match: function(fname) {
	var matches;
	if (((matches = fname.match(/^(.*\.html)\.(ejs)$/)) !== null)
	 || ((matches = fname.match(/^(.*\.php)\.(ejs)$/)) !== null)) {
	  return {
		path: matches[0],
		renderedFileName: matches[1],
		extension: matches[2]
	  };
	} else {
	  return null;
	}
  },
  renderSync: function(text, metadata) {
	return ejs.render(text, metadata);
  },
  render: function(text, metadata, done) {
	done(null, ejs.render(text, metadata));
  }
};

module.exports.rendererEJSMD = {
  match: function(fname) {
	var matches;
	if ((matches = fname.match(/^(.*\.html)\.(ejs\.md)$/)) !== null) {
	  return {
		path: matches[0],
		renderedFileName: matches[1],
		extension: matches[2]
	  };
	} else {
	  return null;
	}
  },
  renderSync: function(text, metadata) {
	return ejs.render(md.renderSync(text), metadata);
  },
  render: function(text, metadata, done) {
	done(null, ejs.render(md.renderSync(text), metadata));
  }
};
