
module.exports = function(grunt) {
    grunt.registerTask('generateSitemap', function() {
        var done = this.async();
        require('../index').generateSitemap(done);
    });
};
