import { jest } from '@jest/globals'
import { app } from '../src/app.mjs'
import { actions } from '../src/action.mjs'
import { commands } from '../src/command.mjs'
import { routes, SimplyRoute } from '../src/route.mjs'
import { keys, accesskeys } from '../src/key.mjs'
import path from '../src/path.mjs'
import { activate } from '../src/activate.mjs'
import { include } from '../src/include.mjs'
import { html, css } from '../src/highlight.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  history.replaceState({}, '', '/')
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  jest.restoreAllMocks()
})

describe('action API', () => {
  it('binds actions to the app object', () => {
    const testApp = { data: { count: 0 } }
    const api = actions({
      app: testApp,
      actions: {
        increment(amount) {
          this.data.count += amount
          return this.data.count
        }
      }
    })

    expect(api.increment(2)).toBe(2)
    expect(testApp.data.count).toBe(2)
    expect(api.missing).toBeUndefined()
  })

  it('routes synchronous and asynchronous action errors to hooks.error', async () => {
    const errors = []
    const testApp = {
      hooks: {
        error(error, action) {
          errors.push({ error, action })
          return 'handled'
        }
      }
    }
    const api = actions({
      app: testApp,
      actions: {
        throwsNow() {
          throw new Error('sync failure')
        },
        async throwsLater() {
          throw new Error('async failure')
        }
      }
    })

    expect(api.throwsNow()).toBe('handled')
    await expect(api.throwsLater()).resolves.toBe('handled')
    expect(errors.map(entry => entry.error.message)).toEqual(['sync failure', 'async failure'])
    expect(errors[0].action.name).toBe('bound throwsNow')
  })

  it('supports the legacy actions(app, options) call shape', () => {
    const testApp = { data: { value: '' } }
    const api = actions(testApp, {
      actions: {
        setValue(value) {
          this.data.value = value
        }
      }
    })

    api.setValue('legacy')
    expect(testApp.data.value).toBe('legacy')
  })

  it('returns the input unchanged when no app is supplied', () => {
    const config = { actions: { noop() {} } }
    expect(actions(config)).toBe(config)
  })
})

describe('command API', () => {
  it('calls button commands with the app as this and prevents default unless true is returned', () => {
    document.body.innerHTML = `<div id="app"><button data-simply-command="save" data-simply-value="42">Save</button></div>`
    const container = document.getElementById('app')
    const calls = []
    const testApp = { container, marker: 'app' }
    commands({
      app: testApp,
      commands: {
        save(source, value) {
          calls.push({ thisValue: this, source, value })
        }
      }
    })

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const result = container.querySelector('button').dispatchEvent(evt)

    expect(result).toBe(false)
    expect(evt.defaultPrevented).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].thisValue).toBe(testApp)
    expect(calls[0].source).toBe(container.querySelector('button'))
    expect(calls[0].value).toBe('42')
  })

  it('lets commands opt into normal browser behavior by returning true', () => {
    document.body.innerHTML = `<div id="app"><button data-simply-command="continue">Go</button></div>`
    const container = document.getElementById('app')
    commands({
      app: { container },
      commands: {
        continue() {
          return true
        }
      }
    })

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    expect(container.querySelector('button').dispatchEvent(evt)).toBe(true)
    expect(evt.defaultPrevented).toBe(false)
  })

  it('handles input change events and immediate input events', () => {
    document.body.innerHTML = `
      <div id="app">
        <input data-simply-command="changed" value="first">
        <input data-simply-command="typed" data-simply-immediate="true" value="second">
      </div>`
    const container = document.getElementById('app')
    const values = []
    commands({
      app: { container },
      commands: {
        changed(source, value) { values.push(['changed', value]) },
        typed(source, value) { values.push(['typed', value]) }
      }
    })

    container.querySelector('[data-simply-command="changed"]').dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    container.querySelector('[data-simply-command="changed"]').dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
    container.querySelector('[data-simply-command="typed"]').dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    expect(values).toEqual([
      ['changed', 'first'],
      ['typed', 'second']
    ])
  })

  it('returns all selected values for multiple select commands', () => {
    document.body.innerHTML = `
      <div id="app">
        <select data-simply-command="choose" multiple>
          <option value="a" selected>A</option>
          <option value="b">B</option>
          <option value="c" selected>C</option>
        </select>
      </div>`
    const container = document.getElementById('app')
    let selected
    commands({
      app: { container },
      commands: {
        choose(source, value) { selected = value }
      }
    })

    container.querySelector('select').dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
    expect(selected).toEqual(['a', 'c'])
  })

  it('serializes form fields and repeated names', () => {
    document.body.innerHTML = `
      <div id="app">
        <form data-simply-command="submitForm">
          <input name="title" value="Hello">
          <input name="tag" value="a">
          <input name="tag" value="b">
        </form>
      </div>`
    const container = document.getElementById('app')
    let submitted
    commands({
      app: { container },
      commands: {
        submitForm(source, value) { submitted = value }
      }
    })

    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(submitted).toEqual({ title: 'Hello', tag: ['a', 'b'] })
  })

  it('supports command.call(), custom handlers and the legacy call shape', () => {
    document.body.innerHTML = `<div id="app"><span data-special-command="mark" data-value="custom"></span></div>`
    const container = document.getElementById('app')
    const calls = []
    const commandApi = commands({ container }, {
      commands: {
        mark(source, value) {
          calls.push(value)
        }
      },
      handlers: []
    })

    commandApi.appendHandler({
      match: '[data-special-command]',
      check: (el, evt) => evt.type === 'click',
      get: el => el.dataset.value
    })
    commandApi.prependHandler({
      match: '[data-never]',
      check: () => false,
      get: () => 'never'
    })

    const special = container.querySelector('[data-special-command]')
    special.dataset.simplyCommand = special.dataset.specialCommand
    special.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    commandApi.call('mark', special, 'manual')

    expect(calls).toEqual(['custom', 'manual'])
  })

  it('logs undefined commands without throwing', () => {
    document.body.innerHTML = `<div id="app"><button data-simply-command="missing">Missing</button></div>`
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.getElementById('app')
    commands({ app: { container }, commands: {} })

    expect(() => container.querySelector('button').click()).not.toThrow()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('undefined command missing'), expect.any(HTMLButtonElement))
  })
})

