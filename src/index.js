"use strict";

import Restify from 'restify';
import Helpers from './libs/route_helpers.js';

let server = Restify.createServer();

server.use(restify.queryParser());
server.use(restify.gzipResponse());
server.use(restify.bodyParser());

/*	
server.use(function(req, repl, next) {
	console.log(req.headers, req.url);
	return next();
});
*/

server.post('/actions/v0/:id/voice.xml', postHandlerVoice);
server.post('/actions/v0/:id/status', postHandlerStatus);
server.post('/actions/v0/:id/action', postHandlerAction);
server.post('/actions/v0/:id/action/:index', postHandlerAction);
server.post('/actions/v0/:id/dequeue', postHandlerDequeue);
server.post('/actions/v0/:id/wait/:index', postHandlerWait);

server.post('/actions/v0/:id/sms.xml', postHandlerSms);

server.listen(8000, function() {
	console.log('Started Call Router API server ', new Date());
	
	csp.go(function*() {
		console.log('Starting outbound channel loop');
		var val = yield csp.take(processor.outbound);
		while (val !== csp.CLOSED) {
			console.log('OUTBOUND: ', Object.keys(val))
			if (val != undefined) {
				val.req.reply.header('content-type', 'application/xml');
				if (val.body instanceof Error) val.req.reply.send(403, val.body.message, {'content-type': 'application/xml'});
				else if (val.body === undefined) val.req.reply.send(200);
				else val.req.reply.send(200, val.body, {'content-type': 'application/xml'});
				val.req.reply.end();
				val.req.next();
			}
			val = yield csp.take(processor.outbound);
		}
	});
});