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
				if (!target[property]) {
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