/* connectedvoice CR route handler */
"use strict";

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _dbJs = require('./db.js');

var _dbJs2 = _interopRequireDefault(_dbJs);

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _err_classJs = require('./err_class.js');

var _err_classJs2 = _interopRequireDefault(_err_classJs);

var _loggerJs = require('./logger.js');

var _loggerJs2 = _interopRequireDefault(_loggerJs);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _configJson = require('../../config.json');

var _configJson2 = _interopRequireDefault(_configJson);

var _call_routerJs = require('./call_router.js');

var _call_routerJs2 = _interopRequireDefault(_call_routerJs);

var _twiml_parserJs = require('./twiml_parser.js');

var _twiml_parserJs2 = _interopRequireDefault(_twiml_parserJs);

var log = _loggerJs2['default'].RouteHandlerLogger;

var TwimlResponse = _twilio2['default'].TwimlResponse;
var CACHE = (0, _lruCache2['default'])({
	max: 5000,
	length: function length(n) {
		return 1;
	}, //since we're storing object, every set counts as 1
	maxAge: 1000 * 60 * 60
});

module.exports = {
	/* for REPL use */
	_call_router: _call_routerJs2['default'],
	_twiml_parser: _twiml_parserJs2['default'],
	_db: _dbJs2['default'],
	/*****************/
	postHandlerVoice: postHandlerVoice,
	postHandlerSms: postHandlerSms,
	postHandlerStatus: postHandlerStatus,
	postHandlerAction: postHandlerAction,
	postHandlerDequeue: postHandlerDequeue,
	postHandlerWait: postHandlerWait
};
function postHandlerVoice(request, reply, next) {
	var params, id, body, ivr_body, twimlStr, doc, ivr_id, tResp;
	return _regeneratorRuntime.async(function postHandlerVoice$(context$1$0) {
		while (1) switch (context$1$0.prev = context$1$0.next) {
			case 0:
				params = request != undefined ? request.params : {};
				context$1$0.prev = 1;

				log.info({ params: params }, 'VOICE REQUEST PARAMS');

				if (!(params != undefined && 'id' in params)) {
					context$1$0.next = 32;
					break;
				}

				id = new Buffer(params.id, 'base64').toString('utf8');

				log.info('ACCOUNT ID: %s', id);
				body = undefined;
				ivr_body = undefined;
				twimlStr = undefined;
				context$1$0.next = 11;
				return _regeneratorRuntime.awrap(_dbJs2['default'].get(id));

			case 11:
				doc = context$1$0.sent;
				ivr_id = _lodash2['default'].result(_lodash2['default'].find(doc.twilio.associated_numbers, { phone_number: params.To }), 'ivr_id');

				if (!(ivr_id != undefined)) {
					context$1$0.next = 19;
					break;
				}

				context$1$0.next = 16;
				return _regeneratorRuntime.awrap(_dbJs2['default'].get(ivr_id));

			case 16:
				ivr_body = context$1$0.sent;
				context$1$0.next = 20;
				break;

			case 19:
				throw new _err_classJs2['default']('Did not find an IVR record for the callee phone number', 'Critical', 'postHandlerVoice');

			case 20:
				tResp = buildIvrTwiml(ivr_body.actions, params.id, params);

				if (!(typeof tResp === 'object')) {
					context$1$0.next = 27;
					break;
				}

				context$1$0.next = 24;
				return _regeneratorRuntime.awrap(webtaskRunApi(tResp));

			case 24:
				twimlStr = context$1$0.sent;
				context$1$0.next = 28;
				break;

			case 27:
				twimlStr = tResp;

			case 28:
				reply.json(200, twimlStr);
				return context$1$0.abrupt('return', next());

			case 32:
				throw new _err_classJs2['default']('No user ID found', 'Critical', 'postHandlerVoice');

			case 33:
				context$1$0.next = 51;
				break;

			case 35:
				context$1$0.prev = 35;
				context$1$0.t0 = context$1$0['catch'](1);

				log.error(context$1$0.t0); //`${e.name} : ${e.type} - ${e.message}`);
				twimlStr = undefined;
				context$1$0.t1 = context$1$0.t0.type;
				context$1$0.next = context$1$0.t1 === 'Info' ? 42 : context$1$0.t1 === 'Critical' ? 44 : 47;
				break;

			case 42:
				reply.send(200);
				return context$1$0.abrupt('break', 50);

			case 44:
				twimlStr = buildMessageTwiml('We\'re sorry but no IVR was found for this phone number');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 50);

			case 47:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 50);

			case 50:
				return context$1$0.abrupt('return', next());

			case 51:
			case 'end':
				return context$1$0.stop();
		}
	}, null, this, [[1, 35]]);
}

