/* connectedvoice CR route handler */
"use strict";

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _dbJs = require('./db.js');

var _dbJs2 = _interopRequireDefault(_dbJs);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _twiml_parserJs = require('./twiml_parser.js');

var _twiml_parserJs2 = _interopRequireDefault(_twiml_parserJs);

var TwimlResponse = _twilio2['default'].TwimlResponse;

module.exports = {
	postHandlerVoice: function postHandlerVoice(request, reply, next) {
		var params, id, body, ivr_body, twimlStr, doc, ivr_id, tResp;
		return _regeneratorRuntime.async(function postHandlerVoice$(context$1$0) {
			while (1) switch (context$1$0.prev = context$1$0.next) {
				case 0:
					params = request.params;

					if (!('id' in params)) {
						context$1$0.next = 44;
						break;
					}

					id = new Buffer(params.id, 'base64').toString('utf8');

					console.log('ACCOUNT ID: ', id);
					console.log('VOICE REQUEST: PARAMS: ', params);

					context$1$0.prev = 5;
					body = undefined;
					ivr_body = undefined;
					twimlStr = undefined;
					context$1$0.next = 11;
					return _regeneratorRuntime.awrap(_dbJs2['default'].get(id));

				case 11:
					doc = context$1$0.sent;

					console.log('DOC: ', doc);
					ivr_id = _lodash2['default'].result(_lodash2['default'].find(doc.twilio.associated_numbers, { phone_number: params.To }), 'ivr_id');

					if (!(ivr_id !== undefined)) {
						context$1$0.next = 20;
						break;
					}

					context$1$0.next = 17;
					return _regeneratorRuntime.awrap(_dbJs2['default'].get(ivr_id));

				case 17:
					ivr_body = context$1$0.sent;
					context$1$0.next = 21;
					break;

				case 20:
					throw new Error('Did not find an IVR record for the callee phone number');

				case 21:

					//let ivr_body = doc.shift();
					console.log('IVR BODY: ', ivr_body);
					tResp = buildIvrTwiml(ivr_body.actions, params.id, params);

					if (!(typeof tResp === 'object')) {
						context$1$0.next = 29;
						break;
					}

					context$1$0.next = 26;
					return _regeneratorRuntime.awrap(webtaskRunApi(tResp));

				case 26:
					twimlStr = context$1$0.sent;
					context$1$0.next = 30;
					break;

				case 29:
					twimlStr = tResp;

				case 30:
					console.log('TWIML: ', twimlStr);
					twimlStr = new Buffer(twimlStr, 'utf8').toString('base64');
					reply.send(200, twimlStr, { 'content-type': 'application/xml' });
					reply.end();
					return context$1$0.abrupt('return', next());

				case 37:
					context$1$0.prev = 37;
					context$1$0.t0 = context$1$0['catch'](5);

					//new Error('voiceCallResponse error - failed to get record from DB')
					console.log('ERROR: ', context$1$0.t0);
					reply.send(402, context$1$0.t0.message);
					reply.end();

				case 42:
					context$1$0.next = 46;
					break;

				case 44:
					reply.send(402, 'No User ID found');
					reply.end();

				case 46:
				case 'end':
					return context$1$0.stop();
			}
		}, null, this, [[5, 37]]);
	},

	postHandlerSms: function postHandlerSms(request, reply, next) {
		//
	},

	postHandlerStatus: function postHandlerStatus(request, reply, next) {
		//
	},

	postHandlerAction: function postHandlerAction(request, reply, next) {
		//
	},

	postHandlerDequeue: function postHandlerDequeue(request, reply, next) {
		//
	},

	postHandlerWait: function postHandlerWait(request, reply, next) {
		//
	}
};

function _getIvrForUserId(id, to) {
	if (id) {
		id = new Buffer(id, 'base64').toString('utf8');
		console.log('ACCOUNT ID: ', id);
		return db.get(id).then(function (resp) {
			var doc = resp.shift();
			var ivr_id = _lodash2['default'].result(_lodash2['default'].find(doc.twilio.associated_numbers, { phone_number: to }), 'ivr_id');
			console.log('IVR ID: ', ivr_id);

			if (ivr_id !== undefined) return db.get(ivr_id);else return when.reject(new Error('Did not find an IVR record for the callee phone number'));
		}).then(function (resp) {
			var doc = resp.shift();
			return when.resolve(doc);
		});
	}
}

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

	//console.log('EXTRACTED: ', task)

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

	//CallRouter.addTask(vars.CallSid, parser.getTree());

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

	console.log('CALL WEBTASK');

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
			console.log('Webtask failed: ', headers.statusCode, ' = ', body);
			return _Promise.reject(new Error('Failed to get response from webtask'));
		}
	})['catch'](function (e) {
		console.log('Webtask run error: ', e);
		return _Promise.reject(new Error('An error in the webtask was encountered'));
	});
}

function extractWebtaskTasks(arr) {
	return _lodash2['default'].find(arr, { verb: 'webtask' }); //returns the first webtask action it finds or undefined
}