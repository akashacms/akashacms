
module.exports = function(grunt) {
    grunt.registerTask('eventBeforeRender', function() {
        var done = this.async();
        grunt.config.requires('akasha');
        grunt.config.requires('config');
        var akasha = grunt.config('akasha');
        var config = grunt.config('config');
        akasha.dispatcher('before-render-files', done);
    });
};
