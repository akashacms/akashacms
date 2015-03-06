
module.exports = function(grunt) {
    grunt.registerTask('previewServer', function() {
        var done = this.async();
        grunt.config.requires('akasha');
        grunt.config.requires('config');
        var akasha = grunt.config('akasha');
        var config = grunt.config('config');
        akasha.runPreviewServer(config, done);
    });
};
