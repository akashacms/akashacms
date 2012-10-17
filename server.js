#!/usr/bin/env node
/**
* Simple webserver with logging. By default, serves whatever files are
* reachable from the directory where node is running.
*/
var fs = require('fs'),
antinode = require('./antinode/lib/antinode'),
sys = require('sys');

antinode.start({
    "port" : 8080,
    "default_host" : {
        "root" : "out"
    }
});
