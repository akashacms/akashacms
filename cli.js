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
var path       = require('path');
var spawn      = require('child_process').spawn;
var exec       = require('child_process').exec;
var http       = require('http');
var program    = require('commander');
var akasha     = require( './index.js' ); //'akashacms');
var request    = require('request');


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
    .command('bootstrap')
    .description('Download the Twitter Bootstrap code')
    .action(function() {
        var AdmZip = require('adm-zip');
        var data = [], dataLen = 0; 
        http.request("http://twitter.github.com/bootstrap/assets/bootstrap.zip", function(res) {
            res.on('data', function(chunk) {
                data.push(chunk);
                dataLen += chunk.length;
            });
            res.on('end', function() {
                var buf = new Buffer(dataLen);

                for (var i=0, len = data.length, pos = 0; i < len; i++) { 
                    data[i].copy(buf, pos); 
                    pos += data[i].length; 
                }
    
                var zip = new AdmZip(buf);
                zip.extractAllTo("bootstrap-from-request", true);
                //var zipEntries = zip.getEntries();
                //util.log(util.inspect(zipEntries));
            });
        }).end();
    });

program
    .command('build')
    .description('build an akashacms site in the current directory')
    .action(function() {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.process(config, function(err) {
            if (err) throw new Error(err);
        });
    });

program
    .command('render <fileName>')
    .description('render a file into the output directory')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.renderFile(config, fileName, function(err) {
            if (err) throw err;
        });
    });

program
    .command('deploy')
    .description('Deploy the akashacms site using configuration file')
    .action(function() {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        if (config.deploy_ssh2sync) {
            var ssh2sync = require('ssh2sync');
            ssh2sync.upload(config.root_out,
                            config.deploy_ssh2sync.root_remote,
                            config.deploy_ssh2sync.force,
                            config.deploy_ssh2sync.auth);
        }
        else if (config.deploy_rsync) {
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
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.minimize(config);
    });
    
program
    .command('serve')
    .description('start a webserver')
    .action(function() {
        var staticSrv  = require('node-static');
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        var fileServer = new staticSrv.Server(config.root_out);
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
    
program
    .command('fixup <fileName>')
    .description('Fix various unwanted characters')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        
        var entry = akasha.getFileEntry(config, fileName);
        var text = fs.readFileSync(entry.fullpath, "utf-8");
        fs.writeFileSync(entry.fullpath+'-new',
            text.replace('\320', '--'),
            "utf-8");
        
    });
    
program
    .command('config')
    .description('Show configuration parameters of the current site')
    .action(function() {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        
        console.log('dirname: '+ process.cwd());
        console.log('output directory: '+ config.root_out);
        console.log('');
        console.log('documents directories:');
        for (var i = 0; i < config.root_docs.length; i++) {
            console.log('\t'+ config.root_docs[i]);
        }
        console.log('');
        console.log('assets directories:');
        for (var i = 0; i < config.root_assets.length; i++) {
            console.log('\t'+ config.root_assets[i]);
        }
        console.log('');
        console.log('partials directories:');
        for (var i = 0; i < config.root_partials.length; i++) {
            console.log('\t'+ config.root_partials[i]);
        }
        console.log('');
        console.log('layouts directories:');
        for (var i = 0; i < config.root_layouts.length; i++) {
            console.log('\t'+ config.root_layouts[i]);
        }
        console.log('');
        console.log('plugins:');
        for (var i = 0; i < config.plugins.length; i++) {
            console.log('\t'+ config.plugins[i]);
        }
        console.log('');
        console.log('data: '+ util.inspect(config.data));
    });

// program
//    .command('*')
//    .description('deploy the given env')
//    .action(function(env){
//        console.log('deploying "%s"', env);
//    });

program.parse(process.argv);
