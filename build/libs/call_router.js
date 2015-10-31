

"use strict";

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

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

var _configJson = require('../../config.json');

var _configJson2 = _interopRequireDefault(_configJson);

var log = console.log;

var lru_options = {
	max: 1000,
	length: function length(n) {
		return 1;
	}, //since we're counting objects, this tells the cache that every entry set count as 1
	maxAge: 1000 * 60 * 60
};

var CallRouter = (function () {
	// Flow annotations.

	/*:: client: Object; */
	/*:: activeCalls: Object; */
	/*:: pendingCalls: Object; */
	/*:: failedCalls: Object; */
	/*:: pendingTasks: Object; */
	/*:: activeTasks: Object; */
	/*:: callChannel: Object; */

	function CallRouter() {
		_classCallCheck(this, CallRouter);

		this.client = new _twilio2['default'].RestClient(_configJson2['default'].twilio.production.account_sid, _configJson2['default'].twilio.production.auth_token);
		this.activeCalls = (0, _lruCache2['default'])(lru_options);
		this.pendingCalls = (0, _lruCache2['default'])(lru_options);
		this.failedCalls = (0, _lruCache2['default'])(lru_options);
		this.pendingTasks = (0, _lruCache2['default'])(lru_options);
		this.activeTasks = (0, _lruCache2['default'])(lru_options);

		this.callChannel = {};

		Object.observe(this.callChannel, this.processCallChannel.bind(this));
	}

	_createClass(CallRouter, [{
		key: 'processCallChannel',
		value: function processCallChannel(changes) {
			var value = changes.shift();
			if (value != undefined) {
				if (value.type === 'add') {
					this.processCalls(value.object[value.name]);
				}
			}
		}

		//queue new calls passing queue_sid, call_side, and params object
	}, {
		key: 'queue',
		value: function queue(csid, /*: string*/userid, /*: string*/params /*:Object*/) {
			params.id = userid;
			this.pendingCalls.set(csid, params);
			this.callChannel[csid] = params;
		}

		//remove a call from the pedingCall queue
	}, {
		key: 'dequeue',
		value: function dequeue(csid, /*: string*/status /*: string*/) {
			var self = this;
			var promises = [];

			if (status === 'hangup') {
				var a_call = this.activeCalls.get(csid);
				var p_call = this.pendingCalls.get(csid);

				var _promises = [];
				_promises[0] = this.hangupCall(a_call);
				_promises[1] = this.hangupCall(p_call);

				_Promise.all(_promises).then(function (resp) {
					log('CallRouter:Dequeue - clearing state - ', resp);
					self.activeCalls.del(csid);
					self.pendingCalls.del(csid);
				})['catch'](function (err) {
					log('CallRouter:Dequeue|hangup - failed to hangup call - ', err);
				});
			} else if (status === 'queue-full') {
				log('CallRouter:Dequeue|Queue-Full');
				this.activeCalls.del(csid);
				this.pendingCalls.del(csid);
			} else if (status === 'system-error' || status === 'error') {
				log('CallRouter: Dequeue|Error');
				if (this.activeCalls.has(csid)) {
					var call = this.activeCalls.get(csid);
					this.hangupCall(call);
					self.activeCalls.del(csid);
				}
				this.pendingCalls.del(csid);
			} else if (status === 'bridged' || status === 'leave' || status === 'redirected') {
				var call = this.pendingCalls.get(csid);
				this.activeCalls.set(csid, call);
				this.pendingCalls.del(csid);
			} else {
				this.cleanUpState(csid);
			}
		}

		//returns boolean based on if the call sid is in the pending queue
	}, {
		key: 'isQueued',
		value: function isQueued(csid /*: string*/) /*: Boolean*/{
			return this.pendingCalls.has(csid) || this.activeCalls.has(csid);
		}

		//check if a particular call sid is in the active state
	}, {
		key: 'isActive',
		value: function isActive(csid /*: string*/) /*: Boolean*/{
			log('isActive: ', csid);
			return this.activeCalls.has(csid);
		}
	}, {
		key: 'updateCallStatus',
		value: function updateCallStatus(csid, /*: string*/call /*: Object*/) {
			if ('AnsweredBy' in call && call.AnsweredBy === 'machine') {
				if (call.CallStatus === 'completed') {
					var active_call = this.activeCalls.get(csid);
					if (active_call != undefined) {
						this.cleanUpState(csid);
						this.callNextNumber(active_call.original_csid);
					}
				}
			}
		}
	}, {
		key: 'addTask',
		value: function addTask(csid, /*: string*/task /*: Object*/) {
			log('Adding Task to: ', csid);
			//log('TASK: ', task)
			this.pendingTasks.set(csid, task);
		}
	}, {
		key: 'getResponse',
		value: function getResponse(csid, /*: string*/userid /*: string*/) /*: Object*/{
			var twiml = _twilio2['default'].TwimlResponse();
			var call = this.activeCalls.get(csid);

			if (this.pendingCalls.has(call.original_csid)) {
				twiml.dial({
					method: 'POST',
					action: _configJson2['default'].callbacks.ActionUrl.replace('%userid', userid)
				}, function (node) {
					node.queue(userid); //userid is used as the queue name
				});
			} else {
					twiml.say('We could not connect your call at this time.  Please try again later', { voice: 'woman' });
					twiml.hangup();
					this.cleanUpState(csid);
					this.cleanUpState(call.original_csid);
				}

			return twiml;
		}
	}, {
		key: 'hangupCall',
		value: function hangupCall(call /*: Object*/) /*: Object*/{
			log('Hanging up - ', call);
			return new _Promise(function (resolve, reject) {
				if (!call) return resolve();

				this.client.accounts(call.AccountSid).calls(call.CallSid).update({
					status: "completed"
				}).then(function () {
					return resolve();
				}).fail(function (e) {
					return reject(e);
				});
			});
		}
	}, {
		key: 'callNextNumber',
		value: function callNextNumber(csid /*: string*/) {
			var pending_call = this.pendingCalls.get(csid);

			if (pending_call != undefined) {
				this.queue(pending_call.CallSid, pending_call.id, pending_call);
			}
		}
	}, {
		key: 'processCalls',
		value: function processCalls(pending_call) /*: any*/{
			var self = this;
			log('Processing Call');
			return new _Promise(function callee$2$0(resolve, reject) {
				var to_number, number, new_call, call, retries;
				return _regeneratorRuntime.async(function callee$2$0$(context$3$0) {
					while (1) switch (context$3$0.prev = context$3$0.next) {
						case 0:
							if (!(pending_call != undefined)) {
								context$3$0.next = 43;
								break;
							}

							delete self.callChannel[pending_call.CallSid];
							context$3$0.prev = 2;
							context$3$0.next = 5;
							return _regeneratorRuntime.awrap(self.getToNumber(pending_call.CallSid, pending_call.index));

						case 5:
							to_number = context$3$0.sent;

							log('TO: ', to_number);
							//if (to_number instanceof Error) throw new Err(to_number.message, 'Critical', 'CallRouter:processCalls');

							if (!(to_number != undefined && pending_call != undefined)) {
								context$3$0.next = 23;
								break;
							}

							number = to_number.phone_number;
							context$3$0.next = 11;
							return _regeneratorRuntime.awrap(self.makeCall(number, pending_call));

						case 11:
							new_call = context$3$0.sent;

							if (!(new_call != undefined)) {
								context$3$0.next = 20;
								break;
							}

							log('NEW CALL: ', new_call);
							new_call.original_csid = pending_call.CallSid;
							call = formatCallResponseData(new_call, pending_call.id);

							self.activeCalls.set(call.CallSid, call);
							return context$3$0.abrupt('return', resolve());

						case 20:
							throw new _err_classJs2['default']('Failed to make new call', 'Critical:1', 'CallRouter:processCalls');

						case 21:
							context$3$0.next = 24;
							break;

						case 23:
							throw new _err_classJs2['default']('Failed to get number to call', 'Critical', 'CallRouter:processCalls');

						case 24:
							context$3$0.next = 43;
							break;

						case 26:
							context$3$0.prev = 26;
							context$3$0.t0 = context$3$0['catch'](2);

							log(context$3$0.t0.name + ' : ' + context$3$0.t0.type + ' - ' + context$3$0.t0.message);
							context$3$0.t1 = context$3$0.t0.type;
							context$3$0.next = context$3$0.t1 === 'Info' ? 32 : context$3$0.t1 === 'Critical' ? 34 : context$3$0.t1 === 'Critical:1' ? 36 : 41;
							break;

						case 32:
							return context$3$0.abrupt('return', resolve());

						case 34:
							return context$3$0.abrupt('return', reject());

						case 36:
							retries = '_retries' in pending_call ? pending_call['_retries'] : 3;

							retries--;
							pending_call['_retries'] = retries;

							if (pending_call['_retries'] > 0) {
								log('Retrying Call');
								setTimeout(self.queue(pending_call.CallSid, pending_call.id, pending_call), 2000);
							} else {
								log('Failed to place call after 3 tries.  Giving up');
								self.pendingCalls.del(pending_call.CallSid);
							}
							return context$3$0.abrupt('break', 43);

						case 41:
							return context$3$0.abrupt('return', reject());

						case 43:
						case 'end':
							return context$3$0.stop();
					}
				}, null, this, [[2, 26]]);
			});
		}
	}, {
		key: 'makeCall',
		value: function makeCall(number, /*: string*/params /*: Object*/) /*: Object*/{
			var self = this;
			var userid = new Buffer(params.id, 'utf8').toString('base64');
			log('CallRouter:makeCall - Making outgoing API call');
			return new _Promise(function (resolve, reject) {
				self.client.accounts(params.AccountSid /*subaccount sid which owns the tn*/).calls.create({
					url: _configJson2['default'].callbacks.ActionUrl.replace('%userid', userid) + '/' + params.index,
					method: 'POST',
					to: number,
					from: params.To,
					ifMachine: 'hangup',
					statusCallback: _configJson2['default'].callbacks.StatusCallback.replace('%userid', userid),
					statusCallbackMethod: 'POST'
				}).then(function (resp) {
					return resolve(resp);
				}).fail(function (e) {
					return reject(e);
				});
			});
		}
	}, {
		key: 'getToNumber',
		value: function getToNumber(csid, /*: string*/index /*: string*/) /*: any*/{
			var self = this;
			return new _Promise(function (resolve, reject) {
				if (self.activeTasks.has(csid)) {
					var numbers = self.activeTasks.get(csid);
					var num = _lodash2['default'].find(numbers, { 'isUsed': false });
					var idx = undefined;
					if (num) {
						idx = _lodash2['default'].indexOf(numbers, num);
						num.isUsed = true;
						numbers[idx] = num;
						self.activeTasks.set(csid, numbers);
						return resolve(num);
					} else {
						//all numbers are used up.  try again
						numbers = _lodash2['default'].sortBy(_lodash2['default'].map(numbers, function (i) {
							i.isUsed = false;return i;
						}), 'priority');
						numbers[0].isUsed = true;
						self.activeTasks.set(csid, numbers);
						return resolve(numbers[0]);
					}
				} else {
					var _ret = (function () {
						var tree = self.pendingTasks.get(csid);
						var actions = tree ? tree.findChildrenOfByHash('index', index, true) : [];
						var numbers = undefined;
						if (actions.length) {
							var group_id = _lodash2['default'].result(_lodash2['default'].find(actions, { 'verb': 'group' }), 'nouns.text');
							return {
								v: _dbJs2['default'].get(group_id).then(function (body) {
									if (body != undefined) {
										numbers = _lodash2['default'].sortBy(_lodash2['default'].map(body.members, function (i) {
											i.isUsed = false;return i;
										}), 'priority'); //initialize each number in the group as not used and sort by priority
										numbers[0].isUsed = true;
										self.activeTasks.set(csid, numbers);
										self.pendingTasks.del(csid);
										return resolve(numbers[0]);
									} else return reject(new _err_classJs2['default']('Returned empty document when looking for group members'));
								})['catch'](function (err) {
									return reject(new _err_classJs2['default']('Failed to get group members from database - ', err));
								})
							};
						} else return {
								v: reject(new _err_classJs2['default']('No valid task found'))
							};
					})();

					if (typeof _ret === 'object') return _ret.v;
				}
			});
		}
	}, {
		key: 'cleanUpState',
		value: function cleanUpState(csid /*: string*/) {
			var call = this.activeCalls.get(csid);
			if (call != undefined) this.hangupCall(call);

			this.pendingCalls.del(csid);
			this.activeCalls.del(csid);
			this.pendingTasks.del(csid);
			this.activeTasks.del(csid);
		}
	}]);

	return CallRouter;
})();

function formatCallResponseData(call, /*: Object*/userid /*: string*/) {
	var c = {};
	_lodash2['default'].assign(c, call);
	c.id = userid;
	c.CallSid = c.sid;
	c.AccountSid = c.account_sid;
	c.To = c.to;
	c.From = c.from;

	return c;
}

module.exports = new CallRouter();