
module.exports = function(grunt) {
    grunt.registerTask('zipRenderedSite', function() {
        var done = this.async();
        grunt.config.requires('akasha');
        grunt.config.requires('config');
        var akasha = grunt.config('akasha');
        var config = grunt.config('config');
        akasha.zipRenderedSite(done);
    });
};
