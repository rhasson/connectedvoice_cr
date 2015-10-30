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

var _err_classJs = require('./err_class.js');

var _err_classJs2 = _interopRequireDefault(_err_classJs);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _call_routerJs = require('./call_router.js');

var _call_routerJs2 = _interopRequireDefault(_call_routerJs);

var _twiml_parserJs = require('./twiml_parser.js');

var _twiml_parserJs2 = _interopRequireDefault(_twiml_parserJs);

var log = console.log;

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

	postHandlerVoice: function postHandlerVoice(request, reply, next) {
		var params, id, body, ivr_body, twimlStr, doc, ivr_id, tResp;
		return _regeneratorRuntime.async(function postHandlerVoice$(context$1$0) {
			while (1) switch (context$1$0.prev = context$1$0.next) {
				case 0:
					params = request != undefined ? request.params : {};

					log('VOICE REQUEST: PARAMS: ', params);
					context$1$0.prev = 2;

					if (!(params != undefined && 'id' in params)) {
						context$1$0.next = 33;
						break;
					}

					id = new Buffer(params.id, 'base64').toString('utf8');

					log('ACCOUNT ID: ', id);
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
					reply.send(200, twimlStr, { 'content-type': 'text/plain' });
					reply.end();
					return context$1$0.abrupt('return', next());

				case 33:
					throw new _err_classJs2['default']('No user ID found', 'Critical', 'postHandlerVoice');

				case 34:
					context$1$0.next = 53;
					break;

				case 36:
					context$1$0.prev = 36;
					context$1$0.t0 = context$1$0['catch'](2);

					log(context$1$0.t0.name + ' : ' + context$1$0.t0.type + ' - ' + context$1$0.t0.message);
					twimlStr = undefined;
					context$1$0.t1 = context$1$0.t0.type;
					context$1$0.next = context$1$0.t1 === 'Info' ? 43 : context$1$0.t1 === 'Critical' ? 45 : 48;
					break;

				case 43:
					reply.send(200);
					return context$1$0.abrupt('break', 51);

				case 45:
					twimlStr = buildMessageTwiml('We\'re sorry but no IVR was found for this phone number');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 51);

				case 48:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 51);

				case 51:
					reply.end();
					return context$1$0.abrupt('return', next());

				case 53:
				case 'end':
					return context$1$0.stop();
			}
		}, null, this, [[2, 36]]);
	},

	postHandlerSms: function postHandlerSms(request, reply, next) {
		//
	},

	postHandlerStatus: function postHandlerStatus(request, reply, next) {
		var params, id, doc, twimlStr;
		return _regeneratorRuntime.async(function postHandlerStatus$(context$1$0) {
			while (1) switch (context$1$0.prev = context$1$0.next) {
				case 0:
					params = request != undefined ? request.params : {};

					log('STATUS REQUEST: PARAMS: ', params);
					context$1$0.prev = 2;

					if (!(params != undefined && 'id' in params)) {
						context$1$0.next = 18;
						break;
					}

					id = new Buffer(params.id, 'base64').toString('utf8');

					params.id = id;
					params.type = 'SmsSid' in params ? 'sms_status' : 'call_status';

					_call_routerJs2['default'].updateCallStatus(params.CallSid, params);

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
					reply.end();
					return context$1$0.abrupt('return', next());

				case 18:
					throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerStatus');

				case 19:
					context$1$0.next = 37;
					break;

				case 21:
					context$1$0.prev = 21;
					context$1$0.t0 = context$1$0['catch'](2);

					log(context$1$0.t0.name + ' : ' + context$1$0.t0.type + ' - ' + context$1$0.t0.message);
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
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 35);

				case 35:
					reply.end();
					return context$1$0.abrupt('return', next());

				case 37:
				case 'end':
					return context$1$0.stop();
			}
		}, null, this, [[2, 21]]);
	},

	postHandlerAction: function postHandlerAction(request, reply, next) {
		var params = request != undefined ? request.params : {};
		if (params != undefined) {
			if ('Digits' in params) postHandlerGatherAction(request, reply, next);else if ('SmsSid' in params) postHandlerSmsAction(request, reply, next);else if ('DialCallSid' in params) postHandlerDialAction(request, reply, next);else postHandlerRouterAction(request, reply, next);
		} else {
			log('postHandlerAction : Critical - No parameters found');
			reply.send(402, 'postHandlerAction - No parameters found');
			reply.end();
			return next();
		}
	},

	postHandlerSmsAction: function postHandlerSmsAction(request, reply, next) {
		//
	},

	postHandlerDialAction: function postHandlerDialAction(request, reply, next) {
		//
	},

	postHandlerRouterAction: function postHandlerRouterAction(request, reply, next) {
		//
	},

	postHandlerGatherAction: function postHandlerGatherAction(request, reply, next) {
		var params, id, twimlStr, action, gather, _CACHE$get,
		//found entry in cache, build and respond with twiml
		//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
		_gather, _gather2, actions, doc, ivr_id, ivr_doc, c;

		return _regeneratorRuntime.async(function postHandlerGatherAction$(context$1$0) {
			while (1) switch (context$1$0.prev = context$1$0.next) {
				case 0:
					params = request != undefined ? request.params : {};

					log('ACTION GATHER REQUEST: PARAMS: ', params);
					context$1$0.prev = 2;

					if (!(params != undefined && 'id' in params)) {
						context$1$0.next = 67;
						break;
					}

					id = new Buffer(params.id, 'base64').toString('utf8');
					twimlStr = undefined, action = undefined, gather = undefined;

					if (!CACHE.has(id)) {
						context$1$0.next = 18;
						break;
					}

					_CACHE$get = CACHE.get(id);
					_gather = _CACHE$get.gather;

					if (!(_gather != undefined && 'index' in _gather && _gather.index === params.index)) {
						context$1$0.next = 16;
						break;
					}

					//get the actions array based on the pressed ivr digit
					action = _lodash2['default'].result(_lodash2['default'].find(_gather.nested, { nouns: { expected_digit: params.Digits } }), 'actions')[0];

					twimlStr = buildIvrTwiml(action, params.id, params);

					if (!(typeof twimlStr === 'object' && 'webtask_token' in twimlStr)) {
						context$1$0.next = 16;
						break;
					}

					context$1$0.next = 15;
					return _regeneratorRuntime.awrap(webtaskRunApi(twimlStr));

				case 15:
					twimlStr = context$1$0.sent;

				case 16:
					context$1$0.next = 62;
					break;

				case 18:
					_gather2 = undefined;
					actions = undefined;
					context$1$0.next = 22;
					return _regeneratorRuntime.awrap(_dbJs2['default'].get(id));

				case 22:
					doc = context$1$0.sent;

					if (!(doc != undefined)) {
						context$1$0.next = 61;
						break;
					}

					ivr_id = _lodash2['default'].result(_lodash2['default'].find(doc.twilio.associated_numbers, { phone_number: params.To }), 'ivr_id');

					if (!(ivr_id != undefined)) {
						context$1$0.next = 58;
						break;
					}

					CACHE.set(id, { id: ivr_id });
					context$1$0.next = 29;
					return _regeneratorRuntime.awrap(_dbJs2['default'].get(ivr_id));

				case 29:
					ivr_doc = context$1$0.sent;

					if (!(ivr_doc != undefined)) {
						context$1$0.next = 55;
						break;
					}

					//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
					_gather2 = _lodash2['default'].find(doc.actions, 'index', params.index);
					//if we can't find the requested gather verb, grab the first one in the IVR

					if (!(_gather2 == undefined)) {
						context$1$0.next = 36;
						break;
					}

					_gather2 = _lodash2['default'].find(doc.actions, 'verb', 'gather');
					context$1$0.next = 53;
					break;

				case 36:
					if (!(_gather2 != undefined && 'nested' in _gather2)) {
						context$1$0.next = 52;
						break;
					}

					c = CACHE.get(id);

					c.gather = _gather2;
					CACHE.set(id, c);

					if (!('Digits' in params)) {
						context$1$0.next = 49;
						break;
					}

					//get the actions array based on the pressed ivr digit
					actions = _lodash2['default'].result(_lodash2['default'].find(_gather2.nested, { nouns: { expected_digit: params.Digits } }), 'actions')[0];
					twimlStr = buildIvrTwiml(action, params.id, params);

					if (!(typeof twimlStr === 'object' && 'webtask_token' in twimlStr)) {
						context$1$0.next = 47;
						break;
					}

					context$1$0.next = 46;
					return _regeneratorRuntime.awrap(webtaskRunApi(twimlStr));

				case 46:
					twimlStr = context$1$0.sent;

				case 47:
					context$1$0.next = 50;
					break;

				case 49:
					throw new _err_classJs2['default']('No digits dialed by the user', 'Critical', 'postHandlerGatherAction');

				case 50:
					context$1$0.next = 53;
					break;

				case 52:
					throw new _err_classJs2['default']('Found a GATHER verb but it has no nested actions', 'Critical', 'postHandlerGatherAction');

				case 53:
					context$1$0.next = 56;
					break;

				case 55:
					throw new _err_classJs2['default']('IVR record not found', 'Critical', 'postHandlerGatherAction');

				case 56:
					context$1$0.next = 59;
					break;

				case 58:
					throw new _err_classJs2['default']('No IVR_ID found in record', 'Critical', 'postHandlerGatherAction');

				case 59:
					context$1$0.next = 62;
					break;

				case 61:
					throw new _err_classJs2['default']('Failed to find DB record for ID', 'Critical', 'postHandlerGatherAction');

				case 62:

					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					reply.end();
					return context$1$0.abrupt('return', next());

				case 67:
					throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerGatherAction');

				case 68:
					context$1$0.next = 87;
					break;

				case 70:
					context$1$0.prev = 70;
					context$1$0.t0 = context$1$0['catch'](2);

					log(context$1$0.t0.name + ' : ' + context$1$0.t0.type + ' - ' + context$1$0.t0.message);
					twimlStr = undefined;
					context$1$0.t1 = context$1$0.t0.type;
					context$1$0.next = context$1$0.t1 === 'Info' ? 77 : context$1$0.t1 === 'Critical' ? 79 : 82;
					break;

				case 77:
					reply.send(200);
					return context$1$0.abrupt('break', 85);

				case 79:
					twimlStr = buildMessageTwiml('You pressed an incorrect number, please try again');

					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 85);

				case 82:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 85);

				case 85:
					reply.end();
					return context$1$0.abrupt('return', next());

				case 87:
				case 'end':
					return context$1$0.stop();
			}
		}, null, this, [[2, 70]]);
	},

	postHandlerDequeue: function postHandlerDequeue(request, reply, next) {
		var params, id, doc, twimlStr;
		return _regeneratorRuntime.async(function postHandlerDequeue$(context$1$0) {
			while (1) switch (context$1$0.prev = context$1$0.next) {
				case 0:
					params = request != undefined ? request.params : {};

					log('ACTION DEQUEUE REQUEST: PARAMS: ', params);
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
					context$1$0.next = 39;
					break;

				case 22:
					context$1$0.prev = 22;
					context$1$0.t0 = context$1$0['catch'](2);

					log(context$1$0.t0.name + ' : ' + context$1$0.t0.type + ' - ' + context$1$0.t0.message);
					twimlStr = undefined;
					context$1$0.t1 = context$1$0.t0.type;
					context$1$0.next = context$1$0.t1 === 'Info' ? 29 : context$1$0.t1 === 'Critical' ? 31 : 34;
					break;

				case 29:
					reply.send(200);
					return context$1$0.abrupt('break', 37);

				case 31:
					twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');

					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 37);

				case 34:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					return context$1$0.abrupt('break', 37);

				case 37:
					reply.end();
					return context$1$0.abrupt('return', next());

				case 39:
				case 'end':
					return context$1$0.stop();
			}
		}, null, this, [[2, 22]]);
	},

	postHandlerWait: function postHandlerWait(request, reply, next) {
		var params = request != undefined ? request.params : {};
		log('QUEUE WAIT REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && 'id' in params) {
				var id = new Buffer(params.id, 'base64').toString('utf8');
				var twiml = TwimlResponse();

				if (!_call_routerJs2['default'].isQueued(params.CallSid)) {
					_call_routerJs2['default'].queue(params.CallSid, id, params);
				}

				twiml.say("You are caller " + params.QueuePosition + ". You will be connected shortly", { voice: 'woman' });
				twiml.pause({ length: 10 });

				reply.send(200, twiml.toString(), { 'content-type': 'application/xml' });
				reply.end();
				return next();
			} else throw new _err_classJs2['default']('No parameters found', 'Critical', 'postHandlerWait');
		} catch (e) {
			log(e.name + ' : ' + e.type + ' - ' + e.message);
			var twimlStr = undefined;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					var twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					_call_routerJs2['default'].cleanUpState(params.CallSid);
					break;
				default:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					break;
			}
			reply.end();
			return next();
		}
	}
};

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

	_call_routerJs2['default'].addTask(vars.CallSid, parser.getTree());

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

	log('CALL WEBTASK');

	return (0, _requestPromise2['default'])({
		url: config.webtask.run + '/' + config.webtask.container + '?key=' + token,
		method: 'POST',
		json: true,
		body: task
	}).then(function (resp) {
		var headers = resp.shift();
		var body = resp.shift();

		if (headers.statusCode === 200) {
			return _Promise.resolve(body);
		} else {
			log('Webtask failed: ', headers.statusCode, ' = ', body);
			return _Promise.reject(new _err_classJs2['default']('Failed to get response from webtask', 'Critical', 'webtaskRunApi'));
		}
	})['catch'](function (e) {
		log('Webtask run error: ', e);
		return _Promise.reject(new _err_classJs2['default']('An error in the webtask was encountered', 'Critical', 'webtaskRunApi'));
	});
}

function extractWebtaskTasks(arr) {
	return _lodash2['default'].find(arr, { verb: 'webtask' }); //returns the first webtask action it finds or undefined
}
//TODO: verify if destructuring works

//check if the index provided in URL is that of a Gather verb

//entry not in cache, query database, cache entry and respond with twiml
//client side should validate this could never happen