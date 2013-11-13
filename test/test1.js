var PORT = 4000;
var HOST = '127.0.0.1';

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

function dec2hex(i) {
   return (i+0x10000).toString(16).substr(-4).toUpperCase();
}

server.on('message', onMsg);

//server.on('message', function (message, remote) {
function onMsg (message, remote) {
    console.log(remote.address + ':' + remote.port +' - ' + message.length);
var nonce = message.toString('utf8', 9, 25);
console.log(nonce);
/*
	for (var i=0; i<message.length; i++) {
		var num = 0 + message[i];
		console.log(i + ' <= ' + dec2hex(num));
	}
*/
}

server.bind(PORT, HOST);
