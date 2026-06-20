import { jest } from '@jest/globals'
import { effect, signal as stateSignal } from '../src/state.mjs'
import { signal as domSignal, trackDomField, trackDomList } from '../src/dom.mjs'
import { DEP } from '../src/symbols.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

describe('dom signal API contract coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('returns the same DOM proxy and exposes the original element through DEP.XRAY', () => {
    const el = document.createElement('div')
    const first = domSignal(el)

    expect(domSignal(el)).toBe(first)
    expect(domSignal(first)).toBe(first)
    expect(first[DEP.SIGNAL]).toBe(true)
    expect(first[DEP.XRAY]).toBe(el)
  })

  it('tracks attribute, childList and characterData changes', async () => {
    const el = document.createElement('div')
    el.innerHTML = '<span>hello</span>'
    document.body.appendChild(el)
    const dom = domSignal(el)

    const title = effect(() => dom.title)
    const html = effect(() => dom.innerHTML)
    const childCount = effect(() => dom.children.length)

    expect(title.current).toBe('')
    expect(html.current).toBe('<span>hello</span>')
    expect(childCount.current).toBe(1)

    el.setAttribute('title', 'updated')
    el.querySelector('span').firstChild.data = 'world'
    el.appendChild(document.createElement('strong'))
    await wait()

    expect(title.current).toBe('updated')
    expect(html.current).toBe('<span>world</span><strong></strong>')
    expect(childCount.current).toBe(2)
  })

  it('tracks input, textarea and select value changes through user-facing events', () => {
    document.body.innerHTML = `
      <input id="input" value="a">
      <textarea id="textarea">b</textarea>
      <select id="select"><option value="x">X</option><option value="y">Y</option></select>
    `
    const inputEl = document.getElementById('input')
    const textareaEl = document.getElementById('textarea')
    const selectEl = document.getElementById('select')

    const input = domSignal(inputEl)
    const textarea = domSignal(textareaEl)
    const select = domSignal(selectEl)

    const inputValue = effect(() => input.value)
    const textareaValue = effect(() => textarea.value)
    const selectValue = effect(() => select.value)

    inputEl.value = 'changed input'
    inputEl.dispatchEvent(new Event('input'))
    textareaEl.value = 'changed textarea'
    textareaEl.dispatchEvent(new Event('input'))
    selectEl.value = 'y'
    selectEl.dispatchEvent(new Event('change'))

    expect(inputValue.current).toBe('changed input')
    expect(textareaValue.current).toBe('changed textarea')
    expect(selectValue.current).toBe('y')
  })

  it('allows normal proxy operations like `in` and Object.keys without breaking DOM method binding', () => {
    const el = document.createElement('div')
    el.setAttribute('data-test', 'ok')
    const dom = domSignal(el)

    expect('nodeType' in dom).toBe(true)
    expect(() => Object.keys(dom)).not.toThrow()
    expect(dom.getAttribute('data-test')).toBe('ok')
  })

  it('honors custom MutationObserver options', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const dom = domSignal(el, { attributes: true })
    const title = effect(() => dom.title)
    const html = effect(() => dom.innerHTML)

    el.setAttribute('title', 'tracked')
    el.innerHTML = '<span>not tracked</span>'
    await wait()

    expect(title.current).toBe('tracked')
    expect(html.current).toBe('')
  })

  it('updates object fields from a tracked DOM field and does not attach duplicate field trackers', async () => {
    document.body.innerHTML = '<a data-flow-field="link" href="#old">Old</a>'
    const root = stateSignal({ link: { innerHTML: 'Old', href: '#old' } })
    const context = {
      options: { root },
      getBindingPath: () => 'link'
    }
    const anchor = document.querySelector('a')

    trackDomField.call(context, anchor, ['innerHTML', 'href'], false)
    expect(trackDomField.call(context, anchor, ['innerHTML', 'href'], false)).toBeUndefined()

    anchor.innerHTML = 'New'
    anchor.setAttribute('href', '#new')
    await wait()

    expect(root.link.innerHTML).toBe('New')
    expect(root.link.href).toContain('#new')
  })

  it('updates array order and length from a tracked DOM list', async () => {
    document.body.innerHTML = `
      <ul data-flow-list="items">
        <li data-flow-key="0">a</li>
        <li data-flow-key="1">b</li>
        <li data-flow-key="2">c</li>
      </ul>
    `
    const root = stateSignal({ items: ['a', 'b', 'c'] })
    const context = {
      options: { root },
      getBindingPath: () => 'items'
    }
    const list = document.querySelector('ul')
    const [a, b, c] = Array.from(list.children)

    trackDomList.call(context, list)
    list.insertBefore(c, a)
    b.remove()
    await wait()

    expect(root.items).toEqual(['c', 'a'])
  })

  it('reports missing binding paths for DOM tracking helpers', () => {
    const context = { getBindingPath: () => '', options: { root: {} } }
    const el = document.createElement('div')

    expect(() => trackDomList.call(context, el)).toThrow('Could not find binding path for element')
    expect(() => trackDomField.call(context, el, ['innerHTML'], true)).toThrow('Could not find binding path for element')
  })
})


describe('dom signal API oversight fixes', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('reacts when a DOM property is assigned through the DOM signal proxy', () => {
    const inputEl = document.createElement('input')
    inputEl.value = 'start'
    const input = domSignal(inputEl)
    const value = effect(() => input.value)

    expect(value.current).toBe('start')

    input.value = 'changed'

    expect(inputEl.value).toBe('changed')
    expect(value.current).toBe('changed')
  })
})