function postHandlerSms(request, reply, next) {
	//
}

function postHandlerStatus(request, reply, next) {
	var params, id, doc, twimlStr;
	return _regeneratorRuntime.async(function postHandlerStatus$(context$1$0) {
		while (1) switch (context$1$0.prev = context$1$0.next) {
			case 0:
				params = request != undefined ? request.params : {};

				log.info({ params: params }, 'STATUS REQUEST PARAMS');
				context$1$0.prev = 2;

				if (!(params != undefined && 'id' in params)) {
					context$1$0.next = 17;
					break;
				}

				id = new Buffer(params.id, 'base64').toString('utf8');

				params.id = id;
				params.type = 'SmsSid' in params ? 'sms_status' : 'call_status';

				if (_call_routerJs2['default'].isQueued(params.CallSid)) _call_routerJs2['default'].updateCallStatus(params.CallSid, params);

				context$1$0.next = 10;
				return _regeneratorRuntime.awrap(_dbJs2['default'].insert(params));

			case 10:
				doc = context$1$0.sent;

				if (!(!('ok' in doc) || !doc.ok)) {
					context$1$0.next = 13;
					break;
				}

				throw new _err_classJs2['default']('Failed to save call status record to DB', 'Info', 'postHandlerStatus');

			case 13:

				//whether db save failed or not return a 200OK back to Twilio
				reply.send(200);
				return context$1$0.abrupt('return', next());

			case 17:
				throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerStatus');

			case 18:
				context$1$0.next = 35;
				break;

			case 20:
				context$1$0.prev = 20;
				context$1$0.t0 = context$1$0['catch'](2);

				log.error(context$1$0.t0); //(`${e.name} : ${e.type} - ${e.message}`);
				twimlStr = undefined;
				context$1$0.t1 = context$1$0.t0.type;
				context$1$0.next = context$1$0.t1 === 'Info' ? 27 : context$1$0.t1 === 'Critical' ? 29 : 31;
				break;

			case 27:
				reply.send(200);
				return context$1$0.abrupt('break', 34);

			case 29:
				reply.send(200);
				return context$1$0.abrupt('break', 34);

			case 31:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 34);

			case 34:
				return context$1$0.abrupt('return', next());

			case 35:
			case 'end':
				return context$1$0.stop();
		}
	}, null, this, [[2, 20]]);
}

function postHandlerAction(request, reply, next) {
	var params = request != undefined ? request.params : {};
	log.info({ params: params }, 'ACTION REQUEST PARAMS');
	try {
		if (params != undefined) {
			if ('Digits' in params) postHandlerGatherAction(request, reply, next);else if ('SmsSid' in params) postHandlerSmsAction(request, reply, next);else if ('DialCallSid' in params) postHandlerDialAction(request, reply, next);else postHandlerRouterAction(request, reply, next);
		} else throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerAction');
	} catch (e) {
		log.error(e); //`${e.name} : ${e.type} - ${e.message}`);
		var twimlStr = undefined;
		switch (e.type) {
			case 'Info':
				reply.send(200);
				break;
			case 'Critical':
				twimlStr = buildMessageTwiml('Failed to route action');
				reply.json(200, twimlStr);
				break;
			default:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				break;
		}
		return next();
	}
}

function postHandlerSmsAction(request, reply, next) {
	var params = request != undefined ? request.params : {};
	log.info({ params: params }, 'ACTION SMS REQUEST PARAMS');

	var twimlStr = buildMessageTwiml('Your message has been sent');

	reply.json(200, twimlStr);
	return next();
}

