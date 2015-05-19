
module.exports = function(grunt) {
    grunt.registerTask('gatherDocuments', function() {
        var done = this.async();
        require('../index').gatherDir(null, done);
    });
};
