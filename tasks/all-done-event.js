
module.exports = function(grunt) {
    grunt.registerTask('allDone', function() {
        var done = this.async();
        require('../index').dispatcher('all-done', done);
    });
};
