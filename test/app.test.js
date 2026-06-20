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

  it('uses data-simply-field as one-way binding by default', async () => {
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
    expect(testApp.data.name).toBe('Ada')
    testApp.destroy()
  })

  it('uses data-simply-edit for editable fields', async () => {
    document.body.innerHTML = `<div id="app"><input data-simply-edit="name"><textarea data-simply-edit="note"></textarea></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada',
        note: 'hello'
      }
    })

    await wait()
    const input = container.querySelector('input')
    const textarea = container.querySelector('textarea')
    expect(input.value).toBe('Ada')
    expect(textarea.value).toBe('hello')

    input.value = 'Grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.value = 'updated'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(testApp.data.name).toBe('Grace')
    expect(testApp.data.note).toBe('updated')
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

  it('uses shortcuts with the app as this', async () => {
    document.body.innerHTML = `<div id="app"><input><span data-simply-field="saved"></span></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        saved: false
      },
      shortcuts: {
        'Control+s'(event) {
          this.data.saved = true
          expect(event).toBeInstanceOf(KeyboardEvent)
        }
      }
    })

    container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))

    await wait()
    expect(testApp.data.saved).toBe(true)
    expect(container.querySelector('span').innerHTML).toBe('true')
    expect(testApp.shortcuts).toBeDefined()
    expect(testApp.keys).toBeUndefined()
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

})


describe('app integration details', () => {
  it('installs inline templates and styles', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
      templates: {
        greeting: '<span>Hello</span>'
      },
      styles: {
        base: '.greeting { color: black; }'
      }
    })

    expect(container.querySelector('template#greeting').innerHTML).toContain('<span>Hello</span>')
    expect(container.querySelector('style#base\\.css').innerHTML).toContain('.greeting')
    expect(testApp.app).toBe(testApp)
    testApp.destroy()
  })

  it('merges components before app options and ignores prototype-polluting options', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
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
    testApp.destroy()
  })


  it('supports route action-name shorthand in app routes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const calls = []

    const testApp = app({
      container,
      actions: {
        showContact({ id, tab }) {
          calls.push({ thisValue: this, id, tab })
          return id
        }
      },
      routes: {
        '/contacts/:id': 'showContact'
      }
    })

    expect(testApp.routes.match('/contacts/42?tab=notes')).toBe('42')
    expect(calls).toEqual([
      {
        thisValue: testApp,
        id: '42',
        tab: 'notes'
      }
    ])
    testApp.destroy()
  })

  it('waits for async start before initializing routes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const calls = []

    const testApp = app({
      container,
      baseURL: '/',
      async start() {
        calls.push('start')
        await wait(0)
        history.replaceState({}, '', '/ready')
        calls.push('started')
      },
      routes: {
        '/ready': function() {
          calls.push(['route', true])
        }
      }
    })

    // Route initialization is scheduled after async start settles.
    await wait()
    expect(calls[0]).toBe('start')
    expect(calls).toContain('started')
    expect(calls.some(call => Array.isArray(call) && call[0] === 'route')).toBe(true)
    testApp.destroy()
  })

  it('routes start errors to onError', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const errors = []

    const testApp = app({
      container,
      start() {
        throw new Error('start failed')
      },
      onError(error, context) {
        errors.push({ error, context })
      }
    })

    expect(errors).toHaveLength(1)
    expect(errors[0].error.message).toBe('start failed')
    expect(errors[0].context).toBe(testApp.start)
    testApp.destroy()
  })
  it('copies custom app options without warning so actions can use app services', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const api = {
      async get(path) {
        return { path, title: 'Loaded' }
      }
    }

    const testApp = app({
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
    testApp.destroy()
    warn.mockRestore()
  })

  it('warns when a custom app option is probably a typo of a built-in option', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const testApp = app({
      data: {},
      commmands: {
        save() {}
      }
    })

    expect(testApp.commmands).toEqual({ save: expect.any(Function) })
    expect(testApp.commands).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('simplyflow/app: unknown option "commmands". Did you mean "commands"? The option was still added to the app as "app.commmands".')
    testApp.destroy()
    warn.mockRestore()
  })

})
