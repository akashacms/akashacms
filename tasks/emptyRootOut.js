
module.exports = function(grunt) {
    grunt.registerTask('emptyRootOut', function() {
        var done = this.async();
        require('../index').emptyRootOut(done);
    });
};
