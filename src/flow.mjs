import { bind } from './bind.mjs'
import * as model from './model.mjs'
import * as state from './state.mjs'
import './render.mjs'
import * as dom from './dom.mjs'
import { app } from './app.mjs'
import { actions } from './action.mjs'
import { behaviors } from './behavior.mjs'
import { commands } from './command.mjs'
import { include } from './include.mjs'
import { shortcuts } from './shortcut.mjs'
import path from './path.mjs'
import { routes, SimplyRoute } from './route.mjs'
import { findAttribute } from './dom.mjs'

if (!globalThis.simply) {
    globalThis.simply = {}
}

Object.assign(globalThis.simply, {
    app,
    bind,
    flow: model,
    state,
    dom,
    behaviors,
    actions,
    action: actions,
    commands,
    command: commands,
    include,
    shortcuts,
    path,
    routes,
    route: new SimplyRoute(),
    findAttribute
})

export {
    app,
    bind,
    model,
    state,
    dom,
    behaviors,
    actions,
    commands,
    include,
    shortcuts,
    path,
    routes,
    SimplyRoute,
    findAttribute
}

export default globalThis.simply
