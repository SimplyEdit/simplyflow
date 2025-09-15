import {signal, effect, batch} from './state.mjs'

/**
 * This class implements a pluggable data model, where you can
 * add effects that are run only when either an option for that
 * effect changes, or when an effect earlier in the chain of
 * effects changes.
 */
class SimplyFlowModel {

	/**
	 * Creates a new datamodel, with a state property that contains
	 * all the data passed to this constructor
	 * @param state	Object with all the data for this model
	 */
	constructor(state) {
		this.state = signal(state)
		if (!this.state.options) {
			this.state.options = {}
		}
		this.effects = [{current:state.data}]
		this.view = signal(state.data)
	}

	/**
	 * Adds an effect to run whenever a signal it depends on
	 * changes. this.state is the usual signal.
	 * The `fn` function param is not itself an effect, but must return
	 * and effect function. `fn` takes one param, which is the data signal.
	 * This signal will always have at least a `current` property.
	 * The result of the effect function is pushed on to the this.effects
	 * list. And the last effect added is set as this.view
	 */
	addEffect(fn) {
		const dataSignal = this.effects[this.effects.length-1]
		this.view = fn.call(this, dataSignal)
		this.effects.push(this.view)
	}
}

export function model(options) {
	return new SimplyFlowModel(options)
}

/**
 * Returns a function for model.addEffect that sorts the input data
 * 
 * Options:
 * - direction (string) default 'asc' - change to 'desc' to sort in descending order
 * - sortBy (string) (optional) - used by the default sorting function to select the property to sort on
 * - sortFn (function) (required - set by default) - the sort function to use
 */
export function sort(options={}) {
	return function(data) {
		// initialize the sort options, only gets called once
		this.state.options.sort = Object.assign({
			direction: 'asc',
			sortBy: null,
			sortFn: ((a,b) => {
				const sort = this.state.options.sort
				const sortBy = sort.sortBy
				if (!sort.sortBy) {
					return 0
				}
				const larger = sort.direction == 'asc' ? 1 : -1
				const smaller = sort.direction == 'asc' ? -1 : 1
				if (typeof a?.[sortBy] === 'undefined') {
					if (typeof b?.[sortBy] === 'undefined') {
						return 0
					}
					return larger
				}
				if (typeof b?.[sortBy] === 'undefined') {
					return smaller
				}
				if (a[sortBy]<b[sortBy]) {
					return smaller
				} else if (a[sortBy]>b[sortBy]) {
					return larger
				} else {
					return 0
				}
			})
		}, options);
		// then return the effect, which is called when
		// either the data or the sort options change
		return effect(() => {
			const sort = this.state.options.sort
			if (sort?.sortBy && sort?.direction) {
				return data.current.toSorted(sort?.sortFn)
			}
			return data.current
		})
	}
}

/**
 * Returns a function for model.addEffect that implements paging
 * for the input data. It will return a slice of the data matching
 * the page and pageSize options.
 * 
 * Options:
 * - page (int) default 1 - which page to show, starts at 1
 * - pageSize (int) default 20 - how many items in a single page
 * - max (int) (calculated) - how many pages in total
 */
export function paging(options={}) {
	return function(data) {
		// initialize the paging options
		this.state.options.paging = Object.assign({
			page: 1,
			pageSize: 20,
			max: 1
		}, options)
		return effect(() => {
			return batch(() => {
				const paging = this.state.options.paging
				if (!paging.pageSize) {
					paging.pageSize = 20
				}
				paging.max = Math.ceil(this.state.data.length / paging.pageSize)
				paging.page = Math.max(1, Math.min(paging.max, paging.page))

				const start = (paging.page-1) * paging.pageSize
				const end = start + paging.pageSize
				return data.current.slice(start, end)
			})
		})
	}
}

/**
 * Returns a function for model.addEffect that filters rows from the data,
 * using a custom filter function `options.matches`
 * 
 * Options:
 * - name (string) (required) - the name of this filter, must be unique
 * - matches (function) (required) - the filter function to apply to the data
 */
