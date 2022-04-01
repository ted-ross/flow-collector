/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
   http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
*/

"use strict";

const http = require('http');
const URL  = require('url');
const data = require('./data.js');

const SERVER_PORT = 8010;
var server;


const traverseDepthFirst = function(record, result) {
    result.push(record.obj);
    record.children.forEach(child => {
        traverseDepthFirst(child, result);
    });
}


const parseArgs = function(text) {
    let result = {};

    if (text) {
        let pairs = text.split('&');
        pairs.forEach(pair => {
            let sides = pair.split('=');
            if (sides.length == 2) {
                result[sides[0]] = sides[1];
            }
        });
    }

    return result;
}


const onAll = function(res) {
    let records = data.GetRecords();
    let topLevel = [];

    //
    // Find all of the top-level records (that have no parent).
    //
    let topLevelIds = data.GetTopLevelIds();
    topLevelIds.forEach(id => topLevel.push(records[id]));

    //
    // Add decendents of the top-level records depth first so
    // we report parents before children.
    //
    let result = [];
    topLevel.forEach(record => {
        traverseDepthFirst(record, result);
    });

    //
    // Send the JSON representation of the result.
    //
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
}


const onVanAddrs = function(res, args) {
    let result = [];
    let vanAddrs = data.GetVanAddresses();
    for (const key of Object.keys(vanAddrs)) {
        result.push(key);
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
}


const onFlows = function(res, args) {
    let result = [];
    if (args.vanaddr) {
        let vaddr = data.GetVanAddresses()[args.vanaddr];
        if (vaddr) {
            vaddr.listenerIds.forEach(id => {
                let listener = data.GetRecords()[id];
                if (listener) {
                    result.push(listener.obj);
                    let flows = listener.children || [];
                    flows.forEach(flow => result.push(flow.obj));
                }
            });
            vaddr.connectorIds.forEach(id => {
                let connector = data.GetRecords()[id];
                if (connector) {
                    result.push(connector.obj);
                    let flows = connector.children || [];
                    flows.forEach(flow => result.push(flow.obj));
                }
            });
        }
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
}


const onLinks = function(res, args) {
    let result  = [];
    let records = data.GetRecords();

    //
    // Find all of the top-level records (that have no parent).
    //
    let linkIds = data.GetLinkIds();
    linkIds.forEach(id => result.push(records[id].obj));

    //
    // Send the JSON representation of the result.
    //
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
}


const onRequest = function(req, res) {
    let parsed = URL.parse(req.url);
    let path   = parsed.pathname;
    let args   = parseArgs(parsed.query);
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    if (path.substr(0,8) == '/api/v1/') {
        if (path.substr(8,3) == 'all') {
            onAll(res);
            return;
        } else if (path.substr(8,8) == 'vanaddrs') {
            onVanAddrs(res, args);
            return;
        } else if (path.substr(8,5) == 'flows') {
            onFlows(res, args);
            return;
        } else if (path.substring(8,13) == 'links') {
            onLinks(res, args);
            return;
        }
    }

    res.end("Invalid Request");
}


exports.Start = function() {
    return new Promise((resolve, reject) => {
        console.log('[API module starting]');
        server = http.createServer((req, res) => onRequest(req, res)).listen(SERVER_PORT);
        console.log(`API server listening on port ${SERVER_PORT}`);
        resolve();
    });
}