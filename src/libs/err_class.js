"use strict";

class Err extends Error {
	constructor(message, type='Info', name='Default') {
		super(message);
		this.type = type,
		this.message = message,
		this.name = name,
		this.stack = (new Error()).stack
	}
}

module.exports = Err;