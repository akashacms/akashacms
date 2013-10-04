var path = require('path');

module.exports.config = function(akasha, config) {
    config.root_partials.push(path.join(__dirname, 'partials'));
    config.root_layouts.push(path.join(__dirname, 'layout'));
    
    config.funcs.akDoHeaderMeta = function(arg, callback) {
        var data = {};
        for (var prop in arg) {
            if (!(prop in data)) data[prop] = arg[prop];
        }
        if (typeof data.metaOGtitle === "undefined") {
            if (typeof data.pagetitle !== "undefined") {
                    data.metaOGtitle = data.pagetitle;
            } else if (typeof data.title !== "undefined") {
                    data.metaOGtitle = data.title;
            }
        }
        if (typeof data.metaOGdescription === "undefined") {
            if (typeof data.metadescription !== "undefined") {
                    data.metaOGdescription = data.metadescription;
            }
        }
        if (typeof data.metaDCtitle === "undefined") {
            if (typeof data.pagetitle !== "undefined") {
                    data.metaDCtitle = arg.pagetitle;
            } else if (typeof data.title !== "undefined") {
                    data.metaDCtitle = data.title;
            }
        }
        if (typeof data.metapagename === "undefined") {
            if (typeof data.pagetitle !== "undefined") {
                    data.metapagename = arg.pagetitle;
            } else if (typeof data.title !== "undefined") {
                    data.metapagename = data.title;
            }
        }
        if (typeof data.metadate === "undefined") {
            data.metadate = data.rendered_date;
        }
        
        var val = akasha.partialSync(config, "ak_headermeta.html.ejs", data);
        if (callback) callback(undefined, val);
        return val;
    }
}