/* @flow */

"use strict";

import _ from 'lodash';
import Db from './db.js';
import Lru from 'lru-cache';
import Twilio from 'twilio';
import Err from './err_class.js';
import Config from '../../config.json';

let log = console.log;

let lru_options = {
		max: 1000,
		length: function(n) { return 1 },  //since we're counting objects, this tells the cache that every entry set count as 1
		maxAge: 1000 * 60 * 60
	};

class CallRouter {
	// Flow annotations.
	
	/*:: client: Object; */
	/*:: activeCalls: Object; */
	/*:: pendingCalls: Object; */
	/*:: failedCalls: Object; */
	/*:: pendingTasks: Object; */
	/*:: activeTasks: Object; */
	/*:: callChannel: Object; */
	
	constructor() {
		this.client = new Twilio.RestClient(Config.twilio.production.account_sid, Config.twilio.production.auth_token);
		this.activeCalls = Lru(lru_options);
		this.pendingCalls = Lru(lru_options);
		this.failedCalls = Lru(lru_options);
		this.pendingTasks = Lru(lru_options);
		this.activeTasks = Lru(lru_options);

		this.callChannel = {};

		Object.observe(this.callChannel, this.processCallChannel.bind(this));
	}

	processCallChannel(changes) {
		let value = changes.shift();
		if (value != undefined) {
			if (value.type === 'add') {
				this.processCalls(value.object[value.name]);
			}
		}
	}

	//queue new calls passing queue_sid, call_side, and params object
	queue(csid/*: string*/, userid/*: string*/, params/*:Object*/) {
		params.id = userid;
		this.pendingCalls.set(csid, params);
		this.callChannel[csid] = params;
	}

	//remove a call from the pedingCall queue
	dequeue(csid/*: string*/, status/*: string*/) {
		let self = this;
		let promises = [];

		if (status === 'hangup') {
			let a_call = this.activeCalls.get(csid);
			let p_call = this.pendingCalls.get(csid);

			let promises = [];
			promises[0] = this.hangupCall(a_call);
			promises[1] = this.hangupCall(p_call);

			Promise.all(promises)
			.then(function(resp) {
				log('CallRouter:Dequeue - clearing state - ', resp)
				self.activeCalls.del(csid);
				self.pendingCalls.del(csid);
			})
			.catch(function(err) {
				log('CallRouter:Dequeue|hangup - failed to hangup call - ', err);
			});
		} else if (status === 'queue-full') {
			log('CallRouter:Dequeue|Queue-Full');
			this.activeCalls.del(csid);
			this.pendingCalls.del(csid);
		} else if (status === 'system-error' || status === 'error') {
			log('CallRouter: Dequeue|Error');
			if (this.activeCalls.has(csid)) {
				let call = this.activeCalls.get(csid);
				this.hangupCall(call);
				self.activeCalls.del(csid);
			}
			this.pendingCalls.del(csid);
		} else if (status === 'bridged' || status === 'leave' || status === 'redirected') {
			let call = this.pendingCalls.get(csid);
			this.activeCalls.set(csid, call);
			this.pendingCalls.del(csid);
		} else {
			this.cleanUpState(csid);
		}
	}

	//returns boolean based on if the call sid is in the pending queue
	isQueued(csid/*: string*/) /*: Boolean*/{
		return this.pendingCalls.has(csid) || this.activeCalls.has(csid);
	}

	//check if a particular call sid is in the active state
	isActive(csid/*: string*/) /*: Boolean*/{
		log('isActive: ', csid)
		return this.activeCalls.has(csid);
	}

	updateCallStatus(csid/*: string*/, call/*: Object*/) {
		if (('AnsweredBy' in call) && call.AnsweredBy === 'machine') {
			if (call.CallStatus === 'completed') {
				let active_call = this.activeCalls.get(csid);
				if (active_call != undefined) {
					this.cleanUpState(csid);
					this.callNextNumber(active_call.original_csid);
				}
			}
		}
	}

	addTask(csid/*: string*/, task/*: Object*/) {
		log('Adding Task to: ', csid)
		log('TASK: ', task)
		this.pendingTasks.set(csid, task);
	}

	getResponse(csid/*: string*/, userid/*: string*/) /*: Object*/{
		let twiml = Twilio.TwimlResponse();
		let call = this.activeCalls.get(csid);

		if (this.pendingCalls.has(call.original_csid)) {
			twiml.dial({
				method: 'POST', 
				action: Config.callbacks.ActionUrl.replace('%userid', userid),
			}, function(node) {
				node.queue(userid);  //userid is used as the queue name
			});
		} else {
			twiml.say('We could not connect your call at this time.  Please try again later', {voice: 'woman'});
			twiml.hangup();
			this.cleanUpState(csid);
			this.cleanUpState(call.original_csid);
		}

		return twiml;
	}

	hangupCall(call/*: Object*/) /*: Object*/{
		console.log('Hanging up - ', call)
		return new Promise(function(resolve, reject) {
			if (!call) return resolve();

			this.client.accounts(call.AccountSid).calls(call.CallSid).update({
				status: "completed"
			})
			.then(function() { return resolve(); })
			.fail(function(e) { return reject(e); })
		});
	}

