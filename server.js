#!/usr/bin/env node
/**
 * This file is part of AkashaCMS (http://akashacms.com/).
 *
 *   AkashaCMS is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   AkashaCMS is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with AkashaCMS.  If not, see <http://www.gnu.org/licenses/>.
 *
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
