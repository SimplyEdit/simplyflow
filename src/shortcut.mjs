const shortcutState = new WeakMap()
const accesskeyState = new WeakMap()

const KEY = Object.freeze({
	Compose: 229,
	Control: 17,
	Meta:    224,
	Alt:     18,
	Shift:   16
})

class SimplyShortcuts
{
	constructor(options = {})
	{
		if (!options.app) {
			options.app = {}
		}
		if (!options.app.container) {
			options.app.container = document.body
		}
		Object.assign(this, options.shortcuts)

		const keyHandler = (e) => {
			let shortcutScopes = []
			let shortcutElement = e.target.closest('[data-simply-shortcuts]')
			while (shortcutElement) {
				shortcutScopes.push(shortcutElement.dataset.simplyShortcuts)
				shortcutElement = shortcutElement.parentNode.closest('[data-simply-shortcuts]')
			}
			if (shortcutScopes[shortcutScopes.length-1]!='default') {
				shortcutScopes.push('default')
			}

			let shortcutScope
			let separators = ['+','-']

			for (let separator of separators) {
				const keyString = getKeyString(e, separator)
				for (let i in shortcutScopes) {
					shortcutScope = shortcutScopes[i]
					if (this[shortcutScope] && (typeof this[shortcutScope][keyString]=='function')) {
						let _continue = this[shortcutScope][keyString].call(options.app, e)
						if (!_continue) {
							e.preventDefault()
							return
						}
					}
					if (typeof this[shortcutScope + '.' + keyString] == 'function') {
						let _continue = this[shortcutScope + '.' + keyString].call(options.app, e)
						if (!_continue) {
							e.preventDefault()
							return
						}					
					}
					if (typeof this[keyString] == 'function') {
						let _continue = this[keyString].call(options.app, e)
						if (!_continue) {
							e.preventDefault()
							return
						}					
					}
				}
			}
		}

		const container = options.app.container
		container.addEventListener('keydown', keyHandler)
		shortcutState.set(this, { container, keyHandler })
	}
}

function getKeyString(e, separator='+')
{
	if (e.isComposing || e.keyCode === KEY.Compose) {
	    return
	}
	if (e.defaultPrevented) {
	    return
	}
	if (!e.target) {
	    return
	}

	let keyCombination = []
	if (e.ctrlKey && e.keyCode!=KEY.Control) {
	    keyCombination.push('Control')
	}
	if (e.metaKey && e.keyCode!=KEY.Meta) {
	    keyCombination.push('Meta')
	}
	if (e.altKey && e.keyCode!=KEY.Alt) {
	    keyCombination.push('Alt')
	}
	if (e.shiftKey && e.keyCode!=KEY.Shift) {
	    keyCombination.push('Shift')
	}
	keyCombination.push(e.key.toLowerCase())
	return keyCombination.join(separator)
}

export function shortcuts(options={})
{
	return new SimplyShortcuts(options)
}

export function destroyShortcuts(shortcutApi)
{
	const state = shortcutState.get(shortcutApi)
	if (!state) {
		return
	}
	state.container.removeEventListener('keydown', state.keyHandler)
	shortcutState.delete(shortcutApi)
}

export function accesskeys(options={}) {
	const container = options.container || options.app?.container || document.body
	const keyHandler = (e) => {
		const separators = ["+", "-"]
		for (const separator of separators) {
			const keyString = getKeyString(e, separator)
			const selector = "[data-simply-accesskey='" + keyString + "']"
			const targets = container.querySelectorAll(selector)
			if (targets.length) {
				targets.forEach(function(target) {
					target.click()
				})
			}
		}
	}
	container.addEventListener('keydown', keyHandler)
	const controller = {}
	accesskeyState.set(controller, { container, keyHandler })
	return controller
}

export function destroyAccesskeys(accesskeyApi)
{
	const state = accesskeyState.get(accesskeyApi)
	if (!state) {
		return
	}
	state.container.removeEventListener('keydown', state.keyHandler)
	accesskeyState.delete(accesskeyApi)
}
