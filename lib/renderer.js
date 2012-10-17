
var fs   = require('fs');
var ejs  = require('ejs');
var util = require('util');
var K    = require('kernel');
var less = require('less');

var extractFrontmatter = function(text) {
    var ret = {};
    if (text.charAt(0) === '-' && text.charAt(1) === '-' && text.charAt(2) === '-') {
        var splitLine = /^([a-zA-Z0-9]+):[ \t]*(.*)$/;
        var lines = text.split('\n');
        lines.shift();
        for (var line = lines.shift(); line !== '---'; line = lines.shift()) {
            var tagval = splitLine.exec(line);
            ret[tagval[1]] = tagval[2];
        }
        ret.text = lines.join('\n');
    } else {
        ret.text = text;
    }
    return ret;
}

var root_layouts = undefined;
module.exports.setRootLayouts = function(dir) { root_layouts = dir; }

var findtemplate = function(tmplName) {
    var stat = fs.existsSync(tmplName) ? fs.statSync(tmplName) : undefined;
    if (stat) {
        return tmplName;
    }
    stat = fs.existsSync(root_layouts +"/"+ tmplName) ? fs.statSync(root_layouts +"/"+ tmplName) : undefined;
    if (stat) {
        return root_layouts +"/"+ tmplName;
    }
    return undefined;
}

var fms = {};

var readFile = function(fileName) {
    if (fms.hasOwnProperty(fileName)) {
        return fms[fileName];
    }
    var text = fs.readFileSync(fileName, 'utf8');
    fms[fileName] = extractFrontmatter(text);
    return fms[fileName];
}

K.resourceLoader = function(fileName, callback) {
    util.log('resourceLoader ' + fileName);
    var frontmatter = readFile(fileName);
    util.log('resourceLoader ' + fileName + ' template=' + frontmatter.text);
    callback(null, frontmatter.text);
}

var supportedForHtml = module.exports.supportedForHtml = function(fn) {
    if (fn.match(/\.html\.ejs$/) || fn.match(/\.html\.md$/) || fn.match(/\.html\.kernel$/))
        return true;
    else
        return false;
}

var partial = module.exports.partial = function(name, locals, callback) {
    util.log('about to render ' + name + ' with ' + util.inspect(locals));
    if (name.match(/\.kernel$/)) {
        partialKernel(name, locals, callback);
    } else if (entry.path.match(/\.html\.ejs$/)
            || entry.path.match(/\.html\.md$/)) {
        var rendered = partialSync(name, locals);
        callback(null, rendered.content);
    } else {
        throw 'UNKOWN Async Template Engine for ' + name;
    }
}

var partialKernel = function(name, locals, callback) {
    K(name, function (err, template) {
        if (err) {
            util.log('partial error ' + err);
            callback(err);
        } else {
            util.log('rendering ' + name + ' with ' + util.inspect(locals));
            template(locals, callback);
        }
    });
}

var partialSync = module.exports.partialSync = function(name, locals) {
    return renderFile(name, locals);
}

var renderFileAsync = module.exports.renderFileAsync = function(fileName, data, done) {
    util.log('renderFileAsync: ' + fileName);
    var frontmatter = readFile(fileName);
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    
    if (fnext !== "kernel") throw 'UNKOWN Async Template Engine for ' + fileName;
    
    data.partial = module.exports.partial;
    
    for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
    }
    data.layout = undefined;
    var rendered = undefined;
    
    var template = K(fileName, function(err, template) {
        if (err) throw err;
        template(data, function(err, html) {
            data.content = html;
            if (frontmatter.layout) {
                var fntmpl = findtemplate(frontmatter.layout);
                if (fntmpl.match(/\.kernel$/)) {
                    renderFileAsync(fntmpl, data, function(err, data) {
                        if (err) throw err;
                        done(err, {
                            fname:   fname,
                            ext:     fnext,
                            content: data.content
                        });
                    });
                } else {
                    var rdata = renderFile(fntmpl, data);
                    done(undefined, {
                        fname:   fname,
                        ext:     fnext,
                        content: rdata.content  
                    });
                }
            } else {
                done(err, {
                    fname:   fname,
                    ext:     fnext,
                    content: data.content  
                });
            }
        });
    });
}

var renderFile = module.exports.renderFile = function(fileName, data) {
    util.log('renderFile: ' + fileName);
    var frontmatter = readFile(fileName);
    var fnparts = /(.*)\.([^\.]+)$/.exec(fileName);
    var fname = fnparts[1];
    var fnext = fnparts[2];
    
    for (var prop in frontmatter) {
        if (!(prop in data)) data[prop] = frontmatter[prop];
    }
    data.layout = undefined;
    
    var rendered = undefined;
    if (fnext === 'ejs') rendered = ejs.render(frontmatter.text, data);
    else if (fnext === 'md')  rendered = require("markdown").markdown.toHTML(frontmatter.text);
    else throw 'UNKNOWN Synchronous Template Engine for ' + fileName;
    data.content = rendered;
    
    util.log(util.inspect(data));
    
    if (frontmatter.layout) {
        var fntmpl = findtemplate(frontmatter.layout);
        return {
            fname:   fname,
            ext:     fnext, 
            content: renderFile(fntmpl, data).content
        };
    } else {
        return {
            fname:   fname,
            ext:     fnext, 
            content: data.content
        };
    }
}

var renderLess = module.exports.renderLess = function(fileName, done) {
    util.log('renderLess: ' + fileName);
    var lesstxt = fs.readFileSync(fileName, 'utf8');
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