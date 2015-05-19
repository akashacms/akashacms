
module.exports = function(grunt) {
    grunt.registerTask('renderDocuments', function() {
        var done = this.async();
        require('../index').renderDocuments(done);
    });
};
