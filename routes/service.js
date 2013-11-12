/*
 * Exchange the server information data. (Connection Management Server).
 */

exports.list = function(req, res) {
	var services = {
			Version: 1,
			Type: 'ServerInfo',
			cms: [
		        {Host: "ceps.cloudapp.net", Port:  [23400,23401,23402]},
		        {Host: "ceps2.cloudapp.net", Port: [23400,23401,23402]}
		        ],
	        requestor: {IP: req.ip}
	};
	res.send(services);
};

/*
 * Endpoint will issue this command. Upon received this message, receiver shall send a socket type message of “RepSendMsg” to specific address and specified port, assigned by “DestIP” and “DestPort”, from specific local port, as value of “SrcPort” field, N times continuously, as value of Count field. Server shall fill the Nonce data field with the value specified in this message command
 * 
 * GET /v1/Message/{SocketType}?Nonce={Nonce}&SrcPort={SrcPort}&DestIP={DestIP}&DestPort={DestPort}&Count={Count}
 */

exports.sendMessage = function(req, res) {
	var constant = require("./constants");
	
	if (req.params.SockType === 'UDP') {
		var dgram = require('dgram');
		var msg = new Buffer(constant.LEN_REQ_SEND_MSG); 
		
		msg.fill(0x00); // clear with zero 
		msg.writeUInt32BE(constant.CEPS_MAGIC_CODE, 0);  // magic code
		msg.writeUInt8(1, 4); // version
		msg.writeUInt16BE(constant.REQ_SEND_MSG, 5); // msg type
		msg.writeUInt16BE(0x0000, 7); // msg length
		msg.write(req.query.Nonce, 9, 16); // msg type
		
		// return status code before execute UDP message
		res.send(202);
		
		var client = dgram.createSocket("udp4");
		client.bind(req.query.SrcPort, function() {			
			var count = req.query.Count;
			if (typeof(count) === 'undefined' || count === null 
					|| count <= 0 || count >= 20)
				count = 1; // reset to once
			
			var done = count;
			for (var i=0; i<count; ++i) {
				client.send(msg, 0, msg.length, req.query.DestPort, req.query.DestIP, function(err, bytes) {
					done --;
					if (done === 0)
						client.close();
				});
			}
		});
	} else if (req.params.SockType === 'TCP') {
		/**
		 * ToDo: implement TCP
		 */
		return res.send(501, 'TCP not implemented');
	} else {
		return res.send(400, 'malformed syntax\n');
	}
};