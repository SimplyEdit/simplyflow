import { jest } from '@jest/globals'
import { commands } from '../src/command.mjs'

beforeEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
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

