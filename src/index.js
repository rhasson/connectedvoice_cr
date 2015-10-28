"use strict";

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

server.listen(8000, function() {
	console.log('Started Call Router API server ', new Date());
});