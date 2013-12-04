
/**
 * Get network profile from database
 * @param eid endpoint id
 * @return json object or null
 */
function getNetworkProfile(eid) {
	var fs = require('fs');
	
	// check existance of endpoint network profile
	if (!fs.existsSync('./db/profile/' + eid + '.json')) {
		return null;
	} else {
		var json = require('../db/profile/' + eid + '.json');
		json.ID = eid;
		return json;
	}
}

/**
 * Request Connection to Peer Endpoint. 
 * 
 * Upon received this message, receiver shall send a socket type message of "RepSendMsg" 
 * to specific address and specified port, assigned by "DestIP" and "DestPort", 
 * from specific local port, as value of "SrcPort" field, N times continuously, 
 * as value of Count field. 
 * 
 * Server shall fill the Nonce data field with the value specified in this message 
 * command.
 * 
 * GET /v1/SessionProfile/{SocketType}/{Requestor's EndpointID}/{Destination's EndpointID}
 * 
 * @returns 200 Request accepted. Server may reply commands in the HTTP response.
 * @returns 202 Request accepted. Server may reply command through push channel
 * @returns 400 The request could not be understood by the server due to malformed syntax. The endpoint SHOULD NOT repeat the request without modifications. 
 * @returns 401 Server may also raise the error when requested device is located, but requester does not provide valid endpoint id nor register network profile.
 * @returns 403 The server cannot fulfill this request method to build session profile for two peer sides.
 * @returns 404 The server has not found anything matching the requested device. The peer endpoint may reside temporarily under a different location.
 * @returns 500 Server internal error.
 */

exports.init = function(req, res) {
	var helper = require('./helper.js');
	var constant = require("./constants");
	
	var session = {State: constant.STATE_UNKNOWN, Step: constant.STEP_UNKNOWN,
			Rnp: {}, Dnp: {}, Nonce: '', req: req, res: res};
	
	if (req.params.SocketType !== 'UDP' ||
		!req.params.SrcEndpointID || !req.params.DestEndpointID) {
		return res.send(400); // invalid request
	}
	
	// check existance of DestEndpointID network profile
	session.Dnp = getNetworkProfile(req.params.DestEndpointID);
	if (!session.Dnp) {
		// ToDo: implement 404 body to support regional center
		return res.send(404);
	}

	// check existance of SrcEndpointID network profile
	session.Rnp = getNetworkProfile(req.params.SrcEndpointID);
	if (!session.Rnp) {
		return res.send(401); // invalid endpoint
	}
	
	// generate random session nonce
	session.Nonce = helper.createGUID();
	
	// decide state machine model
	getNextSessionState(session);
	
	// execute state machine
	processSessionRequest(session);
}; // end of init

/**
 * Request Connection to Peer Endpoint. 
 * 
 * Advance state machine of server side, in order to establish connection or report failure. 
 * 
 * Server shall fill the Nonce data field with the value specified in this message 
 * command.
 * 
 * GET /v1/InMatch/{SocketType}/{State}/{Requestor's EndpointID}/{Destination's EndpointID}
 * 
 * @returns 200 Request accepted. Server may reply commands in the HTTP response.
 * @returns 202 Request accepted. Server may reply command through push channel
 * @returns 400 The request could not be understood by the server due to malformed syntax. The endpoint SHOULD NOT repeat the request without modifications. 
 * @returns 401 Server may also raise the error when requested device is located, but requester does not provide valid endpoint id nor register network profile.
 * @returns 403 The server cannot fulfill this request method to build session profile for two peer sides.
 * @returns 404 The server has not found anything matching the requested device. The peer endpoint may reside temporarily under a different location.
 * @returns 500 Server internal error.
 */

