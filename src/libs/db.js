/* DB abstraction */
"use strict";

import config from '../../config.json';
import Promise from 'bluebird';
import Cloudant from 'cloudant';

let cloudant = Cloudant({
		account: config.cloudant.production.account,
		key: config.cloudant.production.key,
		password: config.cloudant.production.password
	});
let db = cloudant.use(config.cloudant.production.db_name);

module.exports = {
	insert: Promise.promisify(db.insert),
	search: Promise.promisify(db.search),
	get: Promise.promisify(db.get),
	remove: Promise.promisify(db.destroy)
}