export function filter(options) {
	if (!options?.name || typeof options.name!=='string') {
		throw new Error('filter requires options.name to be a string')
	}
	if (this.state.options[options.name]) {
		throw new Error('a filter with this name already exists on this model')
	}
	if (!options.matches || typeof options.matches!=='function') {
		throw new Error('filter requires options.matches to be a function')
	}
	return function(data) {
		this.state.options[options.name] = options
		return effect(() => {
			if (this.state.options[options.name].enabled) {
				return data.filter(this.state.options[options.name].matches)
			}
		})
	}
}

/**
 * Returns a function for model.addEffect that filters the data to only contain
 * columns (properties) that aren't hidden. Automatically runs again if any columns
 * hidden property changes.
 * 
 * Options:
 * - columns (object) (required) - an object with properties describing each column. Each 
 * property must be an object with an optional `hidden` property. If set to a truthy value,
 * and property in the dataset with the same name, will be filtered out.
 */
export function columns(options={}) {
	if (!options
		|| typeof options!=='object'
		|| Object.keys(options).length===0) {
		throw new Error('columns requires options to be an object with at least one property')
	}
	return function(data) {
		this.state.options.columns = options
		return effect(() => {
			return data.current.map(input => {
				let result = {}
				for (let key of Object.keys(this.state.options.columns)) {
					if (!this.state.options.columns[key]?.hidden) {
						result[key] = input[key]
					}
				}
				return result
			})
		})
	}
}

/**
 * Returns a function for use with model.addEffect, with the given options set
 * as model.options.scroll. The effect will return a slice of the input data, which
 * makes it easy to render just a part (slice) of the whole data.
 * 
 * Options are:
 * - offset (int) default 0 (optional) - the offset in the data to start the slice
 * - rowCount (int) default 20 (optional / calculated) - the number of rows in the slice
 * - rowHeight (int) default 26 (optional) - the height of a single row in pixels
 * - itemsPerRow (int) default 1 (optional) - the number of items on a single row
 * - size (int) default data.current.length (calculated) - how many rows inside data.current before slicing
 * - scrollbar (HTMLElement) defualt null (optional) - if set, an effect is added to update this elements 
 * 	 height if data.current.length changes
 * - container (HTMLElement) default null (optional) - if set, a scroll listener is added to this element, 
 *   which will update the options.offset signal and trigger the slice effect. It will also set the rowCount.
 */
export function scroll(options) {

	return function(data) {
		this.state.options.scroll = Object.assign({
			offset: 0,
			rowHeight: 26,
			rowCount: 20,
			itemsPerRow: 1,
			size: data.current.length
		}, options)
		const scrollOptions = this.state.options.scroll

		const scrollbar = scrollOptions.scrollbar 
			|| scrollOptions.container?.querySelector('[data-flow-scrollbar]')
		if (scrollbar) {
			if (scrollOptions.container) {
				scrollOptions.container.addEventListener('scroll', (evt) => {
					scrollOptions.offset = Math.floor(scrollOptions.container.scrollTop
						/ (scrollOptions.rowHeight*scrollOptions.itemsPerRow)
					)
				})
			}

			effect(() => {
				scrollOptions.size = data.current.length * scrollOptions.rowHeight
				scrollbar.style.height = scrollOptions.size + 'px'
			})
		}

		return effect(() => {
			if (scrollOptions.container) {
				//TODO: add a resize listener so that if the size of the container
				// changes, the rowCount is calculated again
				scrollOptions.rowCount = Math.ceil(
					scrollOptions.container.getBoundingClientRect().height 
					/ scrollOptions.rowHeight
				)
			}
			scrollOptions.data = data.current
			let start = Math.min(scrollOptions.offset, data.current.length-1)
			let end   = start + scrollOptions.rowCount
			if (end > data.current.length) {
				end   = data.current.length
				start = end - scrollOptions.rowCount
			}
			return data.current.slice(start, end)
		})
	}
}