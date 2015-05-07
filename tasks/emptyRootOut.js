
module.exports = function(grunt) {
    grunt.registerTask('emptyRootOut', function() {
        var done = this.async();
        grunt.config.requires('akasha');
        grunt.config.requires('config');
        var akasha = grunt.config('akasha');
        var config = grunt.config('config');
        akasha.emptyRootOut(done);
    });
};
