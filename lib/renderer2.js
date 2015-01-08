/**
 *
 * Copyright 2012-2014 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var fs        = require('fs');
var util      = require('util');
var path      = require('path');
var async     = require('async');
var oembed    = require('oembed');
var fileCache = require('./fileCache');
var find      = require('./find');

var less      = require('less');
var ejs       = require('ejs');
// var K         = require('kernel');
//var markdown = require("markdown").markdown;
/* var marked    = require('marked');
marked.setOptions({
  // renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false
}); */
var md        = require('markdown-it')({
  html:         true,        // Enable html tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />)
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  // langPrefix:   'language-',  // CSS language prefix for fenced blocks
  linkify:      true,        // Autoconvert url-like texts to links
  typographer:  true,         // Enable smartypants and other sweet transforms

  // Highlighter function. Should return escaped html,
  // or '' if input not changed
  highlight: function (/*str, , lang*/) { return ''; }
}); 
/*var Remarkable = require('remarkable');
var md = new Remarkable({
  html:         true,        // Enable HTML tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />)
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  langPrefix:   'language-',  // CSS language prefix for fenced blocks
  linkify:      true,        // Autoconvert URL-like text to links

  // Enable some language-neutral replacement + quotes beautification
  typographer:  true,

  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
  quotes: '“”‘’',

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed
  highlight: function (/*str, lang* /) { return ''; }
}); */
var mahabhuta = require('./mahabhuta');

var logger;

var siteConfig;
module.exports.config = function(akasha, _config) {
  // util.log('renderer config ' + util.inspect(theoptions));
  siteConfig = _config;
  if (!logger) logger = akasha.getLogger("renderer");
};

var copyProperties = module.exports.copyProperties = function(metadata, frontmatter) {
  for (var prop in frontmatter) {
    if (!(prop in metadata)) metadata[prop] = frontmatter[prop];
  }
  return metadata;
};

var oembedRender = module.exports.oembedRender = function(arg, callback) {
	throw new Error('oEmbed Render called');
    // util.log('oembed ' + util.inspect(arg) +" url in arg "+ ("url" in arg) +" typeof "+ typeof arg.url +" test "+ (typeof arg.url === "undefined"));
    /* if (!("template" in arg) || typeof arg.template === "undefined") 
        return callback(new Error("Must provide a partial/template render on")); */
    if (!("url" in arg) || typeof arg.url === "undefined")
      callback(new Error("Must provide a URL to retrieve"));
    else
      oembed.fetch(arg.url, { maxwidth: 6000 }, function(err, result) {
        if (err) {
            callback(err);
        } else {
            // util.log('retrieved oembed.. ' + util.inspect(result) + ' for url ' + arg.url);
            if (!("template" in arg) || typeof arg.template === "undefined")
                callback(undefined, result.html);
            else 
            	module.exports.partial(arg.template, result, callback);
            	// callback(undefined, partialSync(arg.template, result));
                /*partialKernel(arg.template, result, function(err, data) {
                  // util.log(util.inspect(err));
                  // util.log(util.inspect(data));
                  callback(err, data);
                });*/
        }
      });
};

var partialSync = function(fname, metadata) {
    var fnamePartial = find.partial(siteConfig, fname);
    logger.trace('partialSync fname=' + fname + ' fnamePartial=' + fnamePartial);
    if (fnamePartial === undefined) 
        return new Error('NO FILE FOUND FOR PARTIAL ' + util.inspect(fname));
    var text = fs.readFileSync(fnamePartial, 'utf8');
    var rendered;
    if (fname.match(/\.ejs$/)) rendered = ejs.render(text, metadata);
    // else if (fname.match(/\.md$/)) rendered = marked(text);
    else if (fname.match(/\.md$/)) rendered = md.render(text);
    else if (fname.match(/\.html$/)) rendered = text;
    else { return new Error('UNKNOWN Synchronous Template Engine for ' + fname); }
    return rendered;
};

module.exports.partial = function(name, metadata, callback) {
    if (name.match(/\.ejs$/) || name.match(/\.md$/) || name.match(/\.html$/)) {
		var rndrd = partialSync(name, metadata);
		if (rndrd instanceof Error) {
			callback(rndrd);
		} else {
			callback(undefined, rndrd);
		}
    } else {
    	callback(new Error('.kernel Partial used '+ name));
		// partialKernel(name, metadata, callback);
    }
};

