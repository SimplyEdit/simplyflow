import { jest } from '@jest/globals'
import { shortcuts, accesskeys } from '../src/shortcut.mjs'

beforeEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

describe('shortcut API', () => {
  it('runs matching key handlers with the app as this and prevents default unless true is returned', () => {
    document.body.innerHTML = `<div id="app"><input></div>`
    const container = document.getElementById('app')
    const calls = []
    const testApp = { container, data: { saved: false } }
    shortcuts({
      app: testApp,
      shortcuts: {
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

  it('supports named shortcut scopes and dash-separated shortcuts', () => {
    document.body.innerHTML = `
      <div id="app" data-simply-shortcuts="editor">
        <input>
      </div>`
    const container = document.getElementById('app')
    const calls = []
    shortcuts({
      app: { container },
      shortcuts: {
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

})

