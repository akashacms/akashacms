
module.exports = {
  match: function(fname) {
    return {
      path: fname,
      renderedFileName: fname,
      extension: ""
    };
  },
  renderSync: function(text, metadata) {
	return text;
  },
  render: function(text, metadata, done) {
	done(null, text);
  }
};
