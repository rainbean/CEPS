
/**
 * Convert hex string to bytes array
 */
function toBytes(str) {
	var bytes = new Buffer(str.length / 2);
	for (var i = 0; i < str.length; i += 2) {
		bytes[i/2] = parseInt(str.substr(i, 2), 16);
	}
	return bytes;
}

/**
 * Convert hex string to bytes array
 */
function toString(bytes) {
	var hex = [];
	for (var i=0; i<bytes.length; i++) {
		// var b = bytes[i].toString(16); // without zero padding
		var b = ('00'+bytes[i].toString(16)).substr(-2,2); // with zero padding
		hex.push(b);
	}
	return hex.join('');
}

/**
 * Handle UDP message request
 * 
 * @param msg Received UDP message 
 * @param remote Remote peer address 
 */
function onMessage(msg, remote) {
	var http = require('http');
	var S = require('string');
	var constant = require("./constants");

	console.log(remote.address + ':' + remote.port +' - ' + msg.length);
	//console.log(msg);
    
	if (msg.length < constant.LEN_MIN_CEPS_MSG) {
		return; // drop message silently
	}
    
	if (constant.CEPS_MAGIC_CODE !== msg.readUInt32BE(0)) {
		return; // invalid magic code
	}
	if (1 !== msg.readUInt8(4)) {
		return; // verify version
	}
	
	var cmd = msg.readUInt16BE(5); // msg type
	var len = msg.readUInt16BE(7); // msg length
	
	//var nonce = msg.toString('utf8', 9, constant.LEN_MIN_CEPS_MSG); // msg nonce
	var bytes = new Buffer(16);
	msg.copy(bytes, 0, 9, constant.LEN_MIN_CEPS_MSG); // msg nonce
	var nonce = toString(bytes);
	nonce = S(nonce).replaceAll('\u0000', '').trim().s; // remove null or white space
	
	if (constant.REQ_GET_EXT_PORT !== cmd) {
		return; // unsupported command
	}

	if (len !== 16) {
		return; // invalid data length
	}

	// var eid = msg.toString('utf8', constant.LEN_MIN_CEPS_MSG, constant.LEN_REQ_GET_EXT_PORT);
	var bytes2 = new Buffer(len);
	msg.copy(bytes2, 0, constant.LEN_MIN_CEPS_MSG, constant.LEN_MIN_CEPS_MSG+len); // msg eid
	var eid = toString(bytes2);
	eid = S(eid).replaceAll('\u0000', '').trim().s; // remove null or white space
	
	// Make a HTTP POST request to push module	
	var data = {Version: 1, Type: "RepGetExtPort", Nonce: nonce, Port: remote.port};
	var datastr = JSON.stringify(data) ;
	//console.log(datastr);
	
	var options = {
			hostname: 'ceps.cloudapp.net', // ToDo: change to real push module FQDN
			port: 80,
			path: '/pub?id=' + eid,
			method: 'POST',
		};
	
	var req = http.request(options);
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});
	req.write(datastr); // write data to request body
	req.end();
}

/**
 * Create UDP daemon to listen for UDP request 
 */
exports.listen = function() {
	var dgram = require('dgram');
	var udpd = dgram.createSocket('udp4');
	
	udpd.on('listening', function () {
		var address = udpd.address();
		console.log('UDP Server listening on ' + address.address + ":" + address.port);
	});
	
	udpd.on('message', onMessage);

	// udpd.bind(23400, '127.0.0.1'); // bind loopback interface
	udpd.bind(23400); // bind all interface
};


/**
 * Exchange the server information data. (Connection Management Server).
 * 
 * GET /v1/ServerInfo
 */
exports.list = function(req, res) {
	var client_ip;
	//console.log(req.headers);
	//console.log(req.headers['x-nginx-proxy']);
	//console.log(req.headers['x-real-ip']);
	if (req.headers['x-nginx-proxy']) {
		client_ip = req.headers['x-real-ip'];
	} else {
		client_ip = req.ip;
	}
	var services = {
		Version: 1,
		Type: 'ServerInfo',
		cms:[ {Host: "ceps.cloudapp.net", Port: [23400]}, {Host: "ceps2.cloudapp.net", Port: [23400]}],
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
	
	// check required parameters
	if (req.query.DestPort === null || req.query.DestIP === null ||
			req.query.Nonce === null || req.query.SrcPort === null) {
		return res.send(400);
	}
	
	if (req.params.SockType === 'UDP') {
		var dgram = require('dgram');
		var msg = new Buffer(constant.LEN_REP_SEND_MSG);
		
		msg.fill(0x00); // clear with zero 
		msg.writeUInt32BE(constant.CEPS_MAGIC_CODE, 0);  // magic code
		msg.writeUInt8(1, 4); // version
		msg.writeUInt16BE(constant.REP_SEND_MSG, 5); // msg type
		msg.writeUInt16BE(0x0000, 7); // msg length
		msg.write(req.query.Nonce, 9, 16); // msg nonce
		
		// return status code before execute UDP message
		res.send(202);
		
		var client = dgram.createSocket("udp4");
		client.bind(req.query.SrcPort, function() {
			var count = req.query.Count;
			if (typeof(count) === 'undefined' || count === null ||
					count <= 0 || count >= 20) {
				count = 1; // reset to once
			}
			
			var done = count;
			for (var i=0; i<count; ++i) {
				client.send(msg, 0, msg.length, req.query.DestPort, req.query.DestIP, function(err, bytes) {
					done --;
					if (done === 0) {
						client.close();
					}
				});
			}
		});
	} else if (req.params.SockType === 'TCP') {
		/**
		 * ToDo: implement TCP
		 */
		return res.send(501, 'TCP not implemented');
	} else {
		return res.send(400);
	}
};