var util = require('util');

module.exports = {
    root_assets: [ __dirname +'/assets' ],
    root_layouts: [ __dirname +'/layouts' ],    // Directory for layout files
    root_partials: [ __dirname +'/partials' ],  // Directory for partials
    root_out: 'out',                // Rendered output goes here
    root_docs: [ __dirname +'/documents' ],     // Directory/ies of input files

    root_url: "http://test.site", // Root URL for the site this will generate
    
    mahabhuta: [ /*function($, metadata, done) {
      
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
    
    
    config: function(akasha) {
    }

}