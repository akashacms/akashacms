
module.exports = function(grunt) {
    grunt.registerTask('previewServer', function() {
        var done = this.async();
        require('../index').runPreviewServer(done);
    });
};
