"use strict";

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var Err = (function (_Error) {
	_inherits(Err, _Error);

	function Err(message) {
		var type = arguments.length <= 1 || arguments[1] === undefined ? 'Info' : arguments[1];
		var name = arguments.length <= 2 || arguments[2] === undefined ? 'Default' : arguments[2];

		_classCallCheck(this, Err);

		_get(Object.getPrototypeOf(Err.prototype), 'constructor', this).call(this, message);
		this.type = type, this.message = message, this.name = name, this.stack = new Error().stack;
	}

	return Err;
})(Error);

module.exports = Err;