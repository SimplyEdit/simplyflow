import { jest } from '@jest/globals'
import { app } from '../src/app.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
})

afterEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
})

describe('app API', () => {
  it('uses data as the reactive application object', async () => {
    document.body.innerHTML = `<div id="app"><span data-simply-field="title"></span></div>`
    const container = document.getElementById('app')

    const testApp = app({
      container,
      data: {
        title: 'Hello'
      }
    })

    await wait()
    expect(container.querySelector('span').innerHTML).toBe('Hello')

    testApp.data.title = 'Hello again'
    await wait()
    expect(container.querySelector('span').innerHTML).toBe('Hello again')

    expect(testApp.view).toBeUndefined()
    expect(testApp.state).toBeUndefined()
    testApp.destroy()
  })

  it('uses data-simply bindings with two-way form fields by default', async () => {
    document.body.innerHTML = `<div id="app"><input data-simply-field="name"></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada'
      }
    })

    await wait()
    const input = container.querySelector('input')
    expect(input.value).toBe('Ada')

    input.value = 'Grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(testApp.data.name).toBe('Grace')
    testApp.destroy()
  })

  it('runs commands with the app as this so commands can change data', async () => {
    document.body.innerHTML = `
      <div id="app">
        <button data-simply-command="increment">+</button>
        <span data-simply-field="count"></span>
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        count: 0
      },
      commands: {
        increment() {
          this.data.count++
        }
      }
    })

    await wait()
    container.querySelector('button').click()
    await wait()

    expect(testApp.data.count).toBe(1)
    expect(container.querySelector('span').innerHTML).toBe('1')
    testApp.destroy()
  })

  it('lets commands call actions that update data', async () => {
    document.body.innerHTML = `
      <div id="app">
        <button data-simply-command="setName" data-simply-value="Grace">Set</button>
        <span data-simply-field="name"></span>
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada'
      },
      commands: {
        setName(el, value) {
          this.actions.setName(value)
        }
      },
      actions: {
        setName(name) {
          this.data.name = name
        }
      }
    })

    await wait()
    container.querySelector('button').click()
    await wait()

    expect(testApp.data.name).toBe('Grace')
    expect(container.querySelector('span').innerHTML).toBe('Grace')
    testApp.destroy()
  })

  it('can disable automatic binding for app-level tests or custom binding', () => {
    const container = document.createElement('div')
    container.innerHTML = `<span data-simply-field="title"></span>`
    document.body.append(container)

    const testApp = app({
      container,
      bind: false,
      data: {
        title: 'not rendered'
      }
    })

    expect(testApp.binding).toBeUndefined()
    expect(container.querySelector('span').innerHTML).toBe('')
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
  it('copies custom app options without warning so actions can use app services', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const api = {
      async get(path) {
        return { path, title: 'Loaded' }
      }
    }

    const testApp = app({
      bind: false,
      data: {
        item: null
      },
      api,
      actions: {
        async loadItem() {
          this.data.item = await this.api.get('foo.json')
        }
      }
    })

    await testApp.actions.loadItem()

    expect(testApp.api).toBe(api)
    expect(testApp.data.item).toEqual({ path: 'foo.json', title: 'Loaded' })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns when a custom app option is probably a typo of a built-in option', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const testApp = app({
      bind: false,
      data: {},
      commmands: {
        save() {}
      }
    })

    expect(testApp.commmands).toEqual({ save: expect.any(Function) })
    expect(testApp.commands).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('simplyflow/app: unknown option "commmands". Did you mean "commands"? The option was still added to the app as "app.commmands".')
    warn.mockRestore()
  })

})
