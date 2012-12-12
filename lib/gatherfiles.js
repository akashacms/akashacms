
var fs         = require('fs');
var util       = require('util');
var filewalker = require('filewalker');

// return an array of
// {
//    path: "path/to/resource",
//    stat:  { stat object },
//    frontmatter: { title: "title string", .. etc },
//    data: "data portion of file"
// }

var extractFrontmatter = module.exports.extractFrontmatter = function(text) {
    var ret = {};
    if (text.charAt(0) === '-' && text.charAt(1) === '-' && text.charAt(2) === '-') {
        var splitLine = /^(\w+):\s*(.*)$/;
        var lines = text.split('\n');
        lines.shift();
        for (var line = lines.shift();
             ! ( line.charAt(0) === '-' && line.charAt(1) === '-' && line.charAt(2) === '-' );
             line = lines.shift()) {
            if (! line) continue;
            // util.log(line);
            var colon  = line.indexOf(':');
            if (colon < 0) continue;
            var tagname = line.substring(0, colon).trim();
            var tagval  = line.substring(colon+1).trim();
            // util.log(tagname);
            // util.log(tagval);
            ret[tagname] = tagval;
            /*var tagval = splitLine.exec(line);
            util.log(line);
            util.log(util.inspect(tagval));
            ret[tagval[1]] = tagval[2];*/
        }
        ret.text = lines.join('\n');
    } else {
        ret.text = text;
    }
    return ret;
}

// TODO: parse tags: line
// TODO: check into YAML frontmatter

var gather = module.exports.gather = function(rootdir, done) {
    var data = [];
    filewalker(rootdir, { maxPending: -1, maxAttempts: 3, attemptTimeout: 3000 })
    .on('dir', function(path, s, fullPath) {
        util.log(rootdir + ' DIR ' + path);
        data.push({
            rootdir: rootdir,
            path: path,
            fullpath: fullPath,
            stat: fs.statSync(fullPath),
            isdir: true
        });
    })
    .on('file', function(path, s, fullPath) {
        util.log(rootdir + ' FILE ' + path);
        var text = fs.readFileSync(fullPath, 'utf8');
        data.push({
            rootdir: rootdir,
            path: path,
            fullpath: fullPath,
            stat: fs.statSync(fullPath),
            isdir: false,
            frontmatter: extractFrontmatter(text),
            data: text
        });
    })
    .on('error', function(err) {
        process.stdout.write('\n');
        console.log('error ', err);
        done(err, data);
    })
    .on('done', function() {
        done(undefined, data);
    })
    .walk();
}
