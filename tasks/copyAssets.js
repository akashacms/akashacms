
module.exports = function(grunt) {
    grunt.registerTask('copyAssets', function() {
        var done = this.async();
        require('../index').copyAssets(done);
    });
};
