
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
	fs.exists('../db/devices.json', function (exists) {
		if (!exists) {
			return [];
		}
		res.sendfile('../db/devices.json');
	});
};

/*
 * Add user's device in JSON format
 */
exports.addDevice = function(req, res) {
	var fs = require('fs');
	var devices = JSON.parse(fs.readFileSync('../db/devices.json'));
	if (typeof(devices) === 'undefined' || devices === null) {
		devices = [];
	}
	devices.push(req.params.device);
	fs.writeFile('../db/devices.json', JSON.stringify(devices));
};


/*
 * GET device network profile in JSON format
 * 
 * /v1/NetworkProfile/{EndpointID}/{NetworkID}
 */
exports.getNetworkProfile = function(req, res) {
	var path = '../db/1000/' + req.params.EndpointID + '_' + req.params.NetworkID;
	res.sendfile(path);
};

/*
 * SET device network profile in JSON format
 */
exports.setNetworkProfile = function(req, res) {
	var fs = require('fs');

	//console.log (req.body);
	//var user = JSON.parse(req.body);
	var profile = req.body;
	var path = '../db/1000/' + req.params.EndpointID + '_' + req.params.NetworkID;
	fs.writeFile(path, profile);
};