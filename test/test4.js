var w = 0;
var x = true;
var y = 1;
var z = null;

console.log ((1 & w) << 3);
console.log ((1 & x) << 2);
console.log ((1 & y) << 1);
console.log ((1 & z) << 0);

var i = ((1 & w) * 1000) | ((1 & x) * 100) | ((1 & y) * 10) | ((1 & z));
var j = 0 + 0x0110;
console.log(dec2hex(i));
console.log(j);
console.log(0x0110);
console.log (i == 0x0110);

//var k = (1 & w) + '' + (1 & x) + '' + (1 & y) + '' + (1 & z);
var k = [
	1 & w,
	1 & x,
	1 & y,
	1 & z
].join();
console.log(k);
switch (k) {
case '0110': 
	console.log(true);
	break;
default:
	console.log(false);
	break;
}

function dec2hex(i) {
   return (i+0x10000).toString(16).substr(-4).toUpperCase();
}
