var util = require('util');
var path = require('path');

module.exports = {
    root_assets: [ path.join(__dirname, '/assets') ],
    root_layouts: [ path.join(__dirname, '/layouts') ],    // Directory for layout files
    root_partials: [ path.join(__dirname, '/partials') ],  // Directory for partials
    root_out: 'out',                // Rendered output goes here
    root_docs: [ path.join(__dirname, '/documents') ],     // Directory/ies of input files

    root_url: "http://test.site", // Root URL for the site this will generate
    
    mahabhuta: [ /*function(config, $, metadata, done) {
      
            util.log('before: '+ $.html());
          util.log('testcase  mahabhuta '+ util.inspect(metadata));
                    
            if (typeof metadata.pagetitle !== "undefined") {
                /*akasha.partialSync(config, 'ak_titletag.html.ejs', {
                  title: data.pagetitle !== "undefined" ? data.pagetitle : data.title
                }, function(err, html) {
                  
                });* /
                $('ak-page-title').replaceWith('<title>'+ metadata.pagetitle +'</title>');
            } else if (typeof metadata.title !== "undefined") {
                $('ak-page-title').replaceWith('<title>'+ metadata.title +'</title>');
            }
            util.log('after: '+ $.html());
            done();
    } */ ],
    
    funcs: {
        // Any functions put here are available in templates as functions
    },
    
    log4js: {
    	appenders: [
    		{ type: "console" }
    	],
    	replaceConsole: false,
    	levels: {
    		"[all]": "INFO"
    	}
    },
    
    config: function(akasha) {
		akasha.registerPlugins(module.exports, [
			// { name: 'akashacms-theme-bootstrap', plugin: require('akashacms-theme-bootstrap') },
			// { name: 'akashacms-breadcrumbs', plugin: require('akashacms-breadcrumbs') },
			// { name: 'akashacms-booknav', plugin: require('akashacms-booknav') },
			{ name: 'akashacms-embeddables', plugin: require('akashacms-embeddables') },
			// { name: 'akashacms-blog-podcast', plugin: require('akashacms-blog-podcast') },
			// { name: 'akashacms-social-buttons', plugin: require('akashacms-social-buttons') },
			// { name: 'akashacms-tagged-content', plugin: require('akashacms-tagged-content') }
		]);
    }

}