
var akasha, config;

module.exports = {
    config: function(_akasha, _config) {
        config = _config;
        akasha = _akasha;
    },
    match: function(fname) {
        var matches;
        if ((matches = fname.match(/^(.*\.html)\.(json)$/)) !== null) {
            // console.log('matched .html.json '+ fname);
            return {
                path: matches[0],
                renderedFileName: matches[1],
                extension: matches[2],
                doLayouts: true
            };
        } else {
            return null;
        }
    },
    renderSync: function(text, metadata) {
        // console.log('renderSync .html.json '+ text);
        var json = JSON.parse(text);
        return akasha.partialSync(metadata.JSONFormatter, { data: json });
    },
    render: function(text, metadata, done) {
        // console.log('render .html.json '+ text);
        var json = JSON.parse(text);
        akasha.partial(metadata.JSONFormatter, { data: json }, done);
    }
};