	callNextNumber(csid/*: string*/) {
		let pending_call = this.pendingCalls.get(csid);

		if (pending_call != undefined) {
			this.queue(pending_call.CallSid, pending_call.id, pending_call);
		}
	}

	processCalls(pending_call) /*: any*/{
		let self = this;
		log('Processing Call')
		return new Promise(async function(resolve, reject) {
			if (pending_call != undefined) {
				delete self.callChannel[pending_call.CallSid];
				try {
					let to_number = await self.getToNumber(pending_call.CallSid, pending_call.index);
					log('TO: ', to_number)
					//if (to_number instanceof Error) throw new Err(to_number.message, 'Critical', 'CallRouter:processCalls');
					if (to_number != undefined && pending_call != undefined) {
						let number = to_number.phone_number;
						let new_call = await self.makeCall(number, pending_call);

						if (new_call != undefined) {
							log('NEW CALL: ', new_call)
							new_call.original_csid = pending_call.CallSid;
							let call = formatCallResponseData(new_call, pending_call.id)
							self.activeCalls.set(call.CallSid, call);
							return resolve();
						} else throw new Err('Failed to make new call', 'Critical:1', 'CallRouter:processCalls');
					} else throw new Err('Failed to get number to call', 'Critical', 'CallRouter:processCalls');
				} catch(e) { 
					log(`${e.name} : ${e.type} - ${e.message}`);
					switch (e.type) {
						case 'Info':
							return resolve();
							break;
						case 'Critical':
							return reject();
							break;
						case 'Critical:1':
							let retries = ('_retries' in pending_call) ? pending_call['_retries'] : 3;
							retries--;
							pending_call['_retries'] = retries;

							if (pending_call['_retries'] > 0) {
								log('Retrying Call');
								setTimeout(self.queue(pending_call.CallSid, pending_call.id, pending_call), 2000);
							} else {
								log('Failed to place call after 3 tries.  Giving up');
								self.pendingCalls.del(pending_call.CallSid);
							}
							break;
						default:
							return reject();
							break;
					}
				}
			}
		});
	}
	
	makeCall(number/*: string*/, params/*: Object*/) /*: Object*/{
		let self = this;
		let userid = new Buffer(params.id, 'utf8').toString('base64');
		log('CallRouter:makeCall - Making outgoing API call');
		return new Promise(function(resolve, reject) {
			self.client.accounts(params.AccountSid/*subaccount sid which owns the tn*/).calls.create({
				url: Config.callbacks.ActionUrl.replace('%userid', userid) + '/' + params.index,
				method: 'POST',
				to: number,
				from: params.To,
				ifMachine: 'hangup',
				statusCallback: Config.callbacks.StatusCallback.replace('%userid', userid),
				statusCallbackMethod: 'POST'
			})
			.then(function(resp) { return resolve(resp); })
			.fail(function(e) { return reject(e); });
		});
	}

	getToNumber(csid/*: string*/, index/*: string*/) /*: any*/{
		let self = this;
		return new Promise(function(resolve, reject) {
			if (self.activeTasks.has(csid)) {
				let numbers = self.activeTasks.get(csid);
				let num = _.find(numbers, {'isUsed': false});
				let idx;
				if (num) {
					idx = _.indexOf(numbers, num);
					num.isUsed = true;
					numbers[idx] = num;
					self.activeTasks.set(csid, numbers);
					return resolve(num);
				} else {
					//all numbers are used up.  try again
					numbers = _.sortBy(_.map(numbers, (i) => { i.isUsed = false; return i; }), 'priority');
					numbers[0].isUsed = true;
					self.activeTasks.set(csid, numbers);
					return resolve(numbers[0]);
				}
			} else {
				let tree = self.pendingTasks.get(csid);
				let actions = tree ? tree.findChildrenOfByHash('index', index, true) : [];
				let numbers;
				if (actions.length) {
					let group_id = _.result(_.find(actions, {'verb': 'group'}), 'nouns.text');
					return Db.get(group_id).then(function(body) {
						if (body != undefined) {
							numbers = _.sortBy(_.map(body.members, (i) => { i.isUsed = false; return i; }), 'priority');  //initialize each number in the group as not used and sort by priority
							numbers[0].isUsed = true;
							self.activeTasks.set(csid, numbers);
							self.pendingTasks.del(csid);
							return resolve(numbers[0]);
						} else return reject(new Err('Returned empty document when looking for group members'));
					})
					.catch(function(err) {
						return reject(new Err('Failed to get group members from database - ', err));
					});
				} else return reject(new Err('No valid task found'));
			}
		});
	}

	cleanUpState(csid/*: string*/) {
		let call = this.activeCalls.get(csid);
		if (call != undefined) this.hangupCall(call);

		this.pendingCalls.del(csid);
		this.activeCalls.del(csid);
		this.pendingTasks.del(csid);
		this.activeTasks.del(csid);
	}
}

function formatCallResponseData(call/*: Object*/, userid/*: string*/) {
	let c = {};
	_.assign(c, call);
	c.id = userid;
	c.CallSid = c.sid;
	c.AccountSid = c.account_sid;
	c.To = c.to;
	c.From = c.from;

	return c;
}


module.exports = new CallRouter();