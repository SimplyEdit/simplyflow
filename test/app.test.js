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
  jest.restoreAllMocks()
  delete globalThis.fetch
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


  it('edits checkbox boolean values explicitly', async () => {
    document.body.innerHTML = `<div id="app"><input type="checkbox" data-simply-edit="active"></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        active: true
      }
    })

    await wait()
    const checkbox = container.querySelector('input')
    expect(checkbox.checked).toBe(true)

    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.active).toBe(false)

    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.active).toBe(true)
    testApp.destroy()
  })

  it('edits checkbox arrays by toggling the checkbox value', async () => {
    document.body.innerHTML = `<div id="app">
      <input id="js" type="checkbox" value="js" data-simply-edit="tags">
      <input id="html" type="checkbox" value="html" data-simply-edit="tags">
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        tags: ['js']
      }
    })

    await wait()
    const js = container.querySelector('#js')
    const html = container.querySelector('#html')
    expect(js.checked).toBe(true)
    expect(html.checked).toBe(false)

    html.checked = true
    html.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(Array.from(testApp.data.tags)).toEqual(['js', 'html'])

    js.checked = false
    js.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(Array.from(testApp.data.tags)).toEqual(['html'])
    testApp.destroy()
  })

  it('edits radio groups by writing the selected radio value', async () => {
    document.body.innerHTML = `<div id="app">
      <input id="red" type="radio" name="color" value="red" data-simply-edit="color">
      <input id="blue" type="radio" name="color" value="blue" data-simply-edit="color">
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        color: 'red'
      }
    })

    await wait()
    const red = container.querySelector('#red')
    const blue = container.querySelector('#blue')
    expect(red.checked).toBe(true)
    expect(blue.checked).toBe(false)

    blue.checked = true
    blue.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.color).toBe('blue')
    testApp.destroy()
  })

  it('edits select and multiple-select values', async () => {
    document.body.innerHTML = `<div id="app">
      <select id="country" data-simply-edit="country">
        <option value="nl">Netherlands</option>
        <option value="be">Belgium</option>
      </select>
      <select id="tags" multiple data-simply-edit="tags">
        <option value="js">JavaScript</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
      </select>
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        country: 'nl',
        tags: ['js']
      }
    })

    await wait()
    const country = container.querySelector('#country')
    const tags = container.querySelector('#tags')
    expect(country.value).toBe('nl')
    expect(Array.from(tags.selectedOptions).map(option => option.value)).toEqual(['js'])

    country.value = 'be'
    country.dispatchEvent(new Event('change', { bubbles: true }))
    tags.options[1].selected = true
    tags.options[0].selected = false
    tags.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()

    expect(testApp.data.country).toBe('be')
    expect(Array.from(testApp.data.tags)).toEqual(['html'])
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




  it('loads includes inside the app container and binds included content', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<span data-simply-field="title"></span>'
    })
    document.body.innerHTML = `
      <div id="app">
        <link rel="simply-include" href="https://example.com/card.html">
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        title: 'Included title'
      }
    })

    await wait(140)

    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/card.html')
    expect(container.querySelector('span').innerHTML).toBe('Included title')
    testApp.destroy()
  })

  it('stops loading new includes after app destroy', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<section>Loaded</section>'
    })
    const container = document.createElement('div')
    document.body.append(container)
    const testApp = app({ container, data: {} })
    testApp.destroy()

    const link = document.createElement('link')
    link.rel = 'simply-include'
    link.href = 'https://example.com/after-destroy.html'
    container.append(link)
    await wait(140)

    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(link.rel).toBe('simply-include')
  })

  it('uses app-level behaviors for data-simply-behavior elements', async () => {
    document.body.innerHTML = `<div id="app"><button data-simply-behavior="focusButton">Focus</button></div>`
    const container = document.getElementById('app')
    const started = []
    const stopped = []
    const thisValues = []

    const testApp = app({
      container,
      data: {},
      behaviors: {
        focusButton(element) {
          thisValues.push(this)
          started.push(element)
          return function cleanup(cleanupElement) {
            thisValues.push(this)
            stopped.push(cleanupElement)
          }
        }
      }
    })

    const button = container.querySelector('button')
    expect(started).toEqual([button])
    expect(thisValues[0]).toBe(testApp)
    testApp.destroy()
    expect(stopped).toEqual([button])
    expect(thisValues[1]).toBe(testApp)
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


  it('passes dynamic command values from list templates', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-list="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":value.id">Select</button>
              <button data-simply-command="selectItem" data-simply-value=":value">Select item</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const selectedItems = []
    const testApp = app({
      container,
      data: {
        contacts: [
          { id: 'ada', name: 'Ada' },
          { id: 'grace', name: 'Grace' }
        ]
      },
      commands: {
        select(el, value) {
          selected.push(value)
        },
        selectItem(el, value) {
          selectedItems.push(value)
        }
      }
    })

    await wait()
    const buttons = container.querySelectorAll('button')
    buttons[0].click()
    buttons[3].click()

    expect(selected).toEqual(['ada'])
    expect(selectedItems).toEqual([testApp.data.contacts[1]])
    testApp.destroy()
  })

  it('keeps dynamic command value paths correct when list items are reused', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-list="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":value.id">Select</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const testApp = app({
      container,
      data: {
        contacts: [
          { id: 'ada', name: 'Ada' },
          { id: 'grace', name: 'Grace' }
        ]
      },
      commands: {
        select(el, value) {
          selected.push(value)
        }
      }
    })

    await wait()
    const adaButton = container.querySelector('button')
    testApp.data.contacts.unshift({ id: 'alan', name: 'Alan' })
    await wait()
    adaButton.click()

    expect(selected).toEqual(['ada'])
    testApp.destroy()
  })

  it('passes dynamic command keys from map templates', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-map="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":key">Select</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const testApp = app({
      container,
      data: {
        contacts: {
          ada: { name: 'Ada' },
          grace: { name: 'Grace' }
        }
      },
      commands: {
        select(el, value) {
          selected.push(value)
        }
      }
    })

    await wait()
    container.querySelectorAll('button')[1].click()

    expect(selected).toEqual(['grace'])
    testApp.destroy()
  })


  it('destroy stops command listeners', async () => {
    document.body.innerHTML = `<div id="app"><button data-simply-command="count">Count</button></div>`
    const container = document.getElementById('app')
    let count = 0
    const testApp = app({
      container,
      data: {},
      commands: {
        count() {
          count++
        }
      }
    })

    await wait()
    const button = container.querySelector('button')
    button.click()
    testApp.destroy()
    button.click()

    expect(count).toBe(1)
  })

  it('destroy stops shortcut and accesskey listeners', async () => {
    document.body.innerHTML = `<div id="app">
      <input>
      <button data-simply-accesskey="Control+k">Open</button>
    </div>`
    const container = document.getElementById('app')
    let shortcuts = 0
    let accesskeyClicks = 0
    container.querySelector('button').addEventListener('click', () => {
      accesskeyClicks++
    })

    const testApp = app({
      container,
      data: {},
      shortcuts: {
        'Control+s'() {
          shortcuts++
        }
      }
    })

    await wait()
    const input = container.querySelector('input')
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'k',
      ctrlKey: true,
      keyCode: 75
    }))
    testApp.destroy()
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'k',
      ctrlKey: true,
      keyCode: 75
    }))

    expect(shortcuts).toBe(1)
    expect(accesskeyClicks).toBe(1)
  })

  it('destroy stops route event listeners', async () => {
    document.body.innerHTML = `<div id="app"></div>`
    const container = document.getElementById('app')
    const hits = []
    const testApp = app({
      container,
      data: {},
      actions: {
        show({ id }) {
          hits.push(id)
        }
      },
      routes: {
        '/contacts/:id': 'show'
      }
    })

    await wait()
    history.pushState({}, '', '/contacts/ada')
    globalThis.dispatchEvent(new Event('popstate'))
    testApp.destroy()
    history.pushState({}, '', '/contacts/grace')
    globalThis.dispatchEvent(new Event('popstate'))

    expect(hits).toEqual(['ada'])
  })

  it('does not initialize routes after an async start if the app was destroyed first', async () => {
    document.body.innerHTML = `<div id="app"></div>`
    const container = document.getElementById('app')
    let resolveStart
    const started = new Promise(resolve => {
      resolveStart = resolve
    })
    const hits = []
    const testApp = app({
      container,
      data: {},
      start() {
        return started
      },
      actions: {
        show({ id }) {
          hits.push(id)
        }
      },
      routes: {
        '/contacts/:id': 'show'
      }
    })

    testApp.destroy()
    resolveStart()
    await wait()
    history.pushState({}, '', '/contacts/ada')
    globalThis.dispatchEvent(new Event('popstate'))

    expect(hits).toEqual([])
  })

})