describe('route API', () => {
  it('matches parameterized, wildcard and exact routes', () => {
    const calls = []
    const router = routes({
      app: { name: 'app' },
      matchExact: true,
      routes: {
        '/users/:id': function(params) {
          calls.push({ thisValue: this, params })
          return 'user'
        },
        '/files/:*': params => params.remainder
      }
    })

    expect(router.match('/users/42')).toBe('user')
    expect(calls[0].thisValue.name).toBe('app')
    expect(calls[0].params).toEqual({ id: '42' })
    expect(router.match('/users/42/extra')).toBe(false)
    expect(router.match('/files/a/b/c')).toBe('a/b/c')
  })

  it('supports base URLs, init(), has(), clear() and load()', () => {
    const router = new SimplyRoute({ baseURL: '/app/' })
    router.load({
      '/dashboard': () => 'dashboard'
    })

    expect(router.has('/app/dashboard')).toBe(true)
    expect(router.match('/app/dashboard')).toBe('dashboard')

    router.init({ baseURL: '/new/' })
    router.clear()
    router.load({ '/home': () => 'home' })
    expect(router.match('/new/home')).toBe('home')
    expect(router.has('/app/dashboard')).toBe(false)
  })

  it('runs route listeners and allows them to alter path and params', () => {
    const router = new SimplyRoute({
      routes: {
        '/new/:id': params => params.id
      }
    })
    const events = []
    const matchListener = args => {
      events.push('match')
      return { ...args, path: '/new/123' }
    }
    const callListener = args => {
      events.push('call')
      return { ...args, params: { id: '456' } }
    }
    const finishListener = args => {
      events.push(['finish', args.result])
    }

    router.addListener('match', '/old/:id', matchListener)
    router.addListener('call', '/new/:id', callListener)
    router.addListener('finish', '/new/:id', finishListener)

    expect(router.match('/old/ignored')).toBe('456')
    expect(events).toEqual(['match', 'call', ['finish', '456']])

    router.removeListener('match', '/old/:id', matchListener)
    expect(router.match('/old/ignored')).toBe(false)
  })

  it('adds a missing slash and updates history when configured', () => {
    const router = new SimplyRoute({
      addMissingSlash: true,
      routes: {
        '/docs/': () => 'docs'
      }
    })

    expect(router.match('/docs')).toBe('docs')
    expect(location.pathname).toBe('/docs/')
  })

  it('navigates with goto() and can hijack matching same-origin links', () => {
    document.body.innerHTML = `<div id="app"><a href="/page/7">Page</a></div>`
    const container = document.getElementById('app')
    const seen = []
    const router = routes({
      app: { container },
      hijackLinks: true,
      routes: {
        '/page/:id': params => {
          seen.push(params.id)
          return undefined
        }
      }
    })

    router.handleEvents()
    expect(router.goto('/page/3')).toBeUndefined()
    expect(location.pathname).toBe('/page/3')

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    Object.defineProperty(evt, 'which', { value: 1 })
    container.querySelector('a').dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    expect(seen).toEqual(['3', '7'])
  })

  it('throws for unknown listener actions and supports the legacy routes(app, options) call shape', () => {
    const router = routes({}, { routes: { '/': () => 'root' } })
    expect(router.match('/')).toBe('root')
    expect(() => router.addListener('unknown', '/', () => {})).toThrow('Unknown action unknown')
    expect(() => router.removeListener('unknown', '/', () => {})).toThrow('Unknown action unknown')
  })
})

