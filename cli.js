#!/usr/bin/env node

/**
 *
 * Copyright 2012-2015 David Herron
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
    .description('initialize an AkashaCMS site')
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
              [ 'clone', 'git://github.com/akashacms/akashacms-example.git', dirName],
              {env: process.env, stdio: 'inherit'});
    });

program
    .command('build')
    .description('build an AkashaCMS site in the current directory')
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
		akasha.gatherDir(config, config.root_docs, function(err, data) {
			if (err) throw err;
			else {
				akasha.renderFile(config, fileName, function(err) {
					if (err) throw err;
				});
			}
		});
    });

program
    .command('ping')
    .description('Ping search engines for sitemap submission')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.pingXmlSitemap(config, function(err) {
            if (err) throw err;
        });
    });
	


program
    .command('oembed <url>')
    .description('fetch and display oEmbed data for a given URL')
    .action(function(url) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.oEmbedData(url, function(err, result) {
            if (err) throw err;
			else util.log(util.inspect(result));
        });
    });

program
    .command('metadata <fileName>')
    .description('Print the metadata for a document')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.readDocumentEntry(config, fileName, function(err, docEntry) {
        	if (err) {
        		util.log(err);
        	} else {
        		util.log(util.inspect(docEntry.frontmatter.yaml));
        	}
        });
        
    });

program
    .command('findtemplate <fileName>')
    .description('find a template')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.findTemplateAsync(config, fileName, function(err, info) {
        	if (err) util.log(err);
        	else util.log(util.inspect(info));
        });
    });

program
    .command('findpartial <fileName>')
    .description('find a partial')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.findPartialAsync(config, fileName, function(err, info) {
        	if (err) util.log(err);
        	else util.log(util.inspect(info));
        });
    });

program
    .command('finddocument <fileName>')
    .description('find a document')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.findDocumentAsync(config, fileName, function(err, info) {
        	if (err) util.log(err);
        	else util.log(util.inspect(info));
        });
    });

program
    .command('findasset <fileName>')
    .description('find an asset')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.findAssetAsync(config, fileName, function(err, info) {
        	if (err) util.log(err);
        	else util.log(util.inspect(info));
        });
    });

program
    .command('deploy')
    .description('Deploy the akashacms site using configuration file')
    // .option('-f, --force', 'force')
    .action(function(options) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        var logger = akasha.getLogger('deploy');
        if (config.deploy_ssh2sync) {
            var ssh2sync = require('ssh2sync');
            ssh2sync.upload(config.root_out,
                            config.deploy_ssh2sync.root_remote,
                            config.deploy_ssh2sync.force,
                            config.deploy_ssh2sync.auth);
        }
        else if (config.deploy_rsync) {
        	var rsync = akasha.deployViaRsync(config);
        	rsync.stdout.on('data', function(data) {
        		logger.info(data.toString());
        	});
        	rsync.stderr.on('data', function(data) {
        		logger.info('ERROR '+ data.toString());
        	});
        	rsync.on('close', function(code) {
        		logger.info('RSYNC FINISHED with code='+ code);
        	});
        } // else .. other kinds of deployment scenarios
    });
    
program
    .command('serve')
    .description('start the editing server')
    .action(function() {
        // var staticSrv  = require('node-static');
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
		akasha.gatherDir(config, config.root_docs, function(err, data) {
			if (err) {
				util.log('ERROR '+ err);
			} else {
				require('./server/app')(akasha, config);
			}
		});
    });
    
program
    .command('preview')
    .description('simple preview of built site')
    .action(function() {
        // var staticSrv  = require('node-static');
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.runPreviewServer(config);
    });
    
program
    .command('fixup <fileName>')
    .description('Fix various unwanted characters')
    .action(function(fileName) {
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
        akasha.readDocumentEntry(config, fileName, function(err, entry) {
        	if (err) throw err;
        	else {        	
				var text = fs.readFileSync(entry.fullpath, "utf-8");
				fs.writeFileSync(entry.fullpath+'-new',
					text.replace('\320', '--'),
					"utf-8");
            }
        });
        
    });

program
	.command('indexChain <fileName>')
	.description("List the chain of index.html's for a file")
	.action(function(fileName) {
	
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
		akasha.gatherDir(config, config.root_docs, function(err, data) {
			if (err) {
				util.log('ERROR '+ err);
			} else {
        		var chain = akasha.indexChain(config, fileName);
        		util.log(util.inspect(chain));
        	}
        });
	});

program
    .command('listfiles')
    .description('List the files in this site')
    .action(function() {
	
        var config = require(path.join(process.cwd(), '/config.js'));
        akasha.config(config);
		akasha.gatherDir(config, config.root_docs, function(err, data) {
			if (err) {
				util.log('ERROR '+ err);
			} else {
				akasha.eachDocument(config, function(entry) {
					util.log(entry.fullpath);
				});
			}
		});
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
            console.log('\t'+ config.plugins[i].name);
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