exports.match = function(req, res) {
	var fs = require('fs');
	var helper = require('./helper.js');
	var constant = require("./constants");
	var session = {State: parseInt(req.params.State), Step: constant.STEP_UNKNOWN,
			Rnp: {}, Dnp: {}, Nonce: '', req: req, res: res};

	if (req.params.SocketType !== 'UDP' ||
		!req.params.SrcEndpointID || !req.params.DestEndpointID) {
		return res.send(400); // invalid request
	}
	
	// check existance of DestEndpointID network profile
	session.Dnp = getNetworkProfile(req.params.DestEndpointID);
	if (!session.Dnp) {
		// ToDo: implement 404 body to support regional center
		return res.send(404);
	}

	// check existance of SrcEndpointID network profile
	session.Rnp = getNetworkProfile(req.params.SrcEndpointID);
	if (!session.Rnp) {
		return res.send(401); // invalid endpoint
	}
	
	// check whether it's failed case in previous round
	if (req.query.ErrorCode) {
		console.log ('Failed state:' + req.params.State + ', ErrorCode:' + req.query.ErrorCode + ', ErrorDesc:' + req.query.ErrorDesc);
		// decide state machine model
		getNextSessionState(session);
	} else {
		session.Step = parseInt(req.query.Next);
		session.Nonce = req.query.Nonce;
	}

	// execute state machine
	processSessionRequest(session);
}; // end of match


/**
 * Get next potential state machine to establish session 
 * 
 * @param session session object  
 */
function getNextSessionState(session) {
	var constant = require("./constants");

	if (session.Rnp.UDP.Blocked || session.Dnp.UDP.Blocked) {
		session.State = constant.STATE_UNKNOWN;
	} else if (session.State < constant.STATE_PRIVATE &&
			session.Dnp.Location.ExtIP == session.Rnp.Location.ExtIP) {
		session.State = constant.STATE_PRIVATE;
	} else if (session.State < constant.STATE_PUBLIC_REQ &&
			session.Rnp.UDP.Public == true) {
		session.State = constant.STATE_PUBLIC_REQ;
	} else if (session.State < constant.STATE_PUBLIC_DEST &&
			session.Dnp.UDP.Public == true) {
		session.State = constant.STATE_PUBLIC_DEST;
	} else if (session.State < constant.STATE_UPNP_REQ &&
			session.Rnp.UDP.UPnP.Enabled == true) {
		session.State = constant.STATE_UPNP_REQ;
	} else if (session.State < constant.STATE_UPNP_DEST &&
			session.Dnp.UDP.UPnP.Enabled == true) {
		session.State = constant.STATE_UPNP_DEST;
	} else if (session.State < constant.STATE_PUNCH_DEST) {
		// else try hole punch or relay
		var pcpr = [
			1 & session.Dnp.UDP.Router.PortChange,
			1 & session.Dnp.UDP.Router.PortRestricted,
			1 & session.Rnp.UDP.Router.PortChange,
			1 & session.Rnp.UDP.Router.PortRestricted
		].join('');

		switch (pcpr) {
		case '0001':
		case '0010':
		case '0011':
		case '0110':
		case '0111':
		case '1110':
			session.State = constant.STATE_PUNCH_REQ;
			break;
		case '0000':
		case '0100':
		case '0101':
		case '1000':
		case '1010':
		case '1001':
		case '1011':
		case '1100':
		case '1101':
			session.State = constant.STATE_PUNCH_DEST;
			break;
		case '1111':
			session.State = constant.STATE_RELAY;
			break;
		default:
			session.State = constant.STATE_RELAY;
			break;
		}
	} else if (session.State < constant.STATE_RELAY) {
		// relay as last straw
		session.State = constant.STATE_RELAY;
	} else {
		// even relay failed, abort the session
		session.State = constant.STATE_UNKNOWN;
	}
} // end of getNextSessionState

/**
 * Iterate state machine to establish session 
 * 
 * @param session session object
 * @param req HTTP request 
 * @param res HTTP response 
 */
