import {
  signal,
  effect,
  throttledEffect,
  clockEffect,
  batch,
  trace,
  addTracer,
  notifySet,
  makeContext,
  untracked,
  destroy,
  clone
} from '../src/state.mjs'
import { DEP } from '../src/symbols.mjs'
import { jest } from '@jest/globals'

const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

describe('state API contract coverage', () => {
  it('creates object signals by default, rejects primitives, and returns the same proxy for the same target', () => {
    const defaultSignal = signal()
    expect(defaultSignal[DEP.SIGNAL]).toBe(true)

    for (const value of [null, 1, 'x', true]) {
      expect(() => signal(value)).toThrow('simplyflow/state: signal() expects an object')
    }

    const target = { value: 1 }
    const first = signal(target)
    expect(signal(target)).toBe(first)
    expect(signal(first)).toBe(first)
    expect(first[DEP.XRAY]).toBe(target)
  })

  it('binds methods on boxed primitives and DOM elements to their original target', () => {
    const boxed = signal(new String('hello'))
    expect(boxed.toString()).toBe('hello')

    const input = signal(document.createElement('input'))
    input.setAttribute('value', 'from-attribute')
    expect(input.getAttribute('value')).toBe('from-attribute')
  })

  it('updates object key iteration when Object.defineProperty adds an enumerable property', () => {
    const state = signal({})
    const keys = effect(() => Object.keys(state).join(','))

    expect(keys.current).toBe('')
    Object.defineProperty(state, 'visible', {
      value: 1,
      enumerable: true,
      configurable: true
    })

    expect(keys.current).toBe('visible')
  })

  it('updates Map and Set iteration on delete and clear operations', () => {
    const map = signal(new Map([
      ['a', 1],
      ['b', 2]
    ]))
    const mapKeys = effect(() => [...map.keys()].join(','))
    const mapHasA = effect(() => map.has('a'))

    expect(mapKeys.current).toBe('a,b')
    expect(mapHasA.current).toBe(true)
    map.delete('a')
    expect(mapKeys.current).toBe('b')
    expect(mapHasA.current).toBe(false)
    map.clear()
    expect(mapKeys.current).toBe('')

    const set = signal(new Set(['x', 'y']))
    const setValues = effect(() => [...set.values()].join(','))
    const setHasX = effect(() => set.has('x'))

    expect(setValues.current).toBe('x,y')
    expect(setHasX.current).toBe(true)
    set.delete('x')
    expect(setValues.current).toBe('y')
    expect(setHasX.current).toBe(false)
    set.clear()
    expect(setValues.current).toBe('')
  })

  it('returns listener information from trace(signal, property)', () => {
    const state = signal({ value: 1 })
    const fn = () => state.value * 2
    const result = effect(fn)

    const listeners = trace(state, 'value')

    expect(result.current).toBe(2)
    expect(listeners).toEqual([
      expect.objectContaining({
        effect,
        fn,
        signal: result
      })
    ])
  })

  it('rejects invalid tracing, tracer and low-level notification inputs', () => {
    expect(() => trace({}, 'value')).toThrow('trace() expects either a function or a signal')
    expect(() => addTracer()).toThrow('addTracer() expects a tracer object')
    expect(() => addTracer({})).toThrow('missing "get" or "set" property')
    expect(() => addTracer({ get: true })).toThrow('"get" is not a function')
    expect(() => addTracer({ set: true })).toThrow('"set" is not a function')
    expect(() => notifySet({}, makeContext('value', {}))).toThrow('notifySet() expects a signal')
    expect(() => notifySet(signal({}), {})).toThrow('notifySet() expects context to be a Map')
  })

  it('normalizes makeContext input from maps, plain objects, symbol keys and scalar properties', () => {
    const symbol = Symbol('s')
    const sourceMap = new Map([['a', { now: 1 }]])
    expect(makeContext(sourceMap)).toEqual(sourceMap)

    const objectContext = makeContext({ a: 1, [symbol]: 2 })
    expect(objectContext.get('a')).toBe(1)
    expect(objectContext.get(symbol)).toBe(2)

    const scalarContext = makeContext('value', { was: 1, now: 2 })
    expect(scalarContext.get('value')).toEqual({ was: 1, now: 2 })
  })

  it('rejects invalid effect, batch, throttledEffect, clockEffect, untracked and destroy calls', () => {
    expect(() => effect()).toThrow('effect() expects a function')
    expect(() => batch()).toThrow('batch() expects a function')
    expect(() => throttledEffect(() => {})).toThrow('throttledEffect() expects throttleTime')
    expect(() => throttledEffect(() => {}, -1)).toThrow('throttledEffect() expects throttleTime')
    expect(() => clockEffect(() => {}, { time: 'now' })).toThrow('clockEffect() expects a clock object')
    expect(() => untracked()).toThrow('untracked() expects a function')
    expect(() => destroy(signal({}))).not.toThrow()
    expect(() => destroy({})).toThrow('destroy() expects an effect signal')
  })

  it('keeps batch mode active until an async batch settles', async () => {
    const state = signal({ value: 1 })
    const result = effect(() => state.value)

    await batch(async () => {
      state.value = 2
      await Promise.resolve()
      state.value = 3
      expect(result.current).toBe(1)
    })

    expect(result.current).toBe(3)
  })

  it('supports asynchronous throttled and clock effects', async () => {
    jest.useFakeTimers()
    try {
      const state = signal({ value: 1 })
      const throttled = throttledEffect(async () => state.value * 10, 10)
      await Promise.resolve()
      expect(throttled.current).toBe(10)

      state.value = 2
      jest.advanceTimersByTime(10)
      await Promise.resolve()
      expect(throttled.current).toBe(20)
    } finally {
      jest.useRealTimers()
    }

    const clock = signal({ time: 0 })
    const state = signal({ value: 4 })
    const clocked = clockEffect(async () => state.value * 2, clock)
    await Promise.resolve()
    expect(clocked.current).toBe(8)

    state.value = 5
    clock.time++
    await Promise.resolve()
    expect(clocked.current).toBe(10)
  })

  it('clones shallow arrays, deep plain objects, null-prototype objects, cycles and primitives predictably', () => {
    const nested = { value: 1 }
    const shallowArray = clone([nested])
    expect(shallowArray).toEqual([nested])
    expect(shallowArray[0]).toBe(nested)

    const object = { nested: { value: 1 } }
    const objectCopy = clone(object, true)
    expect(objectCopy).toEqual(object)
    expect(objectCopy.nested).not.toBe(object.nested)

    const nullProto = Object.create(null)
    nullProto.name = 'null-proto'
    const nullProtoCopy = clone(nullProto, true)
    expect(Object.getPrototypeOf(nullProtoCopy)).toBeNull()
    expect(nullProtoCopy.name).toBe('null-proto')

    const cyclical = { name: 'cycle' }
    cyclical.self = cyclical
    const cycleCopy = clone(cyclical, true)
    expect(cycleCopy).not.toBe(cyclical)
    expect(cycleCopy.self).toBe(cycleCopy)

    const date = new Date('2020-01-01T00:00:00Z')
    expect(clone(date, true)).toBe(date)
    expect(clone(null, true)).toBeNull()
    expect(clone(42, true)).toBe(42)
  })
})

