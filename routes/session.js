
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

function dumpState(session) {
	var _ = require("./constants");
	
	var state = '';
	
	switch (session.State) {
	case _.STATE_UNKNOWN:
		state = 'UNKOWN';
		break;
	case _.STATE_PRIVATE_REQ:
	case _.STATE_PRIVATE_DEST:
		state = 'PRIVATE';
		break;
	case _.STATE_PUBLIC_REQ:
	case _.STATE_PUBLIC_DEST:
		state = 'PUBLIC';
		break;
	case _.STATE_UPNP_REQ:
	case _.STATE_UPNP_DEST:
		state = 'UPNP';
		break;
	case _.STATE_PUNCH_REQ:
	case _.STATE_PUNCH_DEST:
		state = 'HOLE_PUNCH';
		break;
	case _.STATE_RELAY:
		state = 'RELAY';
		break;
	}
	
	console.log('Planned session state: <' + state + '>, next step: <' + session.Step + '>');
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
	var helper = require('./helper');
	var _ = require("./constants");
	
	var session = {State: _.STATE_UNKNOWN, Step: _.STEP_UNKNOWN,
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
	
	console.log('Session negociation begin: src <' + req.params.SrcEndpointID + '> to dest <' + req.params.DestEndpointID + '>');
	
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
	var helper = require('./helper');
	var _ = require("./constants");
	var session = {State: parseInt(req.params.State), Step: _.STEP_UNKNOWN,
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
		console.warn ('Failed state:' + req.params.State + ', ErrorCode:' + req.query.ErrorCode + ', ErrorDesc:' + req.query.ErrorDesc);
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
	var _ = require("./constants");

	if (session.Rnp.UDP.Blocked || session.Dnp.UDP.Blocked) {
		session.State = _.STATE_UNKNOWN;
	} else if (session.State < _.STATE_PRIVATE_REQ &&
			session.Dnp.Location.ExtIP === session.Rnp.Location.ExtIP) {
		session.State = _.STATE_PRIVATE_REQ;
	} else if (session.State < _.STATE_PRIVATE_DEST &&
			session.Dnp.Location.ExtIP === session.Rnp.Location.ExtIP) {
		session.State = _.STATE_PRIVATE_DEST;
	} else if (session.State < _.STATE_PUBLIC_REQ &&
			session.Rnp.UDP.Public === true) {
		session.State = _.STATE_PUBLIC_REQ;
	} else if (session.State < _.STATE_PUBLIC_DEST &&
			session.Dnp.UDP.Public === true) {
		session.State = _.STATE_PUBLIC_DEST;
	} else if (session.State < _.STATE_UPNP_REQ &&
			session.Rnp.UDP.UPnP.Enabled === true) {
		session.State = _.STATE_UPNP_REQ;
	} else if (session.State < _.STATE_UPNP_DEST &&
			session.Dnp.UDP.UPnP.Enabled === true) {
		session.State = _.STATE_UPNP_DEST;
	} else if (session.State < _.STATE_PUNCH_DEST) {
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
			session.State = _.STATE_PUNCH_REQ;
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
			session.State = _.STATE_PUNCH_DEST;
			break;
		case '1111':
			session.State = _.STATE_RELAY;
			break;
		default:
			session.State = _.STATE_RELAY;
			break;
		}
	} else if (session.State < _.STATE_RELAY) {
		// relay as last straw
		session.State = _.STATE_RELAY;
	} else {
		// even relay failed, abort the session
		session.State = _.STATE_UNKNOWN;
	}
	
	// debug purpose
	dumpState(session);
} // end of getNextSessionState

/**
 * Iterate state machine to establish session 
 * 
 * @param session session object
 * @param req HTTP request 
 * @param res HTTP response 
 */
function processSessionRequest(session) {
	var _ = require("./constants");
	var clientIP;	
	if (session.req.headers['x-nginx-proxy']) {
		clientIP = session.req.headers['x-real-ip'];
	} else {
		clientIP = session.req.ip;
	}

	switch (session.State) {
	case _.STATE_PRIVATE_REQ: // in same domain, requester listen
		switch (session.Step) {
		case _.STEP_UNKNOWN:
			replyRnp(_.CMD_LISTEN_MSG, session, _.STEP_SAVE_SESSION, _.STEP_SEND_TO);
			break;
		case _.STEP_SEND_TO:
			session.res.send(202);
			session.Dest = {IP:session.Rnp.Location.LocalIP, Port:session.Rnp.Location.LocalUDPPort};
			pushDnp(_.CMD_SEND_MSG, session);
			break;
		case _.STEP_SAVE_SESSION:
			session.Dest = {IP:session.req.query.MsgSrcIP, Port:session.req.query.MsgSrcPort};
			replyRnp(_.CMD_SAVE_SESSION, session);
			session.Dest = {IP:session.Rnp.Location.LocalIP, Port:session.Rnp.Location.LocalUDPPort};
			pushDnp(_.CMD_SAVE_SESSION, session);
			break;
		default: // error
			console.error('unknown state:' + session.State + ', step:' + session.Step);
			session.res.send(400);
			break;
		}
		break;
	case _.STATE_PRIVATE_DEST: // in same domain, destination listen
		switch (session.Step) {
		case _.STEP_UNKNOWN:
			pushDnp(_.CMD_LISTEN_MSG, session, _.STEP_SAVE_SESSION, _.STEP_SEND_TO);
			break;
		case _.STEP_SEND_TO:
			session.res.send(202);
			session.Dest = {IP:session.Dnp.Location.LocalIP, Port:session.Dnp.Location.LocalUDPPort};
			pushRnp(_.CMD_SEND_MSG, session);
			break;
		case _.STEP_SAVE_SESSION:
			session.Dest = {IP:session.req.query.MsgSrcIP, Port:session.req.query.MsgSrcPort};
			replyDnp(_.CMD_SAVE_SESSION, session);
			session.Dest = {IP:session.Dnp.Location.LocalIP, Port:session.Dnp.Location.LocalUDPPort};
			pushRnp(_.CMD_SAVE_SESSION, session);
			break;
		default: // error
			console.error('unknown state:' + session.State + ', step:' + session.Step);
			session.res.send(400);
			break;
		}
		break;
	case _.STATE_PUBLIC_REQ: // Requester public accessible
		session.res.send(403, 'STATE_PUBLIC_REQ not supported yet'); // ToDo: implement later
		break;
	case _.STATE_PUBLIC_DEST: // Destination public accessible
		session.res.send(403, 'STATE_PUBLIC_DEST not supported yet'); // ToDo: implement later
		break;
	case _.STATE_UPNP_REQ: // Requester UPnP
		session.res.send(403, 'STATE_UPNP_REQ not supported yet'); // ToDo: implement later
		break;
	case _.STATE_UPNP_DEST: // Destination UPnP
		session.res.send(403, 'STATE_UPNP_DEST not supported yet'); // ToDo: implement later
		break;
	case _.STATE_PUNCH_REQ: // Favor Requestor side
		if (session.req.query.OkExtPort) {
			session.Piggyback = "&OkExtPort=" + session.req.query.OkExtPort; // OkExtPort piggyback
		}
		switch (session.Step) {
		case _.STEP_UNKNOWN:
			replyRnp(_.CMD_GET_EXT_PORT, session, _.STEP_EXT_PORT);
			break;
		case _.STEP_EXT_PORT:
			session.res.send(202);
			session.Piggyback = "&OkExtPort=" + session.req.query.ExtPort; // ExtPort is requestor's reply 
			pushDnp(_.CMD_GET_EXT_PORT, session, _.STEP_PUNCH);
			break;
		case _.STEP_PUNCH:
			session.res.send(202);
			session.Dest = {IP:clientIP, Port:session.req.query.ExtPort};
			pushRnp(_.CMD_SEND_MSG, session, _.STEP_LISTEN_AT);
			break;
		case _.STEP_LISTEN_AT:
			replyRnp(_.CMD_LISTEN_MSG, session, _.STEP_SAVE_SESSION, _.STEP_SEND_TO);
			break;
		case _.STEP_SEND_TO:
			session.res.send(202);
			session.Dest = {IP:clientIP, Port:session.req.query.OkExtPort};
			pushDnp(_.CMD_SEND_MSG, session);
			break;
		case _.STEP_SAVE_SESSION:
			session.Dest = {IP:session.req.query.MsgSrcIP, Port:session.req.query.MsgSrcPort};
			replyRnp(_.CMD_SAVE_SESSION, session);
			session.Dest = {IP:clientIP, Port:session.req.query.OkExtPort};
			pushDnp(_.CMD_SAVE_SESSION, session);
			break;
		default: // error
			console.error('unknown state:' + session.State + ', step:' + session.Step);
			session.res.send(400);
			break;
		}
		break;
	case _.STATE_PUNCH_DEST: // Favor Destination side
		if (session.req.query.OkExtPort) {
			session.Piggyback = "&OkExtPort=" + session.req.query.OkExtPort; // OkExtPort piggyback
		}
		switch (session.Step) {
		case _.STEP_UNKNOWN:
			pushDnp(_.CMD_GET_EXT_PORT, session, _.STEP_EXT_PORT);
			break;
		case _.STEP_EXT_PORT:
			session.res.send(202);
			session.Piggyback = "&OkExtPort=" + session.req.query.ExtPort; // ExtPort is requestor's reply 
			pushRnp(_.CMD_GET_EXT_PORT, session, _.STEP_PUNCH);
			break;
		case _.STEP_PUNCH:
			session.res.send(202);
			session.Dest = {IP:clientIP, Port:session.req.query.ExtPort};
			pushDnp(_.CMD_SEND_MSG, session, _.STEP_LISTEN_AT);
			break;
		case _.STEP_LISTEN_AT:
			replyDnp(_.CMD_LISTEN_MSG, session, _.STEP_SAVE_SESSION, _.STEP_SEND_TO);
			break;
		case _.STEP_SEND_TO:
			session.res.send(202);
			session.Dest = {IP:clientIP, Port:session.req.query.OkExtPort};
			pushRnp(_.CMD_SEND_MSG, session);
			break;
		case _.STEP_SAVE_SESSION:
			session.Dest = {IP:session.req.query.MsgSrcIP, Port:session.req.query.MsgSrcPort};
			replyDnp(_.CMD_SAVE_SESSION, session);
			session.Dest = {IP:clientIP, Port:session.req.query.OkExtPort};
			pushRnp(_.CMD_SAVE_SESSION, session);
			break;
		default: // error
			console.error('unknown state:' + session.State + ', step:' + session.Step);
			session.res.send(400);
			break;
		}
		break;
	case _.STATE_RELAY: // Relay
		session.res.send(403, 'Relay not supported yet'); // ToDo: implement later
		break;
	case _.STATE_UNKNOWN: // error
		session.res.send(403);
		break;
	default: // error
		session.res.send(403);
		break;
	}
} // end of processSessionRequest

function genCmd(cmd, session, target, next, ready) {
	var _ = require("./constants");
	var helper = require('./helper');
	
	// command go to Destination if no target argument assigned
	if (!target) {
		target = session.Dnp;
	}
	var source = (target === session.Dnp ? session.Rnp: session.Dnp);

	var json = {Version:1, Type:cmd, SocketType:'UDP', Nonce:session.Nonce};

	if (next) {
		json.Reply = {};
		var url = '/InMatch/UDP/' + session.State + '/' + session.Rnp.ID + '/' + session.Dnp.ID;
		var query = 'Nonce=' + session.Nonce;
		if (session.Piggyback) {
			query += session.Piggyback;
		}

		json.Reply.OK = url + '?' + query + '&Next=' + next;
		json.Reply.Error = url;

		if (ready) {
			json.Reply.Ready = url + '?' + query + '&Next=' + ready;
		}
	}

	switch (cmd) {
	case _.CMD_SEND_MSG:
		json.LocalPort = session.Dnp.Location.LocalUDPPort;
		json.Destination = session.Dest;
		json.Count = 3;
		break;
	case _.CMD_LISTEN_MSG:
		json.LocalPort = target.Location.LocalUDPPort;
		json.Timeout = 10;
		break;
	case _.CMD_MAP_UPNP:
		break;
	case _.CMD_GET_EXT_PORT:
		json.LocalPort = target.Location.LocalUDPPort;
		// 2nd port of primary server is unused, so it may be more trustable.
		json.Destination = {IP:helper.config.server[0].address, Port:helper.config.server[0].udp[1]};
		json.Count = 3;
		json.Timeout = 10;
		break;
	case _.CMD_SAVE_SESSION:
		json.LocalPort = target.Location.LocalUDPPort;
		json.Destination = session.Dest;
		break;
	default:
		break;
	}
	
	return json;
}

function replyRnp(cmd, session, next, ready) {
	console.log('Reply src side with CMD <' + cmd + '>');
	var json = genCmd(cmd, session, session.Rnp, next, ready);
	session.res.send(json);
}

function replyDnp(cmd, session, next, ready) {
	console.log('Reply dest side with CMD <' + cmd + '>');
	var json = genCmd(cmd, session, session.Dnp, next, ready);
	session.res.send(json);
}

function pushRnp(cmd, session, next, ready) {
	console.log('Push src side with CMD <' + cmd + '>');
	var json = genCmd(cmd, session, session.Rnp, next, ready);
	push(session.Rnp, json);
}

function pushDnp(cmd, session, next, ready) {
	console.log('Push dest side with CMD <' + cmd + '>');
	var json = genCmd(cmd, session, session.Dnp, next, ready);
	push(session.Dnp, json);
}

function push(target, json) {
	var http = require('http');
	var helper = require('./helper');
	
	// Make a HTTP POST request to push module
	var jsonstr = JSON.stringify(json) ;
	
	var options = {
			hostname: helper.config.server[0].address,
			port: helper.config.server[0].port,
			path: helper.config.server[0].push + target.ID,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': jsonstr.length
			}
		};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (data) {
			console.info('Nginx <' + res.statusCode + '> : ' + data);
		}); // always consume data trunk
	});
	
	req.on('error', function(e) {
		console.error('problem with request: ' + e.message);
	});
	req.write(jsonstr); // write data to request body
	req.end();
}
