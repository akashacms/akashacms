/**
 *
 * Copyright 2015-2015 David Herron
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

var util = require('util');

/**
 * Wrap the various markdown processors making it easy to switch between them.
 */

//var markdown = require("markdown").markdown;
/* var marked    = require('marked');
marked.setOptions({
  // renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
}); */
var mditConfig = {
  html:         true,        // Enable html tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />)
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  // langPrefix:   'language-',  // CSS language prefix for fenced blocks
  linkify:      false,        // Autoconvert url-like texts to links
  typographer:  true,         // Enable smartypants and other sweet transforms

  // Highlighter function. Should return escaped html,
  // or '' if input not changed
  highlight: function (/*str, , lang*/) { return ''; }
};
var mdit = require('markdown-it');
/* var md        = require('markdown-it')({
  html:         true,        // Enable html tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />)
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  // langPrefix:   'language-',  // CSS language prefix for fenced blocks
  linkify:      true,        // Autoconvert url-like texts to links
  typographer:  true,         // Enable smartypants and other sweet transforms

  // Highlighter function. Should return escaped html,
  // or '' if input not changed
  highlight: function (/ *str, , lang* /) { return ''; }
}); */
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

var siteConfig;
var akasha;
module.exports = {
  config: function(_akasha, _config) {
	siteConfig = _config;
	akasha = _akasha;
	if (siteConfig.builtin && siteConfig.builtin.markdownIt) {
	  md = mdit(siteConfig.builtin.markdownIt);
	} else {
	  console.log('using default markdown config');
	  md = mdit(mditConfig);
	}
  },
  match: function(fname) {
	var matches;
	if ((matches = fname.match(/^(.*\.html)(\.md)$/)) !== null) {
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
	return md.render(text);
  },
  render: function(text, metadata, done) {
	done(null, md.render(text));
  }
};


/* module.exports.render = function(text) {

	// return marked(text);
		
	return md.render(text);
	// return markdown.toHTML( text );

}; */