describe('key API', () => {
  it('runs matching key handlers with the app as this and prevents default unless true is returned', () => {
    document.body.innerHTML = `<div id="app"><input></div>`
    const container = document.getElementById('app')
    const calls = []
    const testApp = { container, data: { saved: false } }
    keys({
      app: testApp,
      keys: {
        'Control+s': function(event) {
          calls.push(this)
          this.data.saved = true
        }
      }
    })

    const evt = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    })
    container.querySelector('input').dispatchEvent(evt)

    expect(testApp.data.saved).toBe(true)
    expect(calls[0]).toBe(testApp)
    expect(evt.defaultPrevented).toBe(true)
  })

  it('supports named keyboard scopes and dash-separated shortcuts', () => {
    document.body.innerHTML = `
      <div id="app" data-simply-keyboard="editor">
        <input>
      </div>`
    const container = document.getElementById('app')
    const calls = []
    keys({
      app: { container },
      keys: {
        editor: {
          'Alt-x': () => { calls.push('scoped'); return false }
        },
        'editor.Alt-x': () => calls.push('dotted'),
        'Alt-x': () => calls.push('global')
      }
    })

    container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'x',
      altKey: true,
      keyCode: 88
    }))

    expect(calls).toEqual(['scoped'])
  })

  it('clicks matching accesskey targets', () => {
    document.body.innerHTML = `<div id="app"><button data-simply-accesskey="Control+k"></button><input></div>`
    const container = document.getElementById('app')
    const button = container.querySelector('button')
    const click = jest.fn()
    button.addEventListener('click', click)
    accesskeys({ container })

    container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'k',
      ctrlKey: true,
      keyCode: 75
    }))

    expect(click).toHaveBeenCalledTimes(1)
  })

  it('supports the legacy keys(app, options) call shape', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const keyApi = keys({ container }, { keys: { default: {} } })
    expect(keyApi).toBeDefined()
  })
})

describe('path API', () => {
  it('handles empty, non-string and falsy path values', () => {
    const data = { count: 0, enabled: false, text: '', nested: { value: 1 } }

    expect(path.get(data, '')).toBe(data)
    expect(path.get(data, data.nested)).toBe(data.nested)
    expect(path.get(data, 'count')).toBe(0)
    expect(path.get(data, 'enabled')).toBe(false)
    expect(path.get(data, 'text')).toBe('')
    expect(path.get(data, 'missing')).toBeNull()
  })

  it('pushes, pops, finds parents and sets nested values', () => {
    const data = { person: { name: 'Ada' } }

    expect(path.push('person', 'name')).toBe('person.name')
    expect(path.pop('person.name')).toBe('name')
    expect(path.parent('person.name.first')).toBe('person.name')
    expect(path.parents(data, 'person.name.first')).toEqual(['', 'person', 'person.name'])

    path.set(data, 'person.name', 'Grace')
    expect(data.person.name).toBe('Grace')
  })
})

