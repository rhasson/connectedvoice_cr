/* Connected Voice Call Router Server */

"use strict";

import Net from 'net';
import Repl from 'repl';
import Restify from 'restify';
import Helpers from './libs/route_helpers.js';

let server = Restify.createServer();

server.use(Restify.queryParser());
server.use(Restify.gzipResponse());
server.use(Restify.bodyParser());

/*	
server.use(function(req, repl, next) {
	console.log(req.headers, req.url);
	return next();
});
*/

server.post('/actions/v0/:id/voice.xml', Helpers.postHandlerVoice);
server.post('/actions/v0/:id/status', Helpers.postHandlerStatus);
server.post('/actions/v0/:id/action', Helpers.postHandlerAction);
server.post('/actions/v0/:id/action/:index', Helpers.postHandlerAction);
server.post('/actions/v0/:id/dequeue', Helpers.postHandlerDequeue);
server.post('/actions/v0/:id/wait/:index', Helpers.postHandlerWait);

server.post('/actions/v0/:id/sms.xml', Helpers.postHandlerSms);

server.listen(7100, function() {
	console.log('Started Call Router API server ', new Date());

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

	}).listen({host: 'localhost', port: 3000});
});