function postHandlerDialAction(request, reply, next) {
	var params, id, body, twimlStr;
	return _regeneratorRuntime.async(function postHandlerDialAction$(context$1$0) {
		while (1) switch (context$1$0.prev = context$1$0.next) {
			case 0:
				params = request != undefined ? request.params : {};

				log.info({ params: params }, 'ACTION DIAL REQUEST PARAMS');
				context$1$0.prev = 2;

				if (!(params != undefined)) {
					context$1$0.next = 18;
					break;
				}

				id = new Buffer(params.id, 'base64').toString('utf8');

				params.id = id;
				params.type = 'dial_status';

				context$1$0.next = 9;
				return _regeneratorRuntime.awrap(_dbJs2['default'].insert(params));

			case 9:
				body = context$1$0.sent;

				if (!(!('ok' in body) || !body.ok)) {
					context$1$0.next = 14;
					break;
				}

				throw new _err_classJs2['default']('Failed to save dial status record to DB', 'Info', 'postHandlerDialAction');

			case 14:
				reply.send(200);
				return context$1$0.abrupt('return', next());

			case 16:
				context$1$0.next = 19;
				break;

			case 18:
				throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerDialAction');

			case 19:
				context$1$0.next = 36;
				break;

			case 21:
				context$1$0.prev = 21;
				context$1$0.t0 = context$1$0['catch'](2);

				log.error(context$1$0.t0); //`${e.name} : ${e.type} - ${e.message}`);
				twimlStr = undefined;
				context$1$0.t1 = context$1$0.t0.type;
				context$1$0.next = context$1$0.t1 === 'Info' ? 28 : context$1$0.t1 === 'Critical' ? 30 : 32;
				break;

			case 28:
				reply.send(200);
				return context$1$0.abrupt('break', 35);

			case 30:
				reply.send(200);
				return context$1$0.abrupt('break', 35);

			case 32:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 35);

			case 35:
				return context$1$0.abrupt('return', next());

			case 36:
			case 'end':
				return context$1$0.stop();
		}
	}, null, this, [[2, 21]]);
}

function postHandlerRouterAction(request, reply, next) {
	var params = request != undefined ? request.params : {};
	log.info({ params: params }, 'ACTION ROUTER REQUEST PARAMS');
	try {
		if (params != undefined) {
			var resp = undefined;
			//var id = new Buffer(params.id, 'base64').toString('utf8');
			if (_call_routerJs2['default'].isActive(params.CallSid)) {
				resp = _call_routerJs2['default'].getResponse(params.CallSid, params.id);
				reply.json(200, resp.toString());
				return next();
			} else throw new _err_classJs2['default']('Call SID was not found', 'Critical', 'postHandlerRouterAction');
		} else throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerRouterAction');
	} catch (e) {
		log.error(e); //`${e.name} : ${e.type} - ${e.message}`);
		var twimlStr = undefined;
		switch (e.type) {
			case 'Info':
				reply.send(200);
				break;
			case 'Critical':
				var twimlStr = buildMessageTwiml('Failed to identify call for routing');
				reply.json(200, twimlStr);
				break;
			default:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				break;
		}
		return next();
	}
}

