import { bind } from './bind.mjs'
import * as model from './model.mjs'
import * as state from './state.mjs'
import './render.mjs'
import * as dom from './dom.mjs'
import { app } from './app.mjs'
import { actions } from './action.mjs'
import { behaviors } from './behavior.mjs'
import { commands } from './command.mjs'
import { include, includes } from './include.mjs'
import { shortcuts } from './shortcut.mjs'
import path from './path.mjs'
import { routes, SimplyRoute } from './route.mjs'
import { findAttribute } from './dom.mjs'

if (!globalThis.simply) {
    globalThis.simply = {}
}

const modelApi = Object.assign(model.model, {
    model: model.model,
    sort: model.sort,
    paging: model.paging,
    filter: model.filter,
    columns: model.columns,
    scroll: model.scroll
})

Object.assign(globalThis.simply, {
    app,
    bind,
    model: modelApi,
    state,
    signal: state.signal,
    effect: state.effect,
    batch: state.batch,
    clone: state.clone,
    destroy: state.destroy,
    untracked: state.untracked,
    throttledEffect: state.throttledEffect,
    clockEffect: state.clockEffect,
    createSignal: state.createSignal,
    isSignal: state.isSignal,
    raw: state.raw,
    dom,
    behaviors,
    actions,
    commands,
    include,
    includes,
    shortcuts,
    path,
    routes,
    findAttribute
})

delete globalThis.simply.advanced

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
    includes,
    shortcuts,
    path,
    routes,
    SimplyRoute,
    findAttribute
}

export default globalThis.simply
