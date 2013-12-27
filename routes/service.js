
var _expiredNonce = []; // when nonce was processed and will be discard for n seconds

/**
 * UDP message handler
 * 
 * @param msg Received UDP message in JSON 
 * @return true if message handled, false for next handler
 */
function onMessageHandler(msg) {
	var http = require('http');
	var S = require('string');
	var constant = require("./constants");
	var helper = require('./helper');

	if (constant.REQ_GET_EXT_PORT !== msg.Type) {
		return false; // unsupported command
	}
	
	if (_expiredNonce.indexOf(msg.Nonce) !== -1) {
		// found expired nonce, discard this request
		//console.debug('Ignore duplicated nonce request: ' + msg.Nonce);
		return true;
	} else {
		_expiredNonce.push(msg.Nonce);
		setTimeout(function(nonce) {
			// remove nonce from expired queue
			var i = _expiredNonce.indexOf(nonce);
			if (i !== -1) {
				_expiredNonce.splice(i, 1);
			}
		}, 20*1000, msg.Nonce); // queue as expired for 20 seconds
	}

	var eid = helper.toString(msg.Data);
	eid = S(eid).replaceAll('\u0000', '').trim().s; // remove null or white space
	
	// Make a HTTP POST request to push module
	var json = {Version: 1, Type: constant.CMD_ACK_EXT_PRT, Nonce: msg.Nonce, Port: msg.Remote.port};
	var jsonstr = JSON.stringify(json) ;
	
	var options = {
			hostname: helper.config.server[0].address,
			port: helper.config.server[0].port,
			path: helper.config.server[0].push + eid,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': jsonstr.length
			}
		};
	
	console.log('Recevied UDP <REQuest_GET_EXT_PORT>, ack back with PUSH notification');
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (data) {
			console.info('Nginx <' + res.statusCode + '> : ' + data);
		}); // always consume data trunk
	});

	req.on('error', function(e) {
		console.error('problem with PUSH: ' + e.message);
	});
	req.write(jsonstr); // write data to request body
	req.end();
	return true;
}

/**
 * Handle UDP message request
 * 
 * @param msg Received UDP message 
 * @param remote Remote peer address 
 */
function onMessage(msg, remote) {
	var S = require('string');
	var helper = require('./helper');
	
	// {Type:1, Data: [], Nonce:"Rose"}
	var json = helper.getCepsUdpMsg(msg);
	if (!json) {
		return; // invalid message
	}
	json.Remote = remote;

	// call handlers
	onMessageHandler(json);
}

function createUDPD(port) {
	var dgram = require('dgram');
	var udpd = dgram.createSocket('udp4');

	udpd.on('listening', function () {
		var address = udpd.address();
		console.log('UDP Server listening on ' + address.address + ":" + address.port);
		if (address.port !== port) {
			console.error('Failed to listen at configured UDP port, please modify config.json!!!');
			process.exit(1);
		}
	});
	
	udpd.on('message', onMessage);

	// udpd.bind(23400, '127.0.0.1'); // bind loopback interface
	udpd.bind(port); // bind all interface
}

/**
 * Create UDP daemon to listen for UDP request 
 */
exports.listen = function() {
	var helper = require('./helper');
	
	for (var i = 0; i < helper.config.server[0].udp.length; i++) {
		var port = helper.config.server[0].udp[i];
		createUDPD(port);
	}
};


/**
 * Exchange the server information data. (Connection Management Server).
 * 
 * GET /v1/ServerInfo
 */
exports.list = function(req, res) {
	var helper = require('./helper');
	
	var client_ip;
	if (req.headers['x-nginx-proxy']) {
		client_ip = req.headers['x-real-ip'];
	} else {
		client_ip = req.ip;
	}
	var services = {
		Version: 1,
		Type: 'ServerInfo',
		server: helper.config.server,
		requestor: {IP: client_ip}
	};
	res.send(services);
};

/**
 * Endpoint will issue this command. 
 * 
 * Upon received this message, receiver shall send a socket type message of "RepSendMsg" 
 * to specific address and specified port, assigned by "DestIP" and "DestPort", 
 * from specific local port, as value of "SrcPort" field, N times continuously, 
 * as value of Count field. 
 * 
 * Server shall fill the Nonce data field with the value specified in this message 
 * command.
 * 
 * GET /v1/Message/{SocketType}?Nonce={Nonce}&SrcPort={SrcPort}&DestIP={DestIP}&DestPort={DestPort}&Count={Count}
 */
exports.sendMessage = function(req, res) {
	var constant = require("./constants");
	var helper = require('./helper');
	
	// check required parameters
	if (req.query.DestPort === null || req.query.DestIP === null ||
			req.query.Nonce === null || req.query.SrcPort === null) {
		return res.send(400);
	}
	
	if (req.params.SockType === 'UDP') {
		var msg = {
				Type: constant.REP_SEND_MSG,
				LocalPort: req.query.SrcPort,
				Destination: {
					IP: req.query.DestIP,
					Port: req.query.DestPort
				},
				Nonce: req.query.Nonce,
				Count: req.query.Count
			};
		//console.log(msg);

		// return status code before execute UDP message
		res.send(202);
		helper.sendCepsUdpMsg(msg);
	} else if (req.params.SockType === 'TCP') {
		/**
		 * ToDo: implement TCP
		 */
		return res.send(501, 'TCP not implemented');
	} else {
		return res.send(400);
	}
};