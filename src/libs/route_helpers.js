/* connectedvoice CR route handler */
"use strict";

import _ from 'lodash';
import Db from './db.js';
import Lru from 'lru-cache';
import Err from './err_class.js';
import Twilio from 'twilio';
import Request from 'request-promise';
import Config from '../../config.json';
import CallRouter from './call_router.js';
import TwimlParser from './twiml_parser.js';

let log = console.log;

let TwimlResponse = Twilio.TwimlResponse;
let CACHE = Lru({
		max: 5000,
		length: function(n) { return 1 }, //since we're storing object, every set counts as 1
		maxAge: 1000 * 60 * 60
	});

module.exports = {
	/* for REPL use */
	_call_router: CallRouter,
	_twiml_parser: TwimlParser,
	_db: Db,
	/*****************/
	postHandlerVoice: postHandlerVoice,
	postHandlerSms: postHandlerSms,
	postHandlerStatus: postHandlerStatus,
	postHandlerAction: postHandlerAction,
	postHandlerDequeue: postHandlerDequeue,
	postHandlerWait: postHandlerWait
}
	async function postHandlerVoice(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		log('VOICE REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && ('id' in params)) {
				let id = new Buffer(params.id, 'base64').toString('utf8');
				log('ACCOUNT ID: ', id);
				let body;
				let ivr_body;
				let twimlStr;

				let doc = await Db.get(id);
				let ivr_id = _.result(_.find(doc.twilio.associated_numbers, {phone_number: params.To}), 'ivr_id');
				if (ivr_id != undefined) ivr_body = await Db.get(ivr_id);
				else throw new Err('Did not find an IVR record for the callee phone number', 'Critical', 'postHandlerVoice');
				
				let tResp = buildIvrTwiml(ivr_body.actions, params.id, params);
				if (typeof tResp === 'object') twimlStr = await webtaskRunApi(tResp);
				else twimlStr = tResp;

				reply.json(200, twimlStr);
				return next();
			} else throw new Err('No user ID found', 'Critical', 'postHandlerVoice');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					twimlStr = buildMessageTwiml('We\'re sorry but no IVR was found for this phone number');
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

	function postHandlerSms(request, reply, next) {
		//
	}

	async function postHandlerStatus(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		log('STATUS REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && ('id' in params)) {
				let id = new Buffer(params.id, 'base64').toString('utf8');
				
				params.id = id;
				params.type = ('SmsSid' in params) ? 'sms_status' : 'call_status';

				if (CallRouter.isQueued(params.CallSid)) CallRouter.updateCallStatus(params.CallSid, params);

				let doc = await Db.insert(params);
				if (!('ok' in doc) || !doc.ok) throw new Err('Failed to save call status record to DB', 'Info', 'postHandlerStatus');

				//whether db save failed or not return a 200OK back to Twilio
				reply.send(200);
				return next();
			} else {
				throw new Err('No parameters found', 'Critical', 'postHandlerStatus');
			}
		} catch (e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					reply.send(200);
					break;
				default:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.json(200, twimlStr);
					break;
			}
			return next();
		}
	}

	function postHandlerAction(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		try {
			if (params != undefined) {
				if ('Digits' in params) postHandlerGatherAction(request, reply, next);
				else if ('SmsSid' in params) postHandlerSmsAction(request, reply, next);
				else if ('DialCallSid' in params) postHandlerDialAction(request, reply, next);
				else postHandlerRouterAction(request, reply, next);
			} else throw new Err('No parameters found', 'Critical', 'postHandlerAction');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
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
		let params = (request != undefined) ? request.params : {};
		log('ACTION SMS REQUEST: PARAMS: ', params);
		let twimlStr = buildMessageTwiml('Your message has been sent')
	
		reply.json(200, twimlStr);
		return next();
	}

	async function postHandlerDialAction(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		try {
			if (params != undefined) {
				log('ACTION DIAL REQUEST: PARAMS: ', params);
				var id = new Buffer(params.id, 'base64').toString('utf8');
				
				params.id = id;
				params.type = 'dial_status';

				let body = await Db.insert(params);
				if (!('ok' in body) || !body.ok) throw new Err('Failed to save dial status record to DB', 'Info', 'postHandlerDialAction');
				else {
					reply.send(200);
					return next();
				}
			} else throw new Err('No parameters found', 'Critical', 'postHandlerDialAction');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					reply.send(200);
					break;
				default:
					twimlStr = buildMessageTwiml('An unrecoverable error occured');
					reply.json(200, twimlStr);
					break;
			}
			return next();
		}
	}

	function postHandlerRouterAction(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		try {
			if (params != undefined) {
				let resp;
				//var id = new Buffer(params.id, 'base64').toString('utf8');
				if (CallRouter.isActive(params.CallSid)) {
					resp = CallRouter.getResponse(params.CallSid, params.id);
					reply.json(200, resp.toString());
					return next();
				} else throw new Err('Call SID was not found', 'Critical', 'postHandlerRouterAction');
			} else throw new Err('No parameters found', 'Critical', 'postHandlerRouterAction');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					let twimlStr = buildMessageTwiml('Failed to identify call for routing');
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

	async function postHandlerGatherAction(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		log('ACTION GATHER REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && ('id' in params)) {
				let id = new Buffer(params.id, 'base64').toString('utf8');
				let twimlStr, action, gather;
				if (CACHE.has(id)) {
					//found entry in cache, build and respond with twiml
					//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
					let {gather} = CACHE.get(id);  //TODO: verify if destructuring works

					//check if the index provided in URL is that of a Gather verb
					if (gather != undefined && ('index' in gather) && gather.index === params.index) {
						//get the actions array based on the pressed ivr digit
						action = _.result(_.find(gather.nested, {nouns: {expected_digit: params.Digits}}), 'actions')[0];

						twimlStr = buildIvrTwiml(action, params.id, params);
						if ((typeof twimlStr === 'object') && ('webtask_token' in twimlStr)) twimlStr = await webtaskRunApi(twimlStr);
						reply.json(200, twimlStr);
						return next();
					}
				} else {
					//entry not in cache, query database, cache entry and respond with twiml
					let gather;
					let doc = await Db.get(id);
					if (doc != undefined) {
						let ivr_id = _.result(_.find(doc.twilio.associated_numbers, {phone_number: params.To}), 'ivr_id');
						if (ivr_id != undefined) {
							CACHE.set(id, {id: ivr_id});
							let ivr_doc = await Db.get(ivr_id);
							if (ivr_doc != undefined) {
								//get the gather verb that is responsible for the ivr with the index # provided by the API call from twilio
								gather = _.find(ivr_doc.actions, 'index', params.index);
								//if we can't find the requested gather verb, grab the first one in the IVR
								if (gather == undefined) gather = _.find(ivr_doc.actions, 'verb', 'gather');
								
								if (gather != undefined && ('nested' in gather)) {
									let c = CACHE.get(id);
									c.gather = gather;
									CACHE.set(id, c);
									if ('Digits' in params) {
										//get the actions array based on the pressed ivr digit
										let action = _.result(_.find(gather.nested, {nouns: {expected_digit: params.Digits}}), 'actions')[0];
										twimlStr = buildIvrTwiml(action, params.id, params);
										if ((typeof twimlStr === 'object') && ('webtask_token' in twimlStr)) twimlStr = await webtaskRunApi(twimlStr);
										reply.json(200, twimlStr);
										return next();
									} else throw new Err('No digits dialed by the user', 'Critical', 'postHandlerGatherAction');
								} else throw new Err('Found a GATHER verb but it has no nested actions', 'Critical', 'postHandlerGatherAction');  //client side should validate this could never happen
							} else throw new Err('IVR record not found', 'Critical', 'postHandlerGatherAction');
						} else throw new Err('No IVR_ID found in record', 'Critical', 'postHandlerGatherAction');	
					} else throw new Err('Failed to find DB record for ID', 'Critical', 'postHandlerGatherAction');
				}
			} else throw new Err('No parameters found', 'Critical', 'postHandlerGatherAction');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					let twimlStr = buildMessageTwiml('You pressed an incorrect number, please try again');
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

	async function postHandlerDequeue(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		log('ACTION DEQUEUE REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && ('id' in params)) {
				let id = new Buffer(params.id, 'base64').toString('utf8');

				params.id = id;
				params.type = 'dequeue_status';

				let doc = await Db.insert(params);

				if (!('ok' in doc) || !doc.ok) {
					CallRouter.dequeue(params.CallSid, params.QueueResult);
					throw new Err('Failed to save dequeue status record to DB', 'Info', 'postHandlerDequeue');
				} else CallRouter.dequeue(params.CallSid, params.QueueResult);
			} else {
				CallRouter.cleanUpState(params.CallSid);
				throw new Err('No parameters found', 'Critical', 'postHandlerDequeue');
			}
		} catch (e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					let twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');
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

	function postHandlerWait(request, reply, next) {
		let params = (request != undefined) ? request.params : {};
		log('QUEUE WAIT REQUEST: PARAMS: ', params);
		try {
			if (params != undefined && ('id' in params)) {
				let id = new Buffer(params.id, 'base64').toString('utf8');
				let twiml = TwimlResponse();

				if (!CallRouter.isQueued(params.CallSid)) {
					CallRouter.queue(params.CallSid, id, params);
				}

				twiml.say("You are caller " + params.QueuePosition + ". You will be connected shortly", {voice: 'woman'});
				twiml.pause({length:10});
				
				reply.json(200, twiml.toString());
				return next();
			} else throw new Err('No parameters found', 'Critical', 'postHandlerWait');
		} catch(e) {
			log(`${e.name} : ${e.type} - ${e.message}`);
			let twimlStr;
			switch (e.type) {
				case 'Info':
					reply.send(200);
					break;
				case 'Critical':
					let twimlStr = buildMessageTwiml('Something went wrong, please hungup and try again');
					reply.json(200, twimlStr);
					CallRouter.cleanUpState(params.CallSid);
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
	var rTwiml;// = TwimlResponse();
	var parser = new TwimlParser();
	var datetime = new Date();
	var params = cleanUp(vars);
	var task;
	var actions = _.cloneDeep(acts);


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

	if (CallRouter.isQueued(vars.CallSid)) CallRouter.addTask(vars.CallSid, parser.getTree());

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

	log('CALL WEBTASK')
	
	return Request({
		url: `${Config.webtask.run}/${Config.webtask.container}?key=${token}`,
		method: 'POST',
		json: true,
		body: task
	})
	.then(function(resp) {
		let headers = resp.shift();
		let body = resp.shift();

		log('WEBTASK HEADERS: ', headers)
		log('WEBTASK BODY: ', body)

		if (headers.statusCode === 200) {
			return Promise.resolve(body);
		} else {
			log('Webtask failed: ', headers.statusCode, ' = ', body);
			return Promise.reject(new Err('Failed to get response from webtask', 'Critical', 'webtaskRunApi'));
		}
	})
	.catch(function(e) {
		log('Webtask run error: ', e);
		return Promise.reject(new Err('An error in the webtask was encountered', 'Critical', 'webtaskRunApi'));
	});
}

function extractWebtaskTasks(arr) {
	return _.find(arr, {verb: 'webtask'});  //returns the first webtask action it finds or undefined
}