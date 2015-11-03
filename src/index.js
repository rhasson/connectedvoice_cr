/* Connected Voice Call Router Server */

"use strict";

import Net from 'net';
import Repl from 'repl';
import Restify from 'restify';
import Logger from './libs/logger.js';
import Helpers from './libs/route_helpers.js';

Logger.WebServerLogger.addSerializers({res: Restify.bunyan.serializers.res});
let log = Logger.WebServerLogger;

let server = Restify.createServer({
	name: 'Call Router Webserver',
	log: log
});

server.use(Restify.queryParser());
server.use(Restify.gzipResponse());
server.use(Restify.bodyParser());

/*
server.use(function(req, repl, next) {
	console.log(req.headers, req.url);
	return next();
});
*/

server.pre(function (request, reply, next) {
	request.log.info({req: request}, 'IncomingRequest');
	return next();
});

server.on('after', function (request, respose, route) {
	request.log.info({res: respose}, 'OutgoingResponse');
});

server.post('/actions/v0/:id/voice.xml', Helpers.postHandlerVoice);
server.post('/actions/v0/:id/status', Helpers.postHandlerStatus);
server.post('/actions/v0/:id/action', Helpers.postHandlerAction);
server.post('/actions/v0/:id/action/:index', Helpers.postHandlerAction);
server.post('/actions/v0/:id/dequeue', Helpers.postHandlerDequeue);
server.post('/actions/v0/:id/wait/:index', Helpers.postHandlerWait);

server.post('/actions/v0/:id/sms.xml', Helpers.postHandlerSms);

server.listen(7100, function() {
	log.info('Started Call Router API server');

	Net.createServer((socket) => {
		let replServer = Repl.start({
			prompt: "CR :> ",
			input: socket,
			output: socket,
			terminal: true
		});
		
		replServer.once('exit', () => { socket.end(); });
		
		replServer.context.server = server;
		replServer.context.call_router = Helpers._call_router;
		replServer.context.twiml_parser = Helpers._twiml_parser;
		replServer.context.db = Helpers._db;

		log.info('Started REPL for Call Router API server');

	}).listen({host: 'localhost', port: 3000});
});