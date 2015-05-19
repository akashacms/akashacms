
module.exports = function(grunt) {
    grunt.registerTask('editServer', function() {
        var done = this.async();
        require('../index').runEditServer(done);
    });
};
