
module.exports = {
  match: function(fname) {
	var matches;
	if ((matches = fname.match(/^(.*)(\.html)$/)) !== null) {
	  return {
		path: matches[0],
		renderedFileName: matches[0],
		extension: matches[2]
	  };
	} else {
	  return null;
	}
  },
  renderSync: function(text, metadata) {
	return text;
  },
  render: function(text, metadata, done) {
	done(null, text);
  }
};