function processSessionRequest(session) {
	var constant = require("./constants");

	switch (session.State) {
	case constant.STATE_PRIVATE: // in same domain
		switch (session.Step) {
		case constant.STEP_UNKNOWN:
			reply(constant.CMD_LISTEN_MSG, session, constant.STEP_SAVE_SESSION, constant.STEP_SEND_TO);
			break;
		case constant.STEP_SEND_TO:
			session.res.send(202);
			push(constant.CMD_SEND_MSG, session);
			break;
		case constant.STEP_SAVE_SESSION:
			reply(constant.CMD_SAVE_SESSION, session);
			push(constant.CMD_SAVE_SESSION, session);
			break;
		default: // error
			console.log('unknown state:' + session.State + ', step:' + session.Step);
			session.res.send(400);
			break;
		}
		break;
	case constant.STATE_PUBLIC_REQ: // Requester public accessible
		session.res.send(403, 'STATE_PUBLIC_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUBLIC_DEST: // Destination public accessible
		session.res.send(403, 'STATE_PUBLIC_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UPNP_REQ: // Requester UPnP
		session.res.send(403, 'STATE_UPNP_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UPNP_DEST: // Destination UPnP
		session.res.send(403, 'STATE_UPNP_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUNCH_REQ: // Favor Requestor side
		session.res.send(403, 'STATE_PUNCH_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUNCH_DEST: // Favor Destination side
		session.res.send(403, 'STATE_PUNCH_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_RELAY: // Relay
		session.res.send(403, 'Relay not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UNKNOWN: // error
		session.res.send(403);
		break;
	default: // error
		session.res.send(403);
		break;
	}
} // end of processSessionRequest

function reply(cmd, session, next, ready) {
	var constant = require("./constants");

	var json = {Version:1, Type:cmd, SocketType:'UDP', Nonce:session.Nonce};

	if (next) {
		json.Reply = {};
		var url = '/InMatch/UDP/' + session.State + '/' + session.Rnp.ID + '/' + session.Dnp.ID;
		var query = [
			'Nonce=' + session.Nonce,
			'LocalPort=' + session.Rnp.Location.LocalUDPPort
		].join('&');

		json.Reply.OK = url + '?' + query + '&Next=' + next;
		json.Reply.Error = url;

		if (ready) {
			json.Reply.Ready = url + '?' + query + '&Next=' + ready;
		}
	}

	switch (cmd) {
	case constant.CMD_SEND_MSG:
		break;
	case constant.CMD_LISTEN_MSG:
		json.LocalPort = session.Rnp.Location.LocalUDPPort;
		json.Timeout = 10;
		break;
	case constant.CMD_MAP_UPNP:
	case constant.CMD_GET_EXT_PORT:
	case constant.CMD_SAVE_SESSION:
		json.LocalPort = session.Rnp.Location.LocalUDPPort;
		json.Destination = {IP:session.Dnp.Location.LocalIP, Port:session.Dnp.Location.LocalUDPPort};
		break;
	default:
		break;
	}

	session.res.send(json);
}

function push(cmd, session, next, ready) {
	var http = require('http');
	var constant = require("./constants");

	var json = {Version:1, Type:cmd, SocketType:'UDP', Nonce:session.Nonce};

	switch (cmd) {
	case constant.CMD_SEND_MSG:
		json.LocalPort = session.Dnp.Location.LocalUDPPort;
		json.Destination = {IP:session.Rnp.Location.LocalIP, Port:session.Rnp.Location.LocalUDPPort};
		json.Count = 1;
		break;
	case constant.CMD_LISTEN_MSG:
		break;
	case constant.CMD_MAP_UPNP:
	case constant.CMD_GET_EXT_PORT:
	case constant.CMD_SAVE_SESSION:
		json.LocalPort = session.Dnp.Location.LocalUDPPort;
		json.Destination = {IP:session.Rnp.Location.LocalIP, Port:session.Rnp.Location.LocalUDPPort};
		break;
	default:
		break;
	}
	
	// Make a HTTP POST request to push module
	var jsonstr = JSON.stringify(json) ;
	
	var options = {
			hostname: 'ceps.cloudapp.net', // ToDo: change to real push module FQDN
			port: 80,
			path: '/pub?id=' + session.Dnp.ID,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': jsonstr.length
			}
		};
	
	var req = http.request(options);
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});
	req.write(jsonstr); // write data to request body
	req.end();
}