describe('state API oversight fixes', () => {
  it('reacts when Object.defineProperty changes an existing value or enumerability', () => {
    const state = signal({ visible: 1, hidden: 2 })
    const visible = effect(() => state.visible)
    const keys = effect(() => Object.keys(state).join(','))

    expect(visible.current).toBe(1)
    expect(keys.current).toBe('visible,hidden')

    Object.defineProperty(state, 'visible', {
      value: 3,
      enumerable: true,
      configurable: true
    })
    expect(visible.current).toBe(3)

    Object.defineProperty(state, 'hidden', {
      value: 2,
      enumerable: false,
      configurable: true
    })
    expect(keys.current).toBe('visible')
  })

  it('reacts when deleting an own property whose value is undefined', () => {
    const state = signal({ maybe: undefined })
    const hasMaybe = effect(() => 'maybe' in state)
    const keys = effect(() => Object.keys(state).join(','))

    expect(hasMaybe.current).toBe(true)
    expect(keys.current).toBe('maybe')

    delete state.maybe

    expect(hasMaybe.current).toBe(false)
    expect(keys.current).toBe('')
  })

  it('keeps the in operator and same-value inherited assignments transparent', () => {
    const raw = Object.create({ inherited: true })
    const state = signal(raw)
    const hasInherited = effect(() => 'inherited' in state)
    const keys = effect(() => Object.keys(state).join(','))

    expect(hasInherited.current).toBe(true)
    expect(keys.current).toBe('')

    state.inherited = true

    expect(Object.hasOwn(raw, 'inherited')).toBe(true)
    expect(hasInherited.current).toBe(true)
    expect(keys.current).toBe('inherited')
  })

  it('reacts when direct array length assignment removes indexed items', () => {
    const state = signal(['a', 'b', 'c'])
    const third = effect(() => state[2])
    const rendered = effect(() => [...state].join(','))

    expect(third.current).toBe('c')
    expect(rendered.current).toBe('a,b,c')

    state.length = 1

    expect(third.current).toBeUndefined()
    expect(rendered.current).toBe('a')
  })

  it('reacts for Map entry readers when Map.clear removes their key', () => {
    const map = signal(new Map([
      ['a', 1],
      ['b', 2]
    ]))
    const a = effect(() => map.get('a'))
    const hasB = effect(() => map.has('b'))

    expect(a.current).toBe(1)
    expect(hasB.current).toBe(true)

    map.clear()

    expect(a.current).toBeUndefined()
    expect(hasB.current).toBe(false)
  })

  it('leaves batch mode when an async batch rejects', async () => {
    const state = signal({ value: 1 })
    const result = effect(() => state.value)

    await expect(batch(async () => {
      state.value = 2
      throw new Error('boom')
    })).rejects.toThrow('boom')

    expect(result.current).toBe(2)

    state.value = 3
    expect(result.current).toBe(3)
  })

  it('destroy stops throttled and clock effects and allows an effect function to be reused', () => {
    jest.useFakeTimers()
    try {
      const state = signal({ value: 1 })
      const throttled = throttledEffect(() => state.value, 10)

      destroy(throttled)
      state.value = 2
      jest.advanceTimersByTime(20)

      expect(throttled.current).toBe(1)
    } finally {
      jest.useRealTimers()
    }

    const state = signal({ value: 1 })
    const clock = signal({ time: 0 })
    const clocked = clockEffect(() => state.value, clock)

    destroy(clocked)
    state.value = 2
    clock.time++

    expect(clocked.current).toBe(1)

    const fn = () => state.value
    const first = effect(fn)
    destroy(first)
    const second = effect(fn)

    expect(second.current).toBe(2)
    destroy(second)
  })
})
