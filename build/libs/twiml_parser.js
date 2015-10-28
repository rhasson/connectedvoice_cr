

"use strict";

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _ = require('lodash');
var config = require('../../config.json');
var Tree = require('./tree.js');

var Parser = (function () {
  /* id_key: {string} name of key in parsed object to be used as an ID.
  * ID will be used as key in the Tree to lookup ivr elements
  */

  /*:: currPos: number;*/
  /*:: list: Array<Object>;*/
  /*:: tree: Object;*/
  /*:: idKey: string;*/
  /*:: DEFAULT_QUEUE_NAME: string;*/

  function Parser(id_key /*: any*/) {
    _classCallCheck(this, Parser);

    this.currPos = 0;
    this.list = [];
    this.tree;
    this.idKey = id_key || 'index';
    this.DEFAULT_QUEUE_NAME = 'incoming';
  }

  _createClass(Parser, [{
    key: 'create',
    value: function create(records /*: Array<Object>*/) /*: any*/{
      this.currPos = 0;
      //iterate over ivr records parsing each and returning array of ivrs
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = _getIterator(records), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var item = _step.value;
          //originally "for x in arr"
          this.parse(item); //records[item]);
        }
        //iterate over parsed array of ivrs and build tree
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator['return']) {
            _iterator['return']();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.tree = this.buildTree(this.list);
      return this;
    }
  }, {
    key: 'parse',
    value: function parse(action /*: Object*/) {
      var ret = undefined;
      var self = this;

      var push = function push() {
        self.list.push({
          id: self.currPos,
          next: self.currPos + 1,
          prev: self.currPos === 0 ? undefined : self.currPos - 1,
          content: action
        });
        self.currPos++;
      };

      if (!('actions' in action) && !('nested' in action)) {
        push();
      } else if ('actions' in action) {
        push();
        for (var i in action.actions) {
          this.parse(action.actions[i]);
        }
      } else if ('nested' in action) {
        push();
        for (var i in action.nested) {
          this.parse(action.nested[i]);
        }
      }
    }
  }, {
    key: 'buildTree',
    value: function buildTree(list /*: Array<Object>*/) /*: Object*/{
      var tree = new Tree(this.idKey);

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = _getIterator(list), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var i = _step2.value;

          //console.log('ITEM: ', i);
          var item = i.content;
          if (i.prev === undefined && !('parent_id' in item) /* && !('action_for' in item) */) {
              tree.setRoot(item);
            } else if (!('parent_id' in item) && !('action_for' in item)) {
            tree.addBranch(item);
          } else if ('parent_id' in item) {
            tree.addNodeToBranch(item.parent_id, item);
          } else if ('action_for' in item) {
            tree.addNodeToBranch(item.action_for, item);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2['return']) {
            _iterator2['return']();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return tree;
    }
  }, {
    key: 'getTree',
    value: function getTree() /*: Object*/{
      return this.tree;
    }
  }, {
    key: 'buildTwiml',
    value: function buildTwiml(twimlResponse, /*: Object*/params, /*: Object*/userid /*: string*/) /*: Object*/{
      var self = this;
      if (!('legalNodes' in twimlResponse) || !('say' in twimlResponse)) return new Error('Not a valid TwiML object');
      var it = this.tree.flatWalk(); //TODO: Need to redo this
      var obj = it.next();

      while (!obj.done) {
        create(twimlResponse, obj.value);
      }

      function create(twiml, /*: Object*/node /*: Object*/) {
        var tmpl = undefined;
        var item = node.node;
        //console.log('NODE: ', node)
        try {
          switch (item.verb) {
            case 'say':
              tmpl = _.template(item.nouns.text);
              twiml.say(tmpl(params), item.verb_attributes);
              break;
            case 'dial':
              //child nodes on a dial verb means a hunting group was expected
              if (node.children > 0) {
                var o = {
                  method: "POST",
                  action: config.callbacks.DequeueUrl.replace('%userid', userid),
                  waitUrl: config.callbacks.WaitUrl.replace('%userid', userid) + '/' + item.index,
                  waitUrlMethod: "POST"
                };
                twiml.enqueue(o, userid); //setup a queue with the name of user_id to hold new callers
              } else {
                  item.verb_attributes.method = "POST";
                  item.verb_attributes.action = config.callbacks.ActionUrl.replace('%userid', userid) + '/' + item.index;
                  twiml.dial(item.verb_attributes, function (child) {
                    /*   if (node.children > 0) {
                         obj = it.next();
                         create(child, obj.value);
                       } else */
                    if ('number' in item.nouns) {
                      for (var j = 0; j < item.nouns.number.length; j++) {
                        child.number(item.nouns.number[j]);
                      }
                    } else child.text = item.nouns.text;
                  });
                }
              break;
            case 'group':
              if ('number' in twiml && typeof twiml.number === 'function') {
                try {
                  var temp = JSON.parse(item.nouns.text);
                  if (temp.length > 10) temp = temp.slice(0, 10); //API only allows 10 numbers per DIAL verb
                  temp = _.sortBy(temp, 'priority');
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (var _iterator3 = _getIterator(temp), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                      var i = _step3.value;

                      twiml.number(i.phone_number);
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                        _iterator3['return']();
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
                    }
                  }
                } catch (e) {
                  break;
                }
              }
              break;
            case 'hangup':
              twiml.hangup();
              break;
            case 'gather':
              item.verb_attributes.method = "POST";
              item.verb_attributes.action = config.callbacks.ActionUrl.replace('%userid', userid);
              item.verb_attributes.action += '/' + item.index;
              console.log('GATHER: ', item);
              twiml.gather(item.verb_attributes, function (child) {
                for (var i = 0; i < node.children; i++) {
                  obj = it.next();
                  create(child, obj.value);
                }
              });
              break;
            case 'pause':
              twiml.pause(item.verb_attributes);
              break;
            case 'reject':
              twiml.pause(item.verb_attributes);
              break;
            case 'message':
              item.verb_attributes.method = 'POST';
              item.verb_attributes.action = config.callbacks.ActionUrl.replace('%userid', userid);
              item.verb_attributes.action += '/' + item.index;
              item.verb_attributes.statusCallback = config.callbacks.StatusCallback.replace('%userid', userid);
              tmpl = _.template(item.nouns.body);
              twiml.sms(tmpl(params), item.verb_attributes);
              break;
          }
          return obj = it.next();
        } catch (e) {
          console.log(e);
          return obj = it.next();
        }
      }
      return twimlResponse;
    }
  }, {
    key: 'find',
    value: function find(id, /*: any*/val /*: Object*/) /*: Object*/{
      if (arguments.length === 1) return this.tree.findById(id);else if (arguments.length === 2) return this.tree.findByHash(id, val);else return new Error('Invalid number of arguments');
    }
  }]);

  return Parser;
})();

module.exports = Parser;

/* Usage:
let p = new Parser();
let twiml = p.create(ivrs).buildTwiml(Twilio.TwimlResponse());
let j = JSON.stringify(p.create(ivrs));

twiml.toString();

//finds a record by the branch id
p.find("1436988415019");

//find a record by that matches the key and value
p.find('verb', 'dial');
*/