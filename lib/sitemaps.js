/**
 *
 * Copyright 2012-2015 David Herron
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



///////////////// XML Sitemap Generation .. works by building an array, then dumping it out in XML

var smap       = require('sightmap');
var fs         = require('fs');
var path       = require('path');

var logger;

module.exports.config = function(akasha, config) {
    logger = akasha.getLogger("sightmaps");
    
    module.exports.add_sitemap_entry = add_sitemap_entry.bind(config);
    module.exports.generateSitemap = generateSitemap.bind(config);
};

var rendered_files = [];

function add_sitemap_entry(fname, priority, mtime) {
	if (!(this && this.builtin && this.builtin.suppress && this.builtin.suppress.sitemap)) {
		// util.log('add_sitemap_entry ' + fname);
		var fDate = new Date(mtime);
		var mm = fDate.getMonth() + 1;
		if (mm < 10) {
			mm = "0" + mm.toString();
		} else {
			mm = mm.toString();
		}
		var dd = fDate.getDate();
		if (dd < 10) {
			dd = "0" + dd.toString();
		} else {
			dd = dd.toString();
		}
		rendered_files.push({
			loc: encodeURI(fname),
			priority: priority,
			lastmod:  fDate.getUTCFullYear() +"-"+ mm +"-"+ dd
		});
		/*
		 * This lets us remove the 'index.html' portion of URL's submitted in the sitemap.
		 * But we need to also ensure all links within the site pointing at this also do
		 * not use 'index.html' in the URL.  Ugh.
		 *if (fname.match(/index.html$/)) {
			rendered_files.push({loc: fname.replace(/index.html$/, ''), priority: priority});
		}*/
	}
}

function generateSitemap(done) {
    // util.log('generate_sitemap ' + util.inspect(rendered_files));
	// util.log(util.inspect(this.builtin));
	var root_out = this.root_out;
	if (!(this && this.builtin && this.builtin.suppress && this.builtin.suppress.sitemap)) {
		smap(rendered_files);
		smap(function(xml) {
			fs.writeFile(path.join(root_out, "sitemap.xml"), xml, 'utf8', function (err) {
				if (err) {
					done(err);
				} else {
					done();
				}
			});
		});
	} else done();
}