module.exports.partialSync = function(name, metadata, done) {
    // util.log('renderer2 exports.partialSync '+ name +' '+ util.inspect(metadata));
    var rendered = partialSync(name, metadata);
    if (done) done(null, rendered);
    return rendered;
};

/*
 * Support:
 *
 * fname.html.md 
 * fname.html.ejs.md
 * fname.html.ejs
 * fname.php.ejs
 *
 * While supporting the possibility of adopting an asynchronous engine.
 */
var renderBody = function(fname, body, metadata, done) {
	logger.trace('renderBody '+ util.inspect(fname));
	// util.log(util.inspect(body));
	// util.log(util.inspect(metadata));
	logger.info('renderBody metadata='+ util.inspect(metadata));
	if (fname.match(/\.md$/)) {
		if (fname.match(/\.ejs\.md$/)) {
			done(undefined, ejs.render(md.render(body), metadata));
			// done(undefined, ejs.render(marked(body), metadata));
		} else {
			done(undefined, /* marked(body) */ md.render(body));
		}
	} else if (fname.match(/\.ejs$/)) {
		done(undefined, ejs.render(body, metadata));
	} else if (fname.match(/\.kernel$/)) {
		throw new Error('Use of Kernel templating '+ fname);
	} else {
		done(undefined, body);
	}
}

/**
 *
 **/
 
module.exports.render = function(akashacms, config, entryOrig, entryTemplate, metadata, done) {
    
    logger.trace('render orig='+ entryOrig.path +' template='+ (entryTemplate ? entryTemplate.path : ""));
    
    if (!metadata.partial) metadata.partial = module.exports.partial;
    if (!metadata.partialSync) metadata.partialSync = partialSync;
    
	var txtToRender;
	var fnRender;
	if (entryTemplate) {
		txtToRender = entryTemplate.frontmatter.text;
		fnRender = entryTemplate.path;
	} else {
		txtToRender = entryOrig.frontmatter.text;
		fnRender = entryOrig.path;
	}
	
	renderBody(fnRender, txtToRender, metadata, function(err, newbody) {
		logger.trace('renderBody finish for orig='+ entryOrig.path +' fnRender='+ fnRender
			+' template='+ (entryTemplate ? entryTemplate.path : ""));
		if (err) {
			logger.error('renderBody failed with '+ err);
			done(err);
		} else {
			mahabhuta.process(newbody, metadata, config.mahabhuta, function(err, rendered) {
				logger.trace('mahabuta finish for orig='+ entryOrig.path +' fnRender='+ fnRender
					+' template='+ (entryTemplate ? entryTemplate.path : ""));
				if (err) {
					logger.error('mahabhuta.process failed with '+ err);
					done(err);
				} else if (!entryTemplate && entryOrig && entryOrig.frontmatter && entryOrig.frontmatter.yaml && entryOrig.frontmatter.yaml.layout) {
					metadata.content = rendered;
					logger.trace('about to render orig='+ entryOrig.path +' by entryOrig template '+ entryOrig.frontmatter.yaml.layout);
					fileCache.readTemplate(config, entryOrig.frontmatter.yaml.layout, function(err, _entryTemplate) {
						if (err) { logger.error(err); done(err); }
						else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done);
					});
				} else if (entryTemplate && entryTemplate && entryTemplate.frontmatter && entryTemplate.frontmatter.yaml && entryTemplate.frontmatter.yaml.layout) {
					metadata.content = rendered;
					logger.trace('about to render orig='+ entryOrig.path +' by entryTemplate template '+ entryTemplate.frontmatter.yaml.layout);
					fileCache.readTemplate(config, entryTemplate.frontmatter.yaml.layout, function(err, _entryTemplate) {
						if (err) { logger.error(err); done(err); }
						else module.exports.render(akashacms, config, entryOrig, _entryTemplate, metadata, done)
					});
				} else {
					metadata.content = rendered;
					logger.trace('final rendering '+ entryOrig.renderedFileName); // +' '+ rendered);
					done(undefined, {
						fname:   entryOrig.renderedFileName,
						ext:     entryOrig.fileExt,
						content: rendered
					});
				}
			});
		}
	});
};