function postHandlerGatherAction(request, reply, next) {
	var params, id, twimlStr, action, gather, _CACHE$get,
	//found entry in cache, build and respond with twiml
	//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
	_gather, _gather2, doc, ivr_id, ivr_doc, c, _action;

	return _regeneratorRuntime.async(function postHandlerGatherAction$(context$1$0) {
		while (1) switch (context$1$0.prev = context$1$0.next) {
			case 0:
				params = request != undefined ? request.params : {};

				log.info({ params: params }, 'ACTION GATHER REQUEST PARAMS');
				context$1$0.prev = 2;

				if (!(params != undefined && 'id' in params)) {
					context$1$0.next = 66;
					break;
				}

				id = new Buffer(params.id, 'base64').toString('utf8');
				twimlStr = undefined, action = undefined, gather = undefined;

				if (!CACHE.has(id)) {
					context$1$0.next = 21;
					break;
				}

				log.info('Gather from cache for %s', id);_CACHE$get = CACHE.get(id);
				_gather = _CACHE$get.gather;

				if (!(_gather != undefined && 'index' in _gather && _gather.index === params.index)) {
					context$1$0.next = 19;
					break;
				}

				//get the actions array based on the pressed ivr digit
				action = _lodash2['default'].result(_lodash2['default'].find(_gather.nested, { nouns: { expected_digit: params.Digits } }), 'actions')[0];

				twimlStr = buildIvrTwiml(action, params.id, params);

				if (!(typeof twimlStr === 'object' && 'webtask_token' in twimlStr)) {
					context$1$0.next = 17;
					break;
				}

				context$1$0.next = 16;
				return _regeneratorRuntime.awrap(webtaskRunApi(twimlStr));

			case 16:
				twimlStr = context$1$0.sent;

			case 17:
				reply.json(200, twimlStr);
				return context$1$0.abrupt('return', next());

			case 19:
				context$1$0.next = 64;
				break;

			case 21:
				_gather2 = undefined;
				context$1$0.next = 24;
				return _regeneratorRuntime.awrap(_dbJs2['default'].get(id));

			case 24:
				doc = context$1$0.sent;

				if (!(doc != undefined)) {
					context$1$0.next = 63;
					break;
				}

				log.info('Gather from db for %s', id);
				ivr_id = _lodash2['default'].result(_lodash2['default'].find(doc.twilio.associated_numbers, { phone_number: params.To }), 'ivr_id');

				if (!(ivr_id != undefined)) {
					context$1$0.next = 60;
					break;
				}

				CACHE.set(id, { id: ivr_id });
				context$1$0.next = 32;
				return _regeneratorRuntime.awrap(_dbJs2['default'].get(ivr_id));

			case 32:
				ivr_doc = context$1$0.sent;

				if (!(ivr_doc != undefined)) {
					context$1$0.next = 57;
					break;
				}

				//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
				_gather2 = _lodash2['default'].find(ivr_doc.actions, 'index', params.index);
				//if we can't find the requested gather verb, grab the first one in the IVR
				if (_gather2 == undefined) _gather2 = _lodash2['default'].find(ivr_doc.actions, 'verb', 'gather');

				if (!(_gather2 != undefined && 'nested' in _gather2)) {
					context$1$0.next = 54;
					break;
				}

				c = CACHE.get(id);

				c.gather = _gather2;
				CACHE.set(id, c);

				if (!('Digits' in params)) {
					context$1$0.next = 51;
					break;
				}

				_action = _lodash2['default'].result(_lodash2['default'].find(_gather2.nested, { nouns: { expected_digit: params.Digits } }), 'actions')[0];

				twimlStr = buildIvrTwiml(_action, params.id, params);

				if (!(typeof twimlStr === 'object' && 'webtask_token' in twimlStr)) {
					context$1$0.next = 47;
					break;
				}

				context$1$0.next = 46;
				return _regeneratorRuntime.awrap(webtaskRunApi(twimlStr));

			case 46:
				twimlStr = context$1$0.sent;

			case 47:
				reply.json(200, twimlStr);
				return context$1$0.abrupt('return', next());

			case 51:
				throw new _err_classJs2['default']('No digits dialed by the user', 'Critical', 'postHandlerGatherAction');

			case 52:
				context$1$0.next = 55;
				break;

			case 54:
				throw new _err_classJs2['default']('Found a GATHER verb but it has no nested actions', 'Critical', 'postHandlerGatherAction');

			case 55:
				context$1$0.next = 58;
				break;

			case 57:
				throw new _err_classJs2['default']('IVR record not found', 'Critical', 'postHandlerGatherAction');

			case 58:
				context$1$0.next = 61;
				break;

			case 60:
				throw new _err_classJs2['default']('No IVR_ID found in record', 'Critical', 'postHandlerGatherAction');

			case 61:
				context$1$0.next = 64;
				break;

			case 63:
				throw new _err_classJs2['default']('Failed to find DB record for ID', 'Critical', 'postHandlerGatherAction');

			case 64:
				context$1$0.next = 67;
				break;

			case 66:
				throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerGatherAction');

			case 67:
				context$1$0.next = 85;
				break;

			case 69:
				context$1$0.prev = 69;
				context$1$0.t0 = context$1$0['catch'](2);

				log.error(context$1$0.t0); //`${e.name} : ${e.type} - ${e.message}`);
				twimlStr = undefined;
				context$1$0.t1 = context$1$0.t0.type;
				context$1$0.next = context$1$0.t1 === 'Info' ? 76 : context$1$0.t1 === 'Critical' ? 78 : 81;
				break;

			case 76:
				reply.send(200);
				return context$1$0.abrupt('break', 84);

			case 78:
				twimlStr = buildMessageTwiml('You pressed an incorrect number, please try again');

				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 84);

			case 81:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 84);

			case 84:
				return context$1$0.abrupt('return', next());

			case 85:
			case 'end':
				return context$1$0.stop();
		}
	}, null, this, [[2, 69]]);
}

