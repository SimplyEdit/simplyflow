import { bind } from './bind.mjs'
import * as model from './model.mjs'
import * as state from './state.mjs'

if (!window.simply) {
	window.simply = {}
}
Object.assign(window.simply, {
	bind,
	model,
	state
})

export default window.simply