describe('activate API', () => {
  it('calls listeners for existing and newly added nodes and destroys removed nodes', async () => {
    const name = `fixture-${Date.now()}-${Math.random()}`
    document.body.innerHTML = `<div data-simply-activate="${name}"></div>`
    await wait()
    const seen = []
    const destroyed = []
    const listener = function() {
      seen.push(this)
      return function() {
        destroyed.push(this)
      }
    }

    activate.addListener(name, listener)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(document.querySelector('[data-simply-activate]'))

    const node = document.createElement('section')
    node.innerHTML = `<article data-simply-activate="${name}"></article>`
    document.body.append(node)
    await wait()
    const activated = node.querySelector('[data-simply-activate]')
    expect(seen).toContain(activated)

    
    node.remove()
    await wait()
    expect(destroyed).toContain(activated)
    activate.removeListener(name, listener)
  })

  it('warns when an activate listener returns a non-function destroy value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const name = `fixture-warn-${Date.now()}-${Math.random()}`
    document.body.innerHTML = `<div data-simply-activate="${name}"></div>`

    activate.addListener(name, function() {
      return 'not a function'
    })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('activate listener may only return'), 'not a function')
  })
})

describe('include API', () => {
  it('imports stylesheet nodes and HTML before the include link', () => {
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/components/card.html'
    document.body.append(link)

    include.html(`
      <link rel="stylesheet" href="style.css">
      <style>.card { display: block; }</style>
      <section id="card">Loaded</section>
    `, link)

    expect(document.head.querySelector('link[rel="stylesheet"]').href).toBe('https://example.com/components/style.css')
    expect(document.head.querySelector('style').textContent).toContain('.card')
    expect(document.body.firstElementChild.id).toBe('card')
    expect(document.body.lastElementChild).toBe(link)
  })

  it('adds a cache-buster while rebasing script URLs', async () => {
    include.cacheBuster = 'test-cache'
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/app/page.html'
    document.body.append(link)

    include.html(`<script src="tool.js"></script><section>Loaded</section>`, link)
    await wait(20)
    const clone = document.body.querySelector('script')

    expect(clone.src).toBe('https://example.com/app/tool.js?cb=test-cache')
    expect(document.body.textContent).toContain('Loaded')
    include.cacheBuster = null
  })
})

describe('highlight template helpers', () => {
  it('interpolates html and css template strings', () => {
    expect(html`<p>${'Hello'}</p>`).toBe('<p>Hello</p>')
    expect(css`.${'card'} { display: block; }`).toBe('.card { display: block; }')
  })
})

describe('app integration details', () => {
  it('installs inline html and css templates', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
      bind: false,
      html: {
        greeting: '<span>Hello</span>'
      },
      css: {
        base: '.greeting { color: black; }'
      }
    })

    expect(container.querySelector('template#greeting').innerHTML).toContain('<span>Hello</span>')
    expect(container.querySelector('style#base\\.css').innerHTML).toContain('.greeting')
    expect(testApp.app).toBe(testApp)
  })

  it('merges components before app options and ignores prototype-polluting options', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
      bind: false,
      components: {
        base: {
          data: { fromComponent: true, overridden: false },
          actions: {
            componentAction() { return 'component' }
          }
        }
      },
      data: { overridden: true },
      actions: {
        appAction() { return 'app' }
      },
      __proto__: { polluted: true }
    })

    expect(testApp.data.fromComponent).toBe(true)
    expect(testApp.data.overridden).toBe(true)
    expect(testApp.actions.componentAction()).toBe('component')
    expect(testApp.actions.appAction()).toBe('app')
    expect({}.polluted).toBeUndefined()
  })

  it('waits for an async start hook before initializing routes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const calls = []

    app({
      container,
      bind: false,
      baseURL: '/',
      hooks: {
        start: async function() {
          calls.push('start')
          await wait(0)
          history.replaceState({}, '', '/ready')
          calls.push('started')
        }
      },
      routes: {
        '/ready': function() {
          calls.push(['route', true])
        }
      }
    })

    // Route initialization is scheduled after the async start hook settles.
    await wait()
    expect(calls[0]).toBe('start')
    expect(calls).toContain('started')
    expect(calls.some(call => Array.isArray(call) && call[0] === 'route')).toBe(true)
  })
})
