import simply, { app, commands, actions, routes, path, shortcuts, behaviors, findAttribute } from '../src/flow.mjs'

afterEach(() => {
  document.body.innerHTML = ''
  delete globalThis.simply
})

describe('merged app-layer exports', () => {
  it('exports the app layer from the SimplyFlow entrypoint', () => {
    expect(simply.app).toBe(app)
    expect(simply.command).toBe(commands)
    expect(simply.action).toBe(actions)
    expect(simply.routes).toBe(routes)
    expect(simply.shortcuts).toBe(shortcuts)
    expect(simply.behaviors).toBe(behaviors)
    expect(simply.path).toBe(path)
    expect(simply.findAttribute).toBe(findAttribute)
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
    expect(typeof simply.bind).toBe('function')
    expect(typeof simply.flow.model).toBe('function')

    delete globalThis.simply
  })

  it('exports the browser bundle namespace on globalThis.simply without replacing an existing object', async () => {
    const existing = { existing: true }
    globalThis.simply = existing

    const simply = (await import(`../src/flow.mjs?test=${Date.now()}`)).default

    expect(simply).toBe(existing)
    expect(simply.existing).toBe(true)
    expect(typeof simply.bind).toBe('function')
    expect(typeof simply.flow.model).toBe('function')
    expect(typeof simply.shortcuts).toBe('function')
    expect(typeof simply.state.signal).toBe('function')
    expect(typeof simply.dom.signal).toBe('function')
    expect(customElements.get('simply-render')).toBeDefined()

    delete globalThis.simply
  })
})

