import { jest } from '@jest/globals'
import { behaviors } from '../src/behavior.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

describe('behaviors API', () => {
  it('starts behaviors for existing and newly added nodes and cleans up removed nodes', async () => {
    const container = document.createElement('div')
    container.innerHTML = `<div data-simply-behavior="tabs"></div>`
    document.body.append(container)

    const started = []
    const stopped = []
    const app = { name: 'app' }
    const instance = behaviors({
      app,
      container,
      behaviors: {
        tabs(element) {
          expect(this).toBe(app)
          started.push(element)
          return function cleanup(cleanupElement) {
            expect(this).toBe(app)
            stopped.push(cleanupElement)
          }
        }
      }
    })

    const existing = container.querySelector('[data-simply-behavior]')
    expect(started).toEqual([existing])

    const wrapper = document.createElement('section')
    wrapper.innerHTML = `<article data-simply-behavior="tabs"></article>`
    container.append(wrapper)
    await wait()

    const added = wrapper.querySelector('[data-simply-behavior]')
    expect(started).toContain(added)

    wrapper.remove()
    await wait()
    expect(stopped).toContain(added)

    instance.destroy()
    expect(stopped).toContain(existing)
  })

  it('warns when a behavior returns a non-function cleanup value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    container.innerHTML = `<div data-simply-behavior="bad"></div>`
    document.body.append(container)

    const instance = behaviors({
      container,
      behaviors: {
        bad() {
          return 'not a function'
        }
      }
    })

    expect(warn).toHaveBeenCalledWith('simplyflow/behavior: behavior may only return a cleanup function', { cause: 'not a function' })
    instance.destroy()
  })

  it('warns once for unknown behaviors and suggests close behavior names', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    container.innerHTML = `<div data-simply-behavior="toooltip"></div>`
    document.body.append(container)

    const instance = behaviors({
      container,
      behaviors: {
        tooltip() {}
      }
    })

    const second = document.createElement('div')
    second.dataset.simplyBehavior = 'toooltip'
    container.append(second)
    await wait()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe('simplyflow/behavior: unknown behavior "toooltip". Did you mean "tooltip"?')
    expect(warn.mock.calls[0][1].cause).toBe(container.querySelector('[data-simply-behavior]'))
    instance.destroy()
  })

  it('stops observing after destroy', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const started = []
    const instance = behaviors({
      container,
      behaviors: {
        tooltip(element) {
          started.push(element)
        }
      }
    })

    instance.destroy()
    const node = document.createElement('div')
    node.dataset.simplyBehavior = 'tooltip'
    container.append(node)
    await wait()

    expect(started).toEqual([])
  })
})
