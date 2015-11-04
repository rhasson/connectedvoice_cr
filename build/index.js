/* Connected Voice Call Router Server */

"use strict";

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _repl = require('repl');

var _repl2 = _interopRequireDefault(_repl);

var _restify = require('restify');

var _restify2 = _interopRequireDefault(_restify);

var _libsLoggerJs = require('./libs/logger.js');

var _libsLoggerJs2 = _interopRequireDefault(_libsLoggerJs);

var _libsRoute_helpersJs = require('./libs/route_helpers.js');

var _libsRoute_helpersJs2 = _interopRequireDefault(_libsRoute_helpersJs);

_libsLoggerJs2['default'].WebServerLogger.addSerializers({ res: _restify2['default'].bunyan.serializers.res });
var log = _libsLoggerJs2['default'].WebServerLogger;

var server = _restify2['default'].createServer({
	name: 'Call Router Webserver',
	log: log
});

server.use(_restify2['default'].queryParser());
server.use(_restify2['default'].gzipResponse());
server.use(_restify2['default'].bodyParser());

/*
server.use(function(req, repl, next) {
	console.log(req.headers, req.url);
	return next();
});
*/

server.pre(function (request, reply, next) {
	request.log.info({ req: request }, 'IncomingRequest');
	return next();
});

server.on('after', function (request, respose, route) {
	request.log.info({ res: respose }, 'OutgoingResponse');
});

server.post('/actions/v0/:id/voice.xml', _libsRoute_helpersJs2['default'].postHandlerVoice);
server.post('/actions/v0/:id/status', _libsRoute_helpersJs2['default'].postHandlerStatus);
server.post('/actions/v0/:id/action', _libsRoute_helpersJs2['default'].postHandlerAction);
server.post('/actions/v0/:id/action/:index', _libsRoute_helpersJs2['default'].postHandlerAction);
server.post('/actions/v0/:id/dequeue', _libsRoute_helpersJs2['default'].postHandlerDequeue);
server.post('/actions/v0/:id/wait/:index', _libsRoute_helpersJs2['default'].postHandlerWait);

server.post('/actions/v0/:id/sms.xml', _libsRoute_helpersJs2['default'].postHandlerSms);

server.listen(7100, function () {
	log.info('Started Call Router API server');

	_net2['default'].createServer(function (socket) {
		var replServer = _repl2['default'].start({
			prompt: "CR :> ",
			input: socket,
			output: socket,
			terminal: true
		});

		replServer.once('exit', function () {
			socket.end();
		});

		replServer.context.server = server;
		replServer.context.call_router = _libsRoute_helpersJs2['default']._call_router;
		replServer.context.twiml_parser = _libsRoute_helpersJs2['default']._twiml_parser;
		replServer.context.db = _libsRoute_helpersJs2['default']._db;

		log.info('Started REPL for Call Router API server');
	}).listen({ host: '127.0.0.1', port: 3000 });
});