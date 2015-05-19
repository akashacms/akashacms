
module.exports = function(grunt) {
    grunt.registerTask('eventDoneRender', function() {
        var done = this.async();
        require('../index').dispatcher('done-render-files', done);
    });
};
