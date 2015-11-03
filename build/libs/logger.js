"use strict";

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _bunyan = require('bunyan');

var _bunyan2 = _interopRequireDefault(_bunyan);

module.exports = {
	RouteHandlerLogger: _bunyan2['default'].createLogger({
		name: 'CR_RouteHandler',
		streams: [{
			type: 'rotating-file',
			period: '1d',
			count: 5,
			level: 'info',
			path: '/usr/local/var/log/cr-routehandler-info.log'
		}, {
			type: 'rotating-file',
			period: '1d',
			count: 5,
			level: 'error',
			path: '/usr/local/var/log/cr-routehandler-error.log'
		}]
	}),
	WebServerLogger: _bunyan2['default'].createLogger({
		name: 'CR_WebServer',
		streams: [{
			type: 'rotating-file',
			period: '1d',
			count: 3,
			level: 'info',
			path: '/usr/local/var/log/cr-webserver-info.log'
		}, {
			type: 'rotating-file',
			period: '1d',
			count: 3,
			level: 'error',
			path: '/usr/local/var/log/cr-webserver-error.log'
		}],
		serializers: {
			req: _bunyan2['default'].stdSerializers.req
		}
	}),
	CallRouterLogger: _bunyan2['default'].createLogger({
		name: 'CR_CallRouter',
		streams: [{
			type: 'rotating-file',
			period: '1d',
			count: 3,
			level: 'info',
			path: '/usr/local/var/log/cr-callrouter-info.log'
		}, {
			type: 'rotating-file',
			period: '1d',
			count: 3,
			level: 'error',
			path: '/usr/local/var/log/cr-callrouter-error.log'
		}]
	})
};