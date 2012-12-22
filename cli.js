#!/usr/bin/env node

// akasha init dirName -- initialize new directory
// akasha build
// akasha serve

var util    = require('util');
var program = require('commander');

var http = require('http');
var staticSrv = require('node-static');

var runStaticServer = function(docroot) {
    var fileServer = new staticSrv.Server(docroot);
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
}


program
   .version('0.0.1')
//   .option('-C, --chdir <path>', 'change the working directory')
//   .option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
//   .option('-T, --no-tests', 'ignore test hook')

program
    .command('init <dirName>')
    .description('initialize a akashacms site')
    .action(function(dirName){
        util.log('init ' + dirName);
    });

program
    .command('build')
    .description('build an akashacms site in the current directory')
    .action(function(){
        util.log('build ');
    });

program
    .command('serve')
    .description('start a webserver')
    .action(function(){
        util.log('serve ');
        // XXX Need to parameterize the directory
        runStaticServer('../akashacms-example/out');
    });

// program
//    .command('*')
//    .description('deploy the given env')
//    .action(function(env){
//        console.log('deploying "%s"', env);
//    });

program.parse(process.argv);

