
module.exports = function(grunt) {
    grunt.registerTask('zipRenderedSite', function() {
        var done = this.async();
        require('../index').zipRenderedSite(done);
    });
};
