
var less      = require('less');

module.exports = {
  match: function(fname) {
	var matches;
	if ((matches = fname.match(/^(.*\.css)\.(less)$/)) !== null) {
	  return {
		path: matches[0],
		renderedFileName: matches[1],
		extension: matches[2]
	  };
	} else {
	  return null;
	}
  },
  renderSync: null,
  render: function(lesstxt, metadata, done) {
    less.render(lesstxt, function (err, css) {
        if (err) done(err);
        else     done(null, css);
    });
  }
};

/*
var renderLess = module.exports.renderLess = function(fileName, done) {
    util.log('renderLess: ' + fileName);
    var lessEntry = fileCache.readDocument(options, fileName);
    var lesstxt = fs.readFileSync(lessEntry.fullpath, 'utf8');
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    var rendered = undefined;
    less.render(lesstxt, function (err, css) {
        if (err)
            done(err);
        else
            done(null, { fname: fname, fnext: fnext, css: css });
    });
}


var render_less = function(options, entry, done) {
    renderer.renderLess(entry.path, function(err, rendered) {
        if (err) done(err);
        else {
            var renderTo = path.join(options.root_out, rendered.fname);
            fs.mkdirs(path.dirname(rendered.fname), function(err) {
                if (err) done(err);
                else fs.writeFile(renderTo, rendered.css, 'utf8', function (err) {
                    if (err) done(err);
                    else {
                        fs.utimes(renderTo, entry.stat.atime, entry.stat.mtime, function(err) {
                            if (err) done(err);
                            else done();
                        });
                    }
                });
            });
        }
    });
};
*/