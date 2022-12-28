/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var path = require("path");
var fs = require("fs-extra");
var sass = require("sass");

module.exports = function(grunt) {

    var nodemonArgs = ["-V"];
    var flowFile = grunt.option('flowFile');
    if (flowFile) {
        nodemonArgs.push(flowFile);
        process.env.NODE_RED_ENABLE_PROJECTS=false;
    }
    var userDir = grunt.option('userDir');
    if (userDir) {
        nodemonArgs.push("-u");
        nodemonArgs.push(userDir);
    }

    var browserstack = grunt.option('browserstack');
    if (browserstack) {
        process.env.BROWSERSTACK = true;
    }
    var nonHeadless = grunt.option('non-headless');
    if (nonHeadless) {
        process.env.NODE_RED_NON_HEADLESS = true;
    }
    const pkg = grunt.file.readJSON('package.json');
    process.env.NODE_RED_PACKAGE_VERSION = pkg.version;
    grunt.initConfig({
        pkg: pkg,
        paths: {
            dist: ".dist"
        },
        webdriver: {
            all: {
                configFile: 'test/__no_file__.js'
            }
        },
        jshint: {
            options: {
                jshintrc:true
                // http://www.jshint.com/docs/options/
                //"asi": true,      // allow missing semicolons
                //"curly": true,    // require braces
                //"eqnull": true,   // ignore ==null
                //"forin": true,    // require property filtering in "for in" loops
                //"immed": true,    // require immediate functions to be wrapped in ( )
                //"nonbsp": true,   // warn on unexpected whitespace breaking chars
                ////"strict": true, // commented out for now as it causes 100s of warnings, but want to get there eventually
                //"loopfunc": true, // allow functions to be defined in loops
                //"sub": true       // don't warn that foo['bar'] should be written as foo.bar
            },
            editor: {
                files: {
                    src: [ 'src/js/**/*.js' ]
                }
            },
        },
        concat: {
            options: {
                separator: ";",
            },
            build: {
                src: [
                    // Ensure editor source files are concatenated in
                    // the right order
                    "src/js/polyfills.js",
                    "src/js/jquery-addons.js",
                    "src/js/red.js",
                    "src/js/resource.js",
                    "src/js/events.js",
                    "src/js/hooks.js",
                    "src/js/i18n.js",
                    "src/js/settings.js",
                    "src/js/user.js",
                    "src/js/comms.js",
                    "src/js/runtime.js",
                    "src/js/text/bidi.js",
                    "src/js/text/format.js",
                    "src/js/ui/state.js",
                    "src/js/plugins.js",
                    "src/js/nodes.js",
                    "src/js/font-awesome.js",
                    "src/js/history.js",
                    "src/js/validators.js",
                    "src/js/ui/utils.js",
                    "src/js/ui/common/editableList.js",
                    "src/js/ui/common/treeList.js",
                    "src/js/ui/common/checkboxSet.js",
                    "src/js/ui/common/menu.js",
                    "src/js/ui/common/panels.js",
                    "src/js/ui/common/popover.js",
                    "src/js/ui/common/searchBox.js",
                    "src/js/ui/common/tabs.js",
                    "src/js/ui/common/stack.js",
                    "src/js/ui/common/typedInput.js",
                    "src/js/ui/common/toggleButton.js",
                    "src/js/ui/common/autoComplete.js",
                    "src/js/ui/actions.js",
                    "src/js/ui/deploy.js",
                    "src/js/ui/diagnostics.js",
                    "src/js/ui/diff.js",
                    "src/js/ui/keyboard.js",
                    "src/js/ui/workspaces.js",
                    "src/js/ui/statusBar.js",
                    "src/js/ui/view.js",
                    "src/js/ui/view-annotations.js",
                    "src/js/ui/view-navigator.js",
                    "src/js/ui/view-tools.js",
                    "src/js/ui/sidebar.js",
                    "src/js/ui/palette.js",
                    "src/js/ui/tab-info.js",
                    "src/js/ui/tab-info-outliner.js",
                    "src/js/ui/tab-help.js",
                    "src/js/ui/tab-config.js",
                    "src/js/ui/tab-context.js",
                    "src/js/ui/palette-editor.js",
                    "src/js/ui/editor.js",
                    "src/js/ui/editors/panes/*.js",
                    "src/js/ui/editors/*.js",
                    "src/js/ui/editors/code-editors/*.js",
                    "src/js/ui/event-log.js",
                    "src/js/ui/tray.js",
                    "src/js/ui/clipboard.js",
                    "src/js/ui/library.js",
                    "src/js/ui/notifications.js",
                    "src/js/ui/search.js",
                    "src/js/ui/contextMenu.js",
                    "src/js/ui/actionList.js",
                    "src/js/ui/typeSearch.js",
                    "src/js/ui/subflow.js",
                    "src/js/ui/group.js",
                    "src/js/ui/userSettings.js",
                    "src/js/ui/projects/projects.js",
                    "src/js/ui/projects/projectSettings.js",
                    "src/js/ui/projects/projectUserSettings.js",
                    "src/js/ui/projects/tab-versionControl.js",
                    "src/js/ui/touch/radialMenu.js",
                    "src/js/ui/tour/*.js"
                ],
                dest: "public/red/red.js"
            },
            vendor: {
                files: {
                    "public/vendor/vendor.js": [
                        "src/vendor/jquery/js/jquery-3.5.1.min.js",
                        "src/vendor/jquery/js/jquery-migrate-3.3.0.min.js",
                        "src/vendor/jquery/js/jquery-ui.min.js",
                        "src/vendor/jquery/js/jquery.ui.touch-punch.min.js",
                        "node_modules/marked/marked.min.js",
                        "node_modules/dompurify/dist/purify.min.js",
                        "src/vendor/d3/d3.v3.min.js",
                        "node_modules/i18next/i18next.min.js",
                        "node_modules/i18next-http-backend/i18nextHttpBackend.min.js",
                        "node_modules/jquery-i18next/jquery-i18next.min.js",
                        "node_modules/jsonata/jsonata-es5.min.js",
                        "src/vendor/jsonata/formatter.js",
                        "src/vendor/ace/ace.js",
                        "src/vendor/ace/ext-language_tools.js",
                    ],
                    // "public/vendor/vendor.css": [
                    //     // TODO: resolve relative resource paths in
                    //     //       bootstrap/FA/jquery
                    // ],
                    "public/vendor/ace/worker-jsonata.js": [
                        "node_modules/jsonata/jsonata-es5.min.js",
                        "src/vendor/jsonata/worker-jsonata.js"
                    ]
                }
            }
        },
        uglify: {
            build: {
                files: {
                    'public/red/red.min.js': 'public/red/red.js',
                    'public/red/main.min.js': 'public/red/main.js',
                    'public/vendor/ace/mode-jsonata.js': 'src/vendor/jsonata/mode-jsonata.js',
                    'public/vendor/ace/snippets/jsonata.js': 'src/vendor/jsonata/snippets-jsonata.js'
                }
            }
        },
        sass: {
            build: {
                options: {
                    implementation: sass,
                    outputStyle: 'compressed'
                },
                files: [{
                    dest: 'public/red/style.min.css',
                    src: 'src/sass/style.scss'
                }]
            }
        },
        jsonlint: {
            keymaps: {
                src: [
                    'src/js/keymap.json'
                ]
            }
        },
        attachCopyright: {
            js: {
                src: [
                    'public/red/red.min.js',
                    'public/red/main.min.js'
                ]
            },
            css: {
                src: [
                    'public/red/style.min.css'
                ]
            }
        },
        clean: {
            build: {
                src: [
                    "public/red",
                    "public/index.html",
                    "public/favicon.ico",
                    "public/icons",
                    "public/vendor",
                    "public/types/node",
                    "public/types/node-red",
                ]
            },
            release: {
                src: [
                    '<%= paths.dist %>'
                ]
            }
        },
        watch: {
            js: {
                files: [
                    'src/js/**/*.js'
                ],
                tasks: ['copy:build','concat',/*'uglify',*/ 'attachCopyright:js']
            },
            sass: {
                files: [
                    'src/sass/**/*.scss'
                ],
                tasks: ['sass','attachCopyright:css']
            },
            keymaps: {
                files: [
                    'src/js/keymap.json'
                ],
                tasks: ['jsonlint:keymaps','copy:build']
            },
            tours: {
                files: [
                    'src/tours/**/*.js'
                ],
                tasks: ['copy:build']
            },
            misc: {
                files: [
                    'CHANGELOG.md'
                ],
                tasks: ['copy:build']
            }
        },
        concurrent: {
            dev: {
                tasks: ['watch'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },

        copy: {
            build: {
                files:[
                    {
                        src: 'src/js/main.js',
                        dest: 'public/red/main.js'
                    },
                    {
                        src: 'templates/index.html',
                        dest: 'public/index.html'
                    },
                    {
                        src: 'src/js/keymap.json',
                        dest: 'public/red/keymap.json'
                    },
                    {
                        cwd: 'src/images',
                        src: '**',
                        expand: true,
                        dest: 'public/red/images/'
                    },
                    {
                        cwd: 'src/vendor',
                        src: [
                            'ace/**',
                            'jquery/css/base/**',
                            'font-awesome/**',
                            'monaco/dist/**',
                            'monaco/types/extraLibs.js',
                            'monaco/style.css',
                            'monaco/monaco-bootstrap.js'
                        ],
                        expand: true,
                        dest: 'public/vendor/'
                    },
                    {
                        cwd: 'src',
                        src: [
                            'types/node/*.ts',
                            'types/node-red/*.ts',
                        ],
                        expand: true,
                        dest: 'public/'
                    },
                    {
                        cwd: 'src/icons',
                        src: '**',
                        expand: true,
                        dest: 'public/icons/'
                    },
                    {
                        expand: true,
                        src: ['src/index.html','src/favicon.ico'],
                        dest: 'public/',
                        flatten: true
                    },
                    {
                        src: 'CHANGELOG.md',
                        dest: 'public/red/about'
                    },
                    {
                        cwd: 'src/ace/bin/',
                        src: '**',
                        expand: true,
                        dest: 'public/vendor/ace/'
                    },
                    {
                        cwd: 'src/tours',
                        src: '**',
                        expand: true,
                        dest: 'public/red/tours/'
                    }
                ]
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-jsonlint');

    grunt.registerMultiTask('nodemon', 'Runs a nodemon monitor of your node.js server.', function () {
        const nodemon = require('nodemon');
        this.async();
        const options = this.options();
        options.script = this.data.script;
        let callback;
        if (options.callback) {
            callback = options.callback;
            delete options.callback;
        } else {
            callback = function(nodemonApp) {
                nodemonApp.on('log', function (event) {
                    console.log(event.colour);
                });
            };
        }
        callback(nodemon(options));
    });

    grunt.registerMultiTask('attachCopyright', function() {
        var files = this.data.src;
        var copyright = "/**\n"+
            " * Copyright OpenJS Foundation and other contributors, https://openjsf.org/\n"+
            " *\n"+
            " * Licensed under the Apache License, Version 2.0 (the \"License\");\n"+
            " * you may not use this file except in compliance with the License.\n"+
            " * You may obtain a copy of the License at\n"+
            " *\n"+
            " * http://www.apache.org/licenses/LICENSE-2.0\n"+
            " *\n"+
            " * Unless required by applicable law or agreed to in writing, software\n"+
            " * distributed under the License is distributed on an \"AS IS\" BASIS,\n"+
            " * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n"+
            " * See the License for the specific language governing permissions and\n"+
            " * limitations under the License.\n"+
            " **/\n";

        if (files) {
            for (var i=0; i<files.length; i++) {
                var file = files[i];
                if (!grunt.file.exists(file)) {
                    grunt.log.warn('File '+ file + ' not found');
                    return false;
                } else {
                    var content = grunt.file.read(file);
                    if (content.indexOf(copyright) == -1) {
                        content = copyright+content;
                        if (!grunt.file.write(file, content)) {
                            return false;
                        }
                        grunt.log.writeln("Attached copyright to "+file);
                    } else {
                        grunt.log.writeln("Copyright already on "+file);
                    }
                }
            }
        }
    });

    grunt.registerTask('setDevEnv',
        'Sets NODE_ENV=development so non-minified assets are used',
            function () {
                process.env.NODE_ENV = 'development';
            });

    grunt.registerTask('default',
        'Builds editor content then runs code style checks and unit tests on all components',
        ['build','jshint:editor']);

    grunt.registerTask('test-editor',
        'Runs code style check on editor code',
        ['jshint:editor']);

    grunt.registerTask('build',
        'Builds editor content',
        ['clean:build','jsonlint','concat:build','concat:vendor','copy:build','uglify:build','sass:build','attachCopyright']);

    grunt.registerTask('build-dev',
        'Developer mode: build dev version',
        ['clean:build','concat:build','concat:vendor','copy:build','sass:build','setDevEnv']);

    grunt.registerTask('dev',
        'Developer mode: run node-red, watch for source changes and build/restart',
        ['build','setDevEnv','concurrent:dev']);
};