function postHandlerDequeue(request, reply, next) {
	var params, id, doc, twimlStr;
	return _regeneratorRuntime.async(function postHandlerDequeue$(context$1$0) {
		while (1) switch (context$1$0.prev = context$1$0.next) {
			case 0:
				params = request != undefined ? request.params : {};

				log.info({ params: params }, 'ACTION DEQUEUE REQUEST PARAMS');
				context$1$0.prev = 2;

				if (!(params != undefined && 'id' in params)) {
					context$1$0.next = 18;
					break;
				}

				id = new Buffer(params.id, 'base64').toString('utf8');

				params.id = id;
				params.type = 'dequeue_status';

				context$1$0.next = 9;
				return _regeneratorRuntime.awrap(_dbJs2['default'].insert(params));

			case 9:
				doc = context$1$0.sent;

				if (!(!('ok' in doc) || !doc.ok)) {
					context$1$0.next = 15;
					break;
				}

				_call_routerJs2['default'].dequeue(params.CallSid, params.QueueResult);
				throw new _err_classJs2['default']('Failed to save dequeue status record to DB', 'Info', 'postHandlerDequeue');

			case 15:
				_call_routerJs2['default'].dequeue(params.CallSid, params.QueueResult);

			case 16:
				context$1$0.next = 20;
				break;

			case 18:
				_call_routerJs2['default'].cleanUpState(params.CallSid);
				throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerDequeue');

			case 20:
				context$1$0.next = 38;
				break;

			case 22:
				context$1$0.prev = 22;
				context$1$0.t0 = context$1$0['catch'](2);

				log.error(context$1$0.t0); //`${e.name} : ${e.type} - ${e.message}`);
				twimlStr = undefined;
				context$1$0.t1 = context$1$0.t0.type;
				context$1$0.next = context$1$0.t1 === 'Info' ? 29 : context$1$0.t1 === 'Critical' ? 31 : 34;
				break;

			case 29:
				reply.send(200);
				return context$1$0.abrupt('break', 37);

			case 31:
				twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');

				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 37);

			case 34:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				return context$1$0.abrupt('break', 37);

			case 37:
				return context$1$0.abrupt('return', next());

			case 38:
			case 'end':
				return context$1$0.stop();
		}
	}, null, this, [[2, 22]]);
}

function postHandlerWait(request, reply, next) {
	var params = request != undefined ? request.params : {};
	log.info({ params: params }, 'QUEUE WAIT REQUEST PARAMS');
	try {
		if (params != undefined && 'id' in params) {
			var id = new Buffer(params.id, 'base64').toString('utf8');
			var twiml = TwimlResponse();

			if (!_call_routerJs2['default'].isQueued(params.CallSid)) {
				_call_routerJs2['default'].queue(params.CallSid, id, params);
			}

			twiml.say("You are caller " + params.QueuePosition + ". You will be connected shortly", { voice: 'woman' });
			twiml.pause({ length: 10 });

			reply.json(200, twiml.toString());
			return next();
		} else throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerWait');
	} catch (e) {
		log.error(e); //`${e.name} : ${e.type} - ${e.message}`);
		var twimlStr = undefined;
		switch (e.type) {
			case 'Info':
				reply.send(200);
				break;
			case 'Critical':
				var twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');
				reply.json(200, twimlStr);
				_call_routerJs2['default'].cleanUpState(params.CallSid);
				break;
			default:
				twimlStr = buildMessageTwiml('An unrecoverable error occured');
				reply.json(200, twimlStr);
				break;
		}
		return next();
	}
}

