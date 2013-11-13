/**
 * New node file
 */
var constant = require("../routes/constants");

var dgram = require('dgram');
var msg = new Buffer(constant.LEN_REQ_GET_EXT_PORT); 

msg.fill(0x00); // clear with zero 
msg.writeUInt32BE(constant.CEPS_MAGIC_CODE, 0);  // magic code
msg.writeUInt8(1, 4); // version
msg.writeUInt16BE(constant.REQ_GET_EXT_PORT, 5); // msg type
msg.writeUInt16BE(16, 7); // msg length
msg.write('123456', 9, 16); // msg nonce
msg.write('test', 25, 16); // msg endpoint id

var client = dgram.createSocket("udp4");
client.send(msg, 0, msg.length, 23400, 'localhost', function(err, bytes) {
	client.close();
});