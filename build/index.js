"use strict";

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _restify = require('restify');

var _restify2 = _interopRequireDefault(_restify);

var _libsRoute_helpersJs = require('./libs/route_helpers.js');

var _libsRoute_helpersJs2 = _interopRequireDefault(_libsRoute_helpersJs);

var server = _restify2['default'].createServer();

server.use(_restify2['default'].queryParser());
server.use(_restify2['default'].gzipResponse());
server.use(_restify2['default'].bodyParser());

/*	
server.use(function(req, repl, next) {
	console.log(req.headers, req.url);
	return next();
});
*/

server.post('/actions/v0/:id/voice.xml', _libsRoute_helpersJs2['default'].postHandlerVoice);
server.post('/actions/v0/:id/status', _libsRoute_helpersJs2['default'].postHandlerStatus);
server.post('/actions/v0/:id/action', _libsRoute_helpersJs2['default'].postHandlerAction);
server.post('/actions/v0/:id/action/:index', _libsRoute_helpersJs2['default'].postHandlerAction);
server.post('/actions/v0/:id/dequeue', _libsRoute_helpersJs2['default'].postHandlerDequeue);
server.post('/actions/v0/:id/wait/:index', _libsRoute_helpersJs2['default'].postHandlerWait);

server.post('/actions/v0/:id/sms.xml', _libsRoute_helpersJs2['default'].postHandlerSms);

server.listen(8000, function () {
	console.log('Started Call Router API server ', new Date());
});