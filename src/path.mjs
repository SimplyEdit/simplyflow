const path = {
	get(dataset, pointer) {
		if (typeof pointer !== 'string') {
			return pointer
		}
		if (!pointer) {
			return dataset
		}
		return pointer.split('.').reduce(function(acc, name) {
	        if (acc == null) {
	            return null
	        }
	        if (!Reflect.has(Object(acc), name)) {
	            return null
	        }
	        return acc[name]
	    }, dataset)
	},
	set: function(dataset, pointer, value) {
		const parent = path.get(dataset, path.parent(pointer))
		parent[path.pop(pointer)] = value
	},
	pop: function(pointer) {
		return pointer.split('.').pop()
	},
	push: function(pointer, name) {
		return (pointer ? pointer + '.' : '') + name
	},
	parent: function(pointer) {
		const names = pointer.split('.')
		names.pop()
		return names.join('.')
	},
	parents: function(dataset, pointer) {
		let result = []
		while (pointer) {
			pointer = path.parent(pointer)
			result.unshift(pointer)
		}
		return result
	}
}

export default path
