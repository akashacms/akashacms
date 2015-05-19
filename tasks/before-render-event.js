
module.exports = function(grunt) {
    grunt.registerTask('eventBeforeRender', function() {
        var done = this.async();
        require('../index').dispatcher('before-render-files', done);
    });
};
