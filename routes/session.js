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
	var fs = require('fs');
	var helper = require('./helper.js');
	var constant = require("./constants");
	var session = {state: constant.STATE_UNKNOWN, step: constant.STEP_UNKNOWN,
			rnp: {}, dnp: {}, nonce: ''};
	
	if (req.params.SrcEndpointID !== 'UDP' ||
		!req.params.SrcEndpointID || !req.params.DestEndpointID) {
		return res.send(400); // unsupported socket type
	}
	
	// check existance of endpoint network profile
	if (!fs.existsSync('./db/profile/' + req.params.DestEndpointID)) {
		// ToDo: implement 404 body to support regional center
		return res.send(404);
	} else {
		session.dnp = require('../db/profile/' + req.params.DestEndpointID);
		session.dnp.ID = req.params.DestEndpointID;
	}

	// check existance of endpoint network profile
	if (!fs.existsSync('./db/profile/' + req.params.SrcEndpointID)) {
		return res.send(401); // invalid endpoint
	} else {
		session.rnp = require('../db/profile/' + req.params.SrcEndpointID);
		session.rnp.ID = req.params.SrcEndpointID;
	}
	
	// generate random session nonce
	session.nonce = helper.createGUID();
	
	// decide state machine model
	getNextSessionState(session);
	
	// execute state machine
	processSessionRequest(session, req, res);
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
	var session = {state: constant.STATE_UNKNOWN, step: constant.STEP_UNKNOWN,
			rnp: {}, dnp: {}, nonce: ''};
	
	// decide state machine model
	getNextSessionState(session);
	
	// execute state machine
	processSessionRequest(session, req, res);
}; // end of match


/**
 * Get next potential state machine to establish session 
 * 
 * @param session session object  
 */
function getNextSessionState(session) {
	var constant = require("./constants");

	if (session.rnp.UDP.Blocked || session.dnp.UDP.Blocked) {
		session.state = constant.STATE_UNKNOWN;
	} else if (session.state < constant.STATE_PRIVATE &&
			session.dnp.Location.ExtIP == session.rnp.Location.ExtIP) {
		session.state = constant.STATE_PRIVATE;
	} else if (session.state < constant.STATE_PUBLIC_REQ &&
			session.rnp.UDP.Public == true) {
		session.state = constant.STATE_PUBLIC_REQ;
	} else if (session.state < constant.STATE_PUBLIC_DEST &&
			session.dnp.UDP.Public == true) {
		session.state = constant.STATE_PUBLIC_DEST;
	} else if (session.state < constant.STATE_UPNP_REQ &&
			session.rnp.UDP.UPnP.Enabled == true) {
		session.state = constant.STATE_UPNP_REQ;
	} else if (session.state < constant.STATE_UPNP_DEST &&
			session.dnp.UDP.UPnP.Enabled == true) {
		session.state = constant.STATE_UPNP_DEST;
	} else if (session.state < constant.STATE_PUNCH_DEST) {
		// else try hole punch or relay
		var pcpr = [
			1 & session.dnp.UDP.Router.PortChange,
			1 & session.dnp.UDP.Router.PortRestricted,
			1 & session.rnp.UDP.Router.PortChange,
			1 & session.rnp.UDP.Router.PortChange
		].join('');

		switch (pcpr) {
		case '0001':
		case '0010':
		case '0011':
		case '0110':
		case '0111':
		case '1110':
			session.state = constant.STATE_PUNCH_REQ;
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
			session.state = constant.STATE_PUNCH_DEST;
			break;
		case '1111':
			session.state = constant.STATE_RELAY;
			break;
		default:
			session.state = constant.STATE_RELAY;
			break;
		}
	} else if (session.state < constant.STATE_RELAY) {
		// relay as last straw
		session.state = constant.STATE_RELAY;
	} else {
		// even relay failed, abort the session
		session.state = constant.STATE_UNKNOWN;
	}
} // end of getNextSessionState

/**
 * Iterate state machine to establish session 
 * 
 * @param session session object
 * @param req HTTP request 
 * @param res HTTP response 
 */
function processSessionRequest(session, req, res) {
	var constant = require("./constants");

	switch (session.state) {
	case constant.STATE_PRIVATE: // in same domain
		break;
	case constant.STATE_PUBLIC_REQ: // Requester public accessible
		res.send(403, 'STATE_PUBLIC_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUBLIC_DEST: // Destination public accessible
		res.send(403, 'STATE_PUBLIC_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UPNP_REQ: // Requester UPnP
		res.send(403, 'STATE_UPNP_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UPNP_DEST: // Destination UPnP
		res.send(403, 'STATE_UPNP_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUNCH_REQ: // Favor Requestor side
		res.send(403, 'STATE_PUNCH_REQ not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_PUNCH_DEST: // Favor Destination side
		res.send(403, 'STATE_PUNCH_DEST not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_RELAY: // Relay
		res.send(403, 'Relay not supported yet'); // ToDo: implement later
		break;
	case constant.STATE_UNKNOWN: // error
		res.send(403);
		break;
	default: // error
		res.send(403);
		break;
	}
} // end of processSessionRequest
