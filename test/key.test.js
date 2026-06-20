import { jest } from '@jest/globals'
import { keys, accesskeys } from '../src/key.mjs'

beforeEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
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

