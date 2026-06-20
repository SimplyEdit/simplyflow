import simply, { app, commands, actions, routes, path, findAttribute } from '../src/flow.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

afterEach(() => {
  document.body.innerHTML = ''
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

describe('merged app-layer exports', () => {
  it('exports the app layer from the SimplyFlow entrypoint', () => {
    expect(simply.app).toBe(app)
    expect(simply.command).toBe(commands)
    expect(simply.action).toBe(actions)
    expect(simply.routes).toBe(routes)
    expect(simply.path).toBe(path)
    expect(simply.findAttribute).toBe(findAttribute)
  })

  it('finds inherited data-simply attributes', () => {
    document.body.innerHTML = `<div data-simply-example="value"><button>Run</button></div>`
    expect(findAttribute(document.querySelector('button'), 'data-simply-example')).toBe('value')
  })
})

describe('path API', () => {
  it('gets and sets dotted paths', () => {
    const data = { person: { name: 'Ada' } }
    expect(path.get(data, 'person.name')).toBe('Ada')
    path.set(data, 'person.name', 'Grace')
    expect(data.person.name).toBe('Grace')
  })
})
