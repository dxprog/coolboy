module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            options: {
                transform: [
                    [ 'babelify', { presets: 'es2015' } ]
                ],
                browserifyOptions: {
                  debug: true
                }
            },
            dist: {
              files: {
                  './dist/coolboy.js': [ './src/app.js' ]
              }
            }
        },
        watch: {
            js: {
                files: [
                    './src/**/*.js'
                ],
                tasks: [ 'browserify' ],
            },
            configFiles: {
                files: [ 'Gruntfile.js' ],
                options: {
                    reload: true
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.registerTask('default', [ 'browserify' ]);
};