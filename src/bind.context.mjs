export default class bindContext {
	constructor(options) {
		for (const option of ['element','value','templates','path','list','index','parent']) {
			this[option] = options[option]
		}
		Object.freeze(this)
	}

	withoutHTML() {
		if (this.value && typeof this.value=='object') {
			if (this.value.innerHTML) {
				let options = Object.assign({},this)
				delete options.value.innerHTML
				return new bindContext(options)
			}
		} else {
			let options = Object.assign({}, this)
			delete options.value
			return new bindContext(options)
		}
		return new bindContext(this)
	}

	with(options) {
		options = Object.assign({}, this, options)
		return new bindContext(options)
	}

	without(...skippedOptions) {
		let options = Object.assign({}, this)
		for (let option of skippedOptions) {
			delete options[option]
		}
		return new bindContext(options)
	}
}