/*
function _getIvrForUserId(id, to) {
	if (id) {
		id = new Buffer(id, 'base64').toString('utf8');
		console.log('ACCOUNT ID: ', id)
		return db.get(id).then(function(resp) {
			var doc = resp.shift();
			var ivr_id = _.result(_.find(doc.twilio.associated_numbers, {phone_number: to}), 'ivr_id');
			console.log('IVR ID: ', ivr_id)
			
			if (ivr_id !== undefined) return db.get(ivr_id);
			else return when.reject(new Error('Did not find an IVR record for the callee phone number'));
		})
		.then(function(resp) {
			var doc = resp.shift();
			return when.resolve(doc);
		});
	}
}
*/

function buildMessageTwiml(message) {
	var rTwiml = TwimlResponse();
	rTwiml.say(message, {
		voice: 'Woman',
		loop: 1,
		language: 'en'
	});
	rTwiml.hangup();
	return rTwiml.toString();
}

function buildIvrTwiml(acts, userid, vars) {
	var rTwiml; // = TwimlResponse();
	var parser = new _twiml_parserJs2['default']();
	var datetime = new Date();
	var params = cleanUp(vars);
	var task;
	var actions = _lodash2['default'].cloneDeep(acts);

	if (!(actions instanceof Array)) actions = [actions];

	task = extractWebtaskTasks(actions);

	//log('EXTRACTED: ', task)

	if (task) {
		//right now only allow one webtask and no other twiml actions
		task.to = vars.To;
		task.from = vars.From;
		task.callSid = vars.CallSid;
		task.callStatus = vars.CallStatus;
		task.time = datetime.toTimeString();
		task.date = datetime.toDateString();
		delete task.verb;
		delete task.nouns;
		delete task.action_for;

		return task;
	}

	rTwiml = parser.create(actions).buildTwiml(TwimlResponse(), params, userid);

	if (_call_routerJs2['default'].isQueued(vars.CallSid)) _call_routerJs2['default'].addTask(vars.CallSid, parser.getTree());

	function cleanUp(p) {
		return {
			caller: p.Caller,
			callee: p.Called,
			digits: p.Digits,
			datetime: datetime,
			time: datetime.toTimeString(),
			date: datetime.toDateString()
		};
	}

	return rTwiml != undefined ? rTwiml.toString() : '';
}

function webtaskRunApi(task) {
	var token = undefined;
	if (task instanceof Array) task = task[0];
	token = task.webtask_token;

	log.info({ task: task }, 'CALL WEBTASK');

	return (0, _requestPromise2['default'])({
		url: _configJson2['default'].webtask.run + '/' + _configJson2['default'].webtask.container + '?key=' + token,
		method: 'POST',
		json: true,
		body: task
	}).then(function (body) {
		log.info('WEBTASK BODY: %s', body);
		return _Promise.resolve(body);
	})['catch'](function (e) {
		log.error(e, 'webtask run error');
		return _Promise.reject(new _err_classJs2['default']('An error in the webtask was encountered', 'Critical', 'webtaskRunApi'));
	});
}

function extractWebtaskTasks(arr) {
	return _lodash2['default'].find(arr, { verb: 'webtask' }); //returns the first webtask action it finds or undefined
}
//TODO: verify if destructuring works

//check if the index provided in URL is that of a Gather verb

//entry not in cache, query database, cache entry and respond with twiml

//get the actions array based on the pressed ivr digit
//client side should validate this could never happen