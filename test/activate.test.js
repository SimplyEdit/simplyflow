import { jest } from '@jest/globals'
import { activate } from '../src/activate.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
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

