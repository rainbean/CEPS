
/*
 * GET users listing.
 */

exports.list = function(req, res) {
	/**
	 * ToDo: add users database code
	 */
	var users = [{id: 1000, name: 'test'}];
	res.send(users);
};

/*
 * GET user's devices in JSON format
 */
exports.getDevice = function(req, res) {
	var fs = require('fs');
	fs.exists('./db/devices.json', function (exists) {
		if (!exists) {
			return [];
		}
		res.sendfile('./db/devices.json');
	});
};

/*
 * Add user's device in JSON format
 */
exports.addDevice = function(req, res) {
	var fs = require('fs');
	var devices = [];
	
	// interesting myth of current path 
	try {
		if (fs.existsSync('./db/devices.json')) {
			devices = require('../db/devices.json');
		}
	} catch (err) {
		// err in parse the file, reset it
		console.log(err);
		devices = [];
	}
	
	if (devices.indexOf(req.params.device) === -1) {
		// only store unmatched devices
		devices.push(req.params.device);
		fs.writeFile('./db/devices.json', JSON.stringify(devices));
	}
	console.log(devices);
	res.send(202);
};


/*
 * GET device network profile in JSON format
 * 
 * /v1/NetworkProfile/{EndpointID}/{NetworkID}
 */
exports.getNetworkProfile = function(req, res) {
	var path = './db/profile/' + req.params.EndpointID;// + '_' + req.params.NetworkID;
	res.sendfile(path);
};

/*
 * SET device network profile in JSON format
 */
exports.setNetworkProfile = function(req, res) {
	var fs = require('fs');

	var profile = req.body;
	var path = './db/profile/' + req.params.EndpointID;// + '_' + req.params.NetworkID;
	fs.writeFile(path, JSON.stringify(profile));
	res.send(202);
};
