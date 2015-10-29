/* connectedvoice CR route handler */
"use strict";

import _ from 'lodash';
import Db from './db.js';
import Twilio from 'twilio';
import Request from 'request-promise';
import TwimlParser from './twiml_parser.js';

let TwimlResponse = Twilio.TwimlResponse;

module.exports = {
	postHandlerVoice: async function(request, reply, next) {
		let params = request.params;
		if ('id' in params) {
			let id = new Buffer(params.id, 'base64').toString('utf8');
			console.log('ACCOUNT ID: ', id)
			console.log('VOICE REQUEST: PARAMS: ', params);

			try {
				let body;
				let ivr_body;
				let twimlStr;

				let doc = await Db.get(id);
				let ivr_id = _.result(_.find(doc.twilio.associated_numbers, {phone_number: params.To}), 'ivr_id');
				if (ivr_id !== undefined) ivr_body = await Db.get(ivr_id);
				else throw new Error('Did not find an IVR record for the callee phone number');
				
				let tResp = buildIvrTwiml(ivr_body.actions, params.id, params);
				if (typeof tResp === 'object') twimlStr = await webtaskRunApi(tResp);
				else twimlStr = tResp;

				reply.send(200, twimlStr, {'content-type': 'application/xml'});
				reply.end();
				return next();
			} catch(e) {
				console.log('postHandlerVoice error: ', e.message)
				reply.send(402, `postHandlerVoice error - ${e.message}`);
				reply.end();
			}
		} else {
			reply.send(402, 'postHandlerVoice error - No User ID found');
			reply.end();
		}
	},

	postHandlerSms: function(request, reply, next) {
		//
	},

	postHandlerStatus: async function(request, reply, next) {
		console.log('STATUS REQUEST: PARAMS: ', params);
		let id = new Buffer(params.id, 'base64').toString('utf8');
		
		params.id = id;
		params.type = ('SmsSid' in params) ? 'sms_status' : 'call_status';

		CallRouter.updateCallStatus(params.CallSid, params);

		try {
			let doc = await db.insert(params);
			if (!('ok' in doc) || !doc.ok) {
				throw new Error('Failed to save call status record to DB');
			}
		} catch(e) {
			console.log(`postHandlerStatus - ${e.message}`);
		}

		reply.send(200);
		reply.end();
		return next();
	},

	postHandlerAction: function(request, reply, next) {
		//
	},

	postHandlerDequeue: function(request, reply, next) {
		//
	},

	postHandlerWait: function(request, reply, next) {
		//
	}
}

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
	var rTwiml;// = TwimlResponse();
	var parser = new TwimlParser();
	var datetime = new Date();
	var params = cleanUp(vars);
	var task;
	var actions = _.cloneDeep(acts);


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

	return (rTwiml != undefined ) ? rTwiml.toString() : '';
}

function webtaskRunApi(task) {
	let token;
	if (task instanceof Array) task = task[0];
	token = task.webtask_token;

console.log('CALL WEBTASK')
	
	return Request({
		url: `${config.webtask.run}/${config.webtask.container}?key=${token}`,
		method: 'POST',
		json: true,
		body: task
	})
	.then(function(resp) {
		let headers = resp.shift();
		let body = resp.shift();

		if (headers.statusCode === 200) {
			return Promise.resolve(body);
		} else {
			console.log('Webtask failed: ', headers.statusCode, ' = ', body);
			return Promise.reject(new Error('Failed to get response from webtask'));
		}
	})
	.catch(function(e) {
		console.log('Webtask run error: ', e);
		return Promise.reject(new Error('An error in the webtask was encountered'));
	});
}

function extractWebtaskTasks(arr) {
	return _.find(arr, {verb: 'webtask'});  //returns the first webtask action it finds or undefined
}