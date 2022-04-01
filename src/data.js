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

const record = require('./record.js');

class VanAddress {
    constructor(vaddr) {
        this._address      = vaddr;
        this._listenerIds  = [];
        this._connectorIds = [];

        vanAddresses[vaddr] = this;
    }

    addListenerId(id) {
        this._listenerIds.push(id);
    }

    addConnectorId(id) {
        this._connectorIds.push(id);
    }

    get listenerIds() {
        return this._listenerIds;
    }

    get connectorIds() {
        return this._connectorIds;
    }

    get obj() {
        let object = {};
        object.rtype = 'VAN_ADDRESS';
        object.id = this._address;
        object.listenerCount = this._listenerIds.length;
        object.connectorCount = this._connectorIds.length;
        return object;
    }
}

class Record {
    constructor(rtype, id, rec) {
        this._rtype       = rtype;
        this._id          = id;
        this._record      = rec;
        this._children    = [];
        this._peerId      = undefined;

        if (this.parent) {
            records[this.parent].addChild(this.id);
        } else {
            topLevelIds.push(this._id);
        }

        idsByType[this._rtype].push(this._id);

        this._linkPeer();

        if (this._rtype == "LISTENER" || this._rtype == "CONNECTOR") {
            this._newVanAddress();
        }

        if (this._rtype == "LINK") {
            linkIds.push(this._id);
        }
    }

    get id() {
        return this._id;
    }

    get parent() {
        return this._record[record.PARENT_INDEX];
    }

    get children() {
        let childObjects = [];
        this._children.forEach(childId => {
            childObjects.push(records[childId]);
        });
        return childObjects;
    }

    get counterflow() {
        return this._record[record.COUNTERFLOW_INDEX];
    }

    get obj() {
        let object = this._record;
        object.rtype = this._rtype;
        object.id    = this.id;
        return object;
    }

    _linkPeer() {
        let peerId = this.counterflow;
        if (peerId) {
            let peerRecord = records[peerId];
            if (peerRecord) {
                this._peerId = peerId;
                let update = {};
                update[record.COUNTERFLOW_INDEX] = this._id;
                peerRecord.update(update);
            }
        }
    }

    _newVanAddress() {
        let addr = this._record[record.VAN_ADDRESS_INDEX];
        if (addr) {
            let vanAddr = vanAddresses[addr];
            if (vanAddr == undefined) {
                vanAddr = new VanAddress(addr);
            }

            if (this._rtype == "LISTENER") {
                vanAddr.addListenerId(this._id);
            } else {
                vanAddr.addConnectorId(this._id);
            }
        }
    }

    addChild(childId) {
        this._children.push(childId);
    }

    update(rec) {
        let prevParent = this.parent;
        let checkPeer  = false;
        
        for (const [key, value] of Object.entries(rec)) {
            this._record[key] = value;
            if (key == record.COUNTERFLOW_INDEX) {
                checkPeer = true;
            }
        }
        
        if (!prevParent && this.parent) {
            records[this.parent].addChild(this.id);
            topLevelIds.pop(this.id);
        }

        if (checkPeer && !this._peerId) {
            this._linkPeer();
        }
    }
}

//
// records - All accumulated records keyed by their identities.
//
var records = {};

//
// topLevelIds - Identities of records for which there is no parent.
//
var topLevelIds = [];

//
// linkIds - Identities of router link records
//
var linkIds = [];

//
// idsByType - Identities of records keyed by record type.
//
var idsByType = {
    'SITE'       : [],
    'ROUTER'     : [],
    'LINK'       : [],
    'CONTROLLER' : [],
    'LISTENER'   : [],
    'CONNECTOR'  : [],
    'FLOW'       : [],
    'PROCESS'    : [],
    'INGRESS'    : [],
    'EGRESS'     : [],
};

//
// vanAddresses - { vanAddress => [ [listenerIds], [connectorIds] ]}
//
var vanAddresses = {};


exports.IncomingRecord = function(rtype, id, record) {
    if (!records[id]) {
        records[id] = new Record(rtype, id, record);
    } else {
        records[id].update(record);
    }
}

exports.GetRecords = function() {
    return records;
}

exports.GetTopLevelIds = function() {
    return topLevelIds;
}

exports.GetLinkIds = function() {
    return linkIds;
}

exports.GetIdByType = function(type) {
    return idsByType[type];
}

exports.GetVanAddresses = function() {
    return vanAddresses;
}