
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var service = require('./routes/service');
var session = require('./routes/session');
var http = require('http');
var path = require('path');
var log4js = require('log4js');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.compress()); // gzip
app.use(express.static(path.join(__dirname, 'public')));
log4js.replaceConsole();

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

var helper = require("./routes/helper");
helper.getConfig();

// check server setting
if (!helper.config.server) {
	console.error('Invalid server config, please modify config.json!!!');
	process.exit(1);
}

app.get('/', routes.index);
app.get('/Users', user.list);
app.get('/User/:UserID', user.getDevice);
app.post('/User/:UserID/:EndpointName/:EndpointID', user.addDevice);
app.get('/ServerInfo', service.list);
app.get('/Message/:SockType', service.sendMessage);
app.get('/NetworkProfile/:EndpointID/:NetworkID', user.getNetworkProfile);
app.post('/NetworkProfile/:EndpointID/:NetworkID', user.setNetworkProfile);
app.get('/SessionProfile/:SocketType/:SrcEndpointID/:DestEndpointID', session.init);
app.get('/InMatch/:SocketType/:State/:SrcEndpointID/:DestEndpointID', session.match);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
service.listen();
