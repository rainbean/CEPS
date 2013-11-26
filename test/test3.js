function addDevice(s) {
	var fs = require('fs');
	var devices = [];
	
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
	
	if (devices.indexOf(s) == -1) {
		// only store unmatched devices
		devices.push(s);
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

//addDevice('aaa');
getDevices();