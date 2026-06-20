import simply, { app, commands, actions, routes, path, shortcuts, behaviors, include, includes, findAttribute } from '../src/flow.mjs'
import * as state from '../src/state.mjs'
import * as model from '../src/model.mjs'
import { bind } from '../src/bind.mjs'
import * as dom from '../src/dom.mjs'

const GLOBAL_KEYS = [
  'app',
  'bind',
  'model',
  'state',
  'signal',
  'effect',
  'batch',
  'clone',
  'destroy',
  'untracked',
  'throttledEffect',
  'clockEffect',
  'createSignal',
  'isSignal',
  'raw',
  'dom',
  'behaviors',
  'actions',
  'commands',
  'include',
  'includes',
  'shortcuts',
  'path',
  'routes',
  'findAttribute'
]

afterEach(() => {
  document.body.innerHTML = ''
  delete globalThis.simply
})

describe('merged app-layer exports', () => {
  it('exposes a flat browser global for app and lower-level APIs', () => {
    expect(simply.app).toBe(app)
    expect(simply.bind).toBe(bind)
    expect(simply.commands).toBe(commands)
    expect(simply.actions).toBe(actions)
    expect(simply.routes).toBe(routes)
    expect(simply.SimplyRoute).toBeUndefined()
    expect(simply.shortcuts).toBe(shortcuts)
    expect(simply.behaviors).toBe(behaviors)
    expect(simply.include).toBe(include)
    expect(simply.includes).toBe(includes)
    expect(simply.path).toBe(path)
    expect(simply.findAttribute).toBe(findAttribute)
    expect(simply.state).toBe(state)
    expect(simply.dom).toBe(dom)
    expect(simply.signal).toBe(state.signal)
    expect(simply.effect).toBe(state.effect)
    expect(simply.batch).toBe(state.batch)
    expect(simply.clone).toBe(state.clone)
    expect(simply.model).toBe(model.model)
    expect(simply.model.sort).toBe(model.sort)
    expect(simply.model.filter).toBe(model.filter)
    expect(simply.model.paging).toBe(model.paging)
    expect(simply.model.columns).toBe(model.columns)
    expect(simply.model.scroll).toBe(model.scroll)
    expect(simply.advanced).toBeUndefined()

    for (const key of GLOBAL_KEYS) {
      expect(simply[key]).toBeDefined()
    }
  })

  it('finds inherited data-simply attributes', () => {
    document.body.innerHTML = `<div data-simply-example="value"><button>Run</button></div>`
    expect(findAttribute(document.querySelector('button'), 'data-simply-example')).toBe('value')
  })
})


describe('flow entrypoint API', () => {
  it('creates globalThis.simply when it does not exist', async () => {
    delete globalThis.simply

    const simply = (await import(`../src/flow.mjs?fresh=${Date.now()}`)).default

    expect(simply).toBe(globalThis.simply)
    expect(typeof simply.app).toBe('function')
    expect(typeof simply.bind).toBe('function')
    expect(typeof simply.signal).toBe('function')
    expect(typeof simply.model).toBe('function')
    expect(typeof simply.model.model).toBe('function')
    expect(simply.advanced).toBeUndefined()

    delete globalThis.simply
  })

  it('exports the browser bundle namespace on globalThis.simply without replacing an existing object', async () => {
    const existing = { existing: true }
    globalThis.simply = existing

    const simply = (await import(`../src/flow.mjs?test=${Date.now()}`)).default

    expect(simply).toBe(existing)
    expect(simply.existing).toBe(true)
    expect(typeof simply.app).toBe('function')
    expect(typeof simply.bind).toBe('function')
    expect(typeof simply.model).toBe('function')
    expect(typeof simply.model.model).toBe('function')
    expect(typeof simply.shortcuts).toBe('function')
    expect(typeof simply.state.signal).toBe('function')
    expect(typeof simply.signal).toBe('function')
    expect(typeof simply.dom.signal).toBe('function')
    expect(simply.route).toBeUndefined()
    expect(simply.SimplyRoute).toBeUndefined()
    expect(simply.advanced).toBeUndefined()
    expect(customElements.get('simply-render')).toBeDefined()

    delete globalThis.simply
  })
})
