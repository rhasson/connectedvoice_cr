"use strict";

import Logger from 'bunyan';

module.exports = {
	RouteHandlerLogger: Logger.createLogger({
		name: 'CR_RouteHandler',
		streams: [
			{
				type: 'rotating-file',
				period: '1d',
				count: 5,
				level: 'info',
				path: './logs/cr-routehandler-info.log'
			},
			{
				type: 'rotating-file',
				period: '1d',
				count: 5,
				level: 'error',
				path: './logs/cr-routehandler-error.log'
			}
		]
	}),
	WebServerLogger: Logger.createLogger({
		name: 'CR_WebServer',
		streams: [
			{
				type: 'rotating-file',
				period: '1d',
				count: 3,
				level: 'info',
				path: './logs/cr-webserver-info.log'
			},
			{
				type: 'rotating-file',
				period: '1d',
				count: 3,
				level: 'error',
				path: './logs/cr-webserver-error.log'
			}
		],
		serializers: {
			req: Logger.stdSerializers.req
		}
	}),
	CallRouterLogger: Logger.createLogger({
		name: 'CR_CallRouter',
		streams: [
			{
				type: 'rotating-file',
				period: '1d',
				count: 3,
				level: 'info',
				path: './logs/cr-callrouter-info.log'
			},
			{
				type: 'rotating-file',
				period: '1d',
				count: 3,
				level: 'error',
				path: './logs/cr-callrouter-error.log'
			}
		]
	})
}