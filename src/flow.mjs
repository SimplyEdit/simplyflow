import { bind } from './bind.mjs'
import * as model from './model.mjs'
import * as state from './state.mjs'
import './render.mjs'

if (!globalThis.simply) {
	globalThis.simply = {}
}
Object.assign(globalThis.simply, {
	bind,
	flow: model,
	state
})

export default globalThis.simply