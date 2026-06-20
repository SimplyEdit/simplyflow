import { closest } from './suggest.mjs'

const warnedUnknownActions = new WeakMap()

export function actions(options) 
{
	if (options.app) {
		const functionHandler = {
			apply(target, thisArg, argumentsList)
			{
				try {
					const result = target(...argumentsList)
					if (result instanceof Promise) {
						return result.catch(err => {
							return options.app.onError.call(this, err, target)
						})							
					}
					return result
				} catch(err) {
					return options.app.onError.call(this, err, target)
				}
			}
		}

		const actionHandler = {
			get(target, property)
			{
				if (!Object.hasOwn(target, property)) {
					warnUnknownAction(target, property)
					return undefined
				}
				if (options.app.onError) {
					return new Proxy(target[property].bind(options.app), functionHandler)
				} else {
					return target[property].bind(options.app)
				}
			}
		}
		return new Proxy(options.actions, actionHandler)
	} else {
		return options
	}
}

function warnUnknownAction(actions, property)
{
	if (typeof property !== 'string') {
		return
	}

	let warned = warnedUnknownActions.get(actions)
	if (!warned) {
		warned = new Set()
		warnedUnknownActions.set(actions, warned)
	}
	if (warned.has(property)) {
		return
	}
	warned.add(property)

	const suggestion = closest(property, Object.keys(actions))
	const suffix = suggestion ? `. Did you mean "${suggestion}"?` : ''
	console.warn(`simplyflow/action: unknown action "${property}"${suffix}`)
}
