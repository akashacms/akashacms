
module.exports = function(grunt) {
    grunt.registerTask('editServer', function() {
        var done = this.async();
        grunt.config.requires('akasha');
        grunt.config.requires('config');
        var akasha = grunt.config('akasha');
        var config = grunt.config('config');
        akasha.runEditServer(config, done);
    });
};
