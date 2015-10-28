/* DB abstraction */
"use strict";

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _configJson = require('../../config.json');

var _configJson2 = _interopRequireDefault(_configJson);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _cloudant = require('cloudant');

var _cloudant2 = _interopRequireDefault(_cloudant);

var cloudant = (0, _cloudant2['default'])({
	account: _configJson2['default'].cloudant.production.account,
	key: _configJson2['default'].cloudant.production.key,
	password: _configJson2['default'].cloudant.production.password
});
var db = cloudant.use(_configJson2['default'].cloudant.production.db_name);

module.exports = {
	insert: _bluebird2['default'].promisify(db.insert),
	search: _bluebird2['default'].promisify(db.search),
	get: _bluebird2['default'].promisify(db.get),
	remove: _bluebird2['default'].promisify(db.destroy)
};