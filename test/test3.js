function addDevice(EndpointName, EndpointID) {
	var fs = require('fs');
	var devices = [];
	var dev = {id: EndpointID, name: EndpointName};
	
	// interesting myth of current path 
	try {
		if (fs.existsSync('../db/devices.json')) {
			devices = require('../db/devices.json');
		}
	} catch (err) {
		// err in parse the file, reset it
		console.log(err);
		devices = [];
	}
	
	//if (devices.indexOf(dev) == -1) {
	if (devices.map(function(o) { return o.id; }).indexOf(dev.id) === -1) {
		// only store unmatched devices
		devices.push(dev);
		fs.writeFile('../db/devices.json', JSON.stringify(devices));		
	}
	console.log(devices);
}

function getDevices() {
	var fs = require('fs');
	//fs.mkdir('../db/profile', function(err) {
		fs.readdir('../db/profile', function(err, files) {
			console.log(files);
		});
	//});
}

addDevice('b', '323423123');
//getDevices();
