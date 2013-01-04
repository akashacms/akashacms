#!/usr/bin/env node

/**
 *
 * Copyright 2012 David Herron
 * 
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 **/

// akasha init dirName -- initialize new directory
// akasha build
// akasha serve

var util       = require('util');
var fs         = require('fs');
var spawn      = require('child_process').spawn;
var exec       = require('child_process').exec;
var http       = require('http');
var program    = require('commander');
var akasha     = require('akashacms');
var staticSrv  = require('node-static');

program
   .version('0.0.1')
//   .option('-C, --chdir <path>', 'change the working directory')
//   .option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
//   .option('-T, --no-tests', 'ignore test hook')

program
    .command('init <dirName>')
    .description('initialize an akashacms site')
    .action(function(dirName){
        /*var git = exec(
                'git clone git://github.com/robogeek/akashacms-example.git' + dirName,
                {env: process.env, stdio: 'inherit'},
                function (error, stdout, stderr) {
                    console.log('stdout: ' + stdout);
                    console.log('stderr: ' + stderr);
                    if (error !== null) {
                        console.log('exec error: ' + error);
                    }
                });*/
        var git = spawn('git',
              [ 'clone', 'git://github.com/robogeek/akashacms-example.git', dirName],
              {env: process.env, stdio: 'inherit'});
    });

program
    .command('build')
    .description('build an akashacms site in the current directory')
    .action(function() {
        var config = require(process.cwd() + '/config.js');
        akasha.process(config);
    });

program
    .command('deploy')
    .description('Deploy the akashacms site using configuration file')
    .action(function() {
        var config = require(process.cwd() + '/config.js');
        if (config.deploy_rsync) {
            var user = config.deploy_rsync.user;
            var host = config.deploy_rsync.host;
            var dir  = config.deploy_rsync.dir;
            var rsync = spawn('rsync',
                    [ '--verbose', '--archive', '--delete', config.root_out+'/', user+'@'+host+':'+dir+'/' ],
                    {env: process.env, stdio: 'inherit'});
        } // else .. other kinds of deployment scenarios
    });


program
    .command('minimize')
    .description('Minimize the rendered akashacms site')
    .action(function() {
        var config = require(process.cwd() + '/config.js');
        akasha.minimize(config);
    });
    
program
    .command('serve')
    .description('start a webserver')
    .action(function() {
        var config = require(process.cwd() + '/config.js');
        var site = require(process.cwd() + '/config.js');
        var fileServer = new staticSrv.Server(site.root_out);
        http.createServer(function (request, response) {
            request.addListener('end', function () {
                fileServer.serve(request, response, function (e, res) {
                    if (e) {
                        if (e.status === 404) { // If the file wasn't found
                            fileServer.serveFile('/404.html', 404, {}, request, response);
                        }
                        else {
                            sys.error("Error serving " + request.url + " - " + e.message);
                            // Respond to the client
                            response.writeHead(e.status, e.headers);
                            response.end();
                        }
                    }
                });
            });
        }).listen(8080);
    });

// program
//    .command('*')
//    .description('deploy the given env')
//    .action(function(env){
//        console.log('deploying "%s"', env);
//    });

program.parse(process.argv);
