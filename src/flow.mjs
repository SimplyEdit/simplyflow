import { bind } from './bind.mjs'
import * as model from './model.mjs'
import * as state from './state.mjs'
import './render.mjs'
import * as dom from './dom.mjs'

if (!globalThis.simply) {
	globalThis.simply = {}
}
Object.assign(globalThis.simply, {
	bind,
	flow: model,
	state,
	dom
})

export default globalThis.simply