import { jest } from '@jest/globals'
import { signal as domSignal } from '../src/dom.mjs'
import { DEP } from '../src/symbols.mjs'
import {
  signal,
  createSignal,
  registerSignal,
  getSignal,
  isSignal,
  raw,
  effect,
  throttledEffect,
  clockEffect,
  batch,
  trace,
  addTracer,
  notifyGet,
  notifySet,
  makeContext,
  untracked,
  destroy,
  clone
} from '../src/state.mjs'

const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

class Foo {
	#bar

	constructor() {
		this.#bar = 'bar'
	}

	toString() {
		return '"'+this.bar+'"'
	}

	get bar() {
		return this.#bar
	}

	set bar(value) {
		this.#bar = value
	}
}

describe('basic signals can', () => {
	it('trigger effects', () => {
		let A = signal({value: 'A'})

		let B = signal({value: 'B'})

		let C = effect(() => {
			return A.value + B.value
		})	

		expect(C).toEqual({
			current: 'AB'
		})

		let D = effect(() => {
			return C.current + B.value
		})

		expect(D).toEqual({
			current: 'ABB'
		})

		A.value = 'X'

		expect(C).toEqual({
			current: 'XB'
		})
		expect(D).toEqual({
			current: 'XBB'
		})
	})

	it('be arrays', () => {
		let A = signal([1,2])
		let B = effect(() => {
			return A.length
		})
		expect(B.current).toBe(A.length)
		expect(B.current).toBe(2)
		A.push(3)
		expect(B.current).toBe(A.length)
		expect(B.current).toBe(3)
	})

	it('be deep objects', () => {
		let A = signal({
			foo: {
				bar: "baz"
			}
		})
		let B = effect(() => {
			return 'foo.bar is now '+A.foo.bar
		})
		expect(B.current).toBe('foo.bar is now baz')
		A.foo.bar = 'bar'
		expect(B.current).toBe('foo.bar is now bar')
	})

	it('update on array function calls', () => {
		let A = signal({value: 'A'})
		let B = signal({value: 'B'})
		let C = signal([A,B])
		let count = 1
		let D = effect(() => {
			return {
				count: count++,
				value: C[0]
			}
		})
		expect(D.current.value).toEqual(C[0])
		expect(C[0]).toEqual(A)
		expect(D.current.count).toBe(1) // makes sure the effect has run once
		C.reverse()
		expect(D.current.value).toEqual(C[0])
		expect(C[0]).toEqual(B)
		expect(D.current.count).toBe(2) // makes sure that the effect has run exactly once more
	})

	it('be iterated over', () => {
		let A = signal([1,2,3])
		let B = null
		for (let i of A) { // this is the test - can i iterate over a signal?
			B = i
		}
		expect(B).toBe(A[2])
		expect(B).toBe(3)
	})

	it('handle deep delete', () => {
		let foo = signal({
			bar: {
				baz: "baz"
			}
		})
		let bar = effect(() => {
			return foo?.bar?.baz
		})
		expect(bar.current).toBe('baz')
		delete foo.bar
		expect(bar.current).toBe(undefined)
		foo.bar = {
			baz: "baz2"
		}
		expect(bar.current).toBe('baz2')
	})

	it('be a Set', () => {
		let foo = signal(new Set())
		foo.add(1)
		let bar = effect(() => {
			return foo.size
		})
		expect(bar.current).toBe(1)
		foo.add(2)
		expect(bar.current).toBe(2)
		foo.add(1)
		expect(bar.current).toBe(2)
	})

	it('detect array iteration', () => {
		let foo = signal([1,2,3])
		let bar = effect(() => {
			let r = []
			for (let n of foo) {
				r.push(n)
			}
			return r
		})
		expect(bar.current).toEqual([1,2,3])
		foo.push(4)
		expect(bar.current).toEqual([1,2,3,4])
	})

	it('detect object iteration', () => {
		let foo = signal({
			bar: 'bar'
		})
		let bar = effect(() => {
			let r = {}
			for (let k in foo) {
				r[k] = foo[k]
			}
			return r
		})
		expect(bar.current).toEqual(foo)
		foo.baz = 'baz'
		expect(bar.current).toEqual(foo)
	})

	it('handle Set functions', () => {
		let foo = signal(new Set())
		foo.add(1)
		let bar = effect(() => {
			return Array.from(foo.values()).join(',')
		})
		expect(bar.current).toBe('1')
		foo.add(2)
		expect(bar.current).toBe('1,2')
		foo.add(1)
		expect(bar.current).toBe('1,2')
	})

	it('be a Map', () => {
		let foo = signal(new Map())
		foo.set('bar', 'bar')
		let bar = effect(() => {
			return foo.size
		})
		expect(bar.current).toBe(1)
		foo.set('baz','baz')
		expect(bar.current).toBe(2)
	})

	it('handle Map functions', () => {
		let foo = signal(new Map())
		foo.set('bar','bar')
		let bar = effect(() => {
			return Array.from(foo.values()).join(',')
		})
		expect(bar.current).toBe('bar')
		foo.set('baz','baz')
		expect(bar.current).toBe('bar,baz')
	})

	it('be a Custom class', () => {
		let foo = signal(new Foo())
		let bar = effect(() => {
			return foo.toString()
		})
		expect(foo.bar).toBe('bar')
		expect(bar.current).toBe('"bar"')
		foo.bar = 'baz'
		expect(foo.bar).toBe('baz')
		expect(bar.current).toBe('"baz"')
	})

	it('tracks only dependencies from the latest effect run', () => {
		const state = signal({
			useA: true,
			a: 1,
			b: 10
		})
		let runs = 0
		const result = effect(() => {
			runs++
			return state.useA ? state.a : state.b
		})
		expect(result.current).toBe(1)
		expect(runs).toBe(1)

		state.useA = false
		expect(result.current).toBe(10)
		expect(runs).toBe(2)

		state.a = 2
		// changing a should no longer trigger the effect
		expect(result.current).toBe(10)
		expect(runs).toBe(2)

		state.b = 20
		expect(result.current).toBe(20)
		expect(runs).toBe(3)
	})

	it('tracks the in operator', () => {
		const state = signal({
			foo: 1
		})
		const result = effect(() => {
			return 'foo' in state
		})
		expect(result.current).toBe(true)

		delete state.foo
		expect(result.current).toBe(false)
	})

	it('updates object key iteration when a property is deleted', () => {
		const state = signal({
			a: 1,
			b: 2
		})
		const result = effect(() => {
			return Object.keys(state).join(',')
		})
		expect(result.current).toBe('a,b')

		delete state.b
		expect(result.current).toBe('a')
	})

	it('updates effects on direct array index assignment', () => {
		const state = signal(['a'])
		const result = effect(() => {
			return state[0]
		})
		expect(result.current).toBe('a')

		state[0] = 'b'
		expect(result.current).toBe('b')
	})

	it('tracks nested properties after replacing a parent object', () => {
		const state = signal({
			user: {
				name: 'Alice'
			}
		})
		const result = effect(() => {
			return state.user.name
		})
		expect(result.current).toBe('Alice')

		state.user = {
			name: 'Bob'
		}
		expect(result.current).toBe('Bob')

		state.user.name = 'Carol'
		expect(result.current).toBe('Carol')
	})

	it('updates effects that read a Map entry', () => {
		const map = signal(
			new Map([
				['a', 1]
			])
		)
		const result = effect(() => {
			return map.get('a')
		})
		expect(result.current).toBe(1)

		map.set('a', 2)
		expect(result.current).toBe(2)
	})

	it('tracks Map.has()', () => {
		const map = signal(new Map())
		const result = effect(() => {
			return map.has('foo')
		})
		expect(result.current).toBe(false)

		map.set('foo', 1)
		expect(result.current).toBe(true)

		map.delete('foo')
		expect(result.current).toBe(false)
	})

	it('updates effects that iterate a Set directly', () => {
		const set = signal(new Set([1]))
		const result = effect(() => {
			return [...set].join(',')
		})
		expect(result.current).toBe('1')

		set.add(2)
		expect(result.current).toBe('1,2')
	})
})

describe('signals and effects', () => {
	it('cannot have cycles', () => {
		let A = signal({value: 'A'})
		let B = signal({current: 'B'})
		B = effect(() => {
			return A.value+B.current
		})
		const t = () => {
			A.value = 'X'; // expect to throw a cycle error here
		}
		expect(t).toThrow(Error)
	})
})


describe('code from documentation:', () => {
	it('todo', () => {
		const todos = signal([])

		const counter = effect(() => {
			return todos.filter(todo => !todo.done).length
		})

		todos.push({title: "Buy milk", done: false})

		expect(counter.current).toBe(1)
		todos[0].done = true
		expect(counter.current).toBe(0)
	})
})


describe('effects', () => {
	it('can be batched', () => {
		let foo = signal({value: 'Foo'})
		let bar = effect(() => {
			return '"'+foo.value+'"'
		})
		batch(() => {
			foo.value = 'Bar'
			expect(bar.current).toBe('"Foo"')
			foo.value = 'Baz'
			expect(bar.current).toBe('"Foo"')
		})
		expect(bar.current).toBe('"Baz"')
	})

	it('be async', (done) => {
		let foo = signal({value: 'Foo'})
		let bar = effect(async () => {
			return '"'+foo.value+'"'
		})
		expect(bar.current).toBe(null)
		setTimeout(() => {
			expect(bar.current).toBe('"Foo"')
			foo.value = 'Bar'
			expect(bar.current).toBe('"Foo"')
			setTimeout(() => {
				expect(bar.current).toBe('"Bar"')
				done()
			}, 10)
		},10)
	})

	it('can be decoupled from signals using untracked', () => {
		let foo = signal({value: 'Foo'})
		let bar = effect(() => {
			return untracked(() => {
				return '"'+foo.value+'"'
			})
		})
		expect(bar.current).toBe('"Foo"')
		foo.value = 'Baz'
		expect(bar.current).toBe('"Foo"')
	})

	it('still runs other effects inside untracked', () => {
		let foo = signal({value: 'Foo'})
		let baz = effect(() => {
			return foo.value+'bar'
		})
		let bar = effect(() => {
			return untracked(() => {
				foo.value+='-foo'
				return '"'+foo.value+'"'
			})
		})
		expect(baz.current).toBe('Foo-foobar')
		foo.value = 'Baz'
		expect(bar.current).toBe('"Foo-foo"')
		expect(baz.current).toBe('Bazbar')
	})

	it('throttledEffect', () => {
		jest.useFakeTimers()
		try {			
			let foo = signal({ value: 1})
			let count = 0
			let bar = throttledEffect(() => {
				return foo.value+':'+count++
			}, 10)
			// throttled effect is called immediately
			expect(bar.current).toBe('1:0')
			
			for (let i=0;i<10;i++) {
				foo.value++
			}
			expect(bar.current).toBe('1:0')

			jest.advanceTimersByTime(10)
			expect(bar.current).toBe('11:1')

			jest.advanceTimersByTime(200)
			expect(bar.current).toBe('11:1')
		} finally {
			jest.useRealTimers()
		}
	})

	it('clockEffect', () => {
		let foo = signal({value: 1})
		let count = 0
		let clock = signal({
			time: 0
		})
		let bar = clockEffect(() => {
			return foo.value + ':' + count++
		}, clock)
		expect(bar.current).toBe('1:0')
		foo.value = 2
		foo.value = 3
		expect(bar.current).toBe('1:0') // only recompute if the clock has progressed
		clock.time += 1
		expect(bar.current).toBe('3:1') // so here
		clock.time += 1
		expect(bar.current).toBe('3:1') // and only recompute if foo.value has changed too
	})

	it('are glitchfree', (done) => {
		let seconds = signal({ value: 0})
		let q = effect(() => {
			return seconds.value + 1
		})
		let v = effect(() => {
			return q.current > seconds.value
		})
		for (let i=0;i<10;i++) {
			setTimeout(() => {
				seconds.value++
				expect(q.current).toBe(seconds.value+1)
				expect(v.current).toBe(true)
			})
		}
		setTimeout(() => {
			done()
		}, 20)
	})

	it('are run only once per change', () => {
		let foo = signal({ value: 1 })
		let bar = effect(() => {
			foo.value++
			return foo.value + ' bar'
		})
		let count = 0
		let baz = effect(() => {
			count++
			return foo.value + ' baz ' + count
		})
		expect(baz.current).toBe('2 baz 1')
		foo.value++
		expect(baz.current).toBe('4 baz 2')
	})

	it('can be traced', () => {
		let foo = signal({ value: 1 })
		let bar = effect(() => {
			return foo.value + ' bar'
		})
		let count = 0
		let tracing = []
		addTracer({
			get: (s, p) => {
				tracing.push({ get: {s, p}})
			},
			set: (s, c, l) => {
				tracing.push({ set: {s, c, l}})
			}
		})
		trace(() => {
			foo.value++
		})
		expect(bar.current).toBe('2 bar')
		expect(tracing[0].set.s === foo)
		expect(tracing[0].set.c.has('value')).toBe(true)
		expect(tracing[1].get.s === foo)
		expect(tracing[1].get.p === 'value')
	})

	it('does not wrap signals', () => {
		let nonproxy = {value: 'foo'}
		let foo = signal(nonproxy)
		let bar = signal({bar: foo})
		expect(bar.bar[DEP.SIGNAL][DEP.SIGNAL]).toBe(undefined)
		expect(bar.bar).toBe(foo)
	})

	it('does not track async dependencies read after await', (done) => {
		const before = signal({
			value: 1
		})
		const after = signal({
			value: 10
		})

		const result = effect(async () => {
			const x = before.value
			await Promise.resolve()
			return x + after.value
		})

		setTimeout(() => {
			try {
				expect(result.current).toBe(11)

				after.value = 20
				setTimeout(() => {
					try {
						// dependency read after await should not retrigger
						expect(result.current).toBe(11)

						before.value = 2
						setTimeout(() => {
							try {
								expect(result.current).toBe(22)
								done()
							} catch (e) {
								done(e)
							}
						}, 10)
					} catch (e) {
						done(e)
					}
				}, 10)
			} catch (e) {
				done(e)
			}
		}, 10)
	})
})

describe('dom signals can', (done) => {
	it('trigger effects', () => {
		const source = `<div id="foo">foo</div>`
		document.body.innerHTML = source

		const foo = domSignal(document.getElementById('foo'))

		let currentFoo
		effect(() => {
			currentFoo = foo.innerHTML
		})
		expect(currentFoo).toBe('foo')

		document.getElementById('foo').innerHTML = 'bar'

		setTimeout(() => {
			expect(currentFoo).toBe('bar')
			done()
		});
	})

	it('trigger effects on child data changes', () => {
		const source = `<div id="foo"><span id="bar">foo</span></div>`
		document.body.innerHTML = source

		const foo = domSignal(document.getElementById('foo'))

		let currentFoo
		effect(() => {
			currentFoo = foo.querySelector('#bar').innerHTML
		})
		expect(currentFoo).toBe('foo')

		document.getElementById('bar').innerHTML = 'bar'

		setTimeout(() => {
			expect(currentFoo).toBe('bar')
			done()
		});
	})
})

describe('destroy', () => {
	it('stops an effect from receiving updates', () => {
		const state = signal({
			value: 1
		})

		let runs = 0

		const result = effect(() => {
			runs++
			return state.value
		})

		expect(result.current).toBe(1)
		expect(runs).toBe(1)

		destroy(result)

		state.value = 2

		expect(result.current).toBe(1)
		expect(runs).toBe(1)
	})

	it('does not throw when destroying an effect twice', () => {
		const state = signal({
			value: 1
		})

		const result = effect(() => state.value)

		expect(() => {
			destroy(result)
			destroy(result)
		}).not.toThrow()
	})
})

describe('clone', () => {
	it('deep clones arrays', () => {
		const original = [
			{
				value: 1
			}
		]

		const copy = clone(original, true)

		expect(copy).toEqual(original)
		expect(copy).not.toBe(original)
		expect(copy[0]).not.toBe(original[0])

		copy[0].value = 2

		expect(original[0].value).toBe(1)
	})

	it('deep clones nested arrays', () => {
		const original = [[1], [2]]

		const copy = clone(original, true)

		expect(copy).toEqual([[1], [2]])
		expect(copy).not.toBe(original)
		expect(copy[0]).not.toBe(original[0])
		expect(copy[1]).not.toBe(original[1])
	})
})
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



  it('exposes signal identity helpers without requiring DEP symbols', () => {
    const target = { value: 1 }
    const state = signal(target)

    expect(isSignal(state)).toBe(true)
    expect(isSignal(target)).toBe(false)
    expect(raw(state)).toBe(target)
    expect(raw(target)).toBe(target)
    expect(getSignal(target)).toBe(state)
    expect(getSignal(state)).toBe(state)
  })

  it('creates custom signal implementations with createSignal()', () => {
    const target = { value: 1 }
    const custom = createSignal(target, {
      get(target, property, receiver) {
        notifyGet(receiver, property)
        return target[property]
      },
      set(target, property, value, receiver) {
        const was = target[property]
        target[property] = value
        const now = target[property]
        if (!Object.is(was, now)) {
          notifySet(receiver, makeContext(property, { was, now }))
        }
        return true
      }
    })

    const result = effect(() => custom.value * 2)

    expect(isSignal(custom)).toBe(true)
    expect(raw(custom)).toBe(target)
    expect(getSignal(target)).toBe(custom)
    expect(result.current).toBe(2)

    custom.value = 5
    expect(result.current).toBe(10)
  })

  it('runs createSignal init only when a new proxy is registered', () => {
    const target = { value: 1 }
    const init = jest.fn()
    const first = createSignal(target, {}, init)
    const secondInit = jest.fn()

    expect(init).toHaveBeenCalledWith(target, first)
    expect(createSignal(target, {}, secondInit)).toBe(first)
    expect(secondInit).not.toHaveBeenCalled()
    expect(createSignal(first, {}, secondInit)).toBe(first)
  })

  it('allows low-level signal registration for hand-built proxies', () => {
    const target = { value: 1 }
    const proxy = new Proxy(target, {
      get(target, property, receiver) {
        if (property === DEP.XRAY) {
          return target
        }
        if (property === DEP.SIGNAL) {
          return true
        }
        notifyGet(receiver, property)
        return target[property]
      }
    })

    expect(registerSignal(target, proxy)).toBe(proxy)
    expect(getSignal(target)).toBe(proxy)
    expect(isSignal(proxy)).toBe(true)
    expect(raw(proxy)).toBe(target)
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

  it('keeps one scheduler listener per clock and runs only pending clock effects on tick', () => {
    const clock = signal({ time: 0 })
    const left = signal({ value: 1 })
    const right = signal({ value: 10 })
    let leftRuns = 0
    let rightRuns = 0

    const leftResult = clockEffect(() => {
      leftRuns++
      return `${clock.time}:${left.value}`
    }, clock)
    const rightResult = clockEffect(() => {
      rightRuns++
      return `${clock.time}:${right.value}`
    }, clock)

    expect(leftResult.current).toBe('0:1')
    expect(rightResult.current).toBe('0:10')
    expect(leftRuns).toBe(1)
    expect(rightRuns).toBe(1)
    expect(trace(clock, 'time')).toHaveLength(1)

    clock.time++
    expect(leftResult.current).toBe('0:1')
    expect(rightResult.current).toBe('0:10')
    expect(leftRuns).toBe(1)
    expect(rightRuns).toBe(1)

    left.value = 2
    left.value = 3
    expect(leftResult.current).toBe('0:1')

    clock.time++
    expect(leftResult.current).toBe('2:3')
    expect(rightResult.current).toBe('0:10')
    expect(leftRuns).toBe(2)
    expect(rightRuns).toBe(1)
  })

  it('runs batched clock effects when a source changes in the same batch as the clock tick', () => {
    const clock = signal({ time: 0 })
    const state = signal({ value: 1 })
    const result = clockEffect(() => state.value, clock)

    batch(() => {
      clock.time++
      state.value = 2
    })

    expect(result.current).toBe(2)
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

  it('deep-clones plain objects, arrays, null-prototype objects, cycles and primitives by default', () => {
    const nested = { value: 1 }
    const arrayCopy = clone([nested])
    expect(arrayCopy).toEqual([nested])
    expect(arrayCopy[0]).not.toBe(nested)

    const object = { nested: { value: 1 } }
    const objectCopy = clone(object)
    expect(objectCopy).toEqual(object)
    expect(objectCopy.nested).not.toBe(object.nested)

    const shallowCopy = clone(object, false)
    expect(shallowCopy).toEqual(object)
    expect(shallowCopy.nested).toBe(object.nested)

    const nullProto = Object.create(null)
    nullProto.name = 'null-proto'
    const nullProtoCopy = clone(nullProto)
    expect(Object.getPrototypeOf(nullProtoCopy)).toBeNull()
    expect(nullProtoCopy.name).toBe('null-proto')

    const cyclical = { name: 'cycle' }
    cyclical.self = cyclical
    const cycleCopy = clone(cyclical)
    expect(cycleCopy).not.toBe(cyclical)
    expect(cycleCopy.self).toBe(cycleCopy)

    expect(clone(null)).toBeNull()
    expect(clone(42)).toBe(42)
  })

  it('clones standard built-in object types instead of returning shared references', () => {
    const key = { id: 'key' }
    const value = { id: 'value' }
    const source = {
      map: new Map([[key, value]]),
      set: new Set([value]),
      date: new Date('2020-01-01T00:00:00Z'),
      regexp: /hello/gi,
      buffer: new ArrayBuffer(4),
      typed: new Uint16Array([1, 2]),
      view: new DataView(new Uint8Array([1, 2, 3, 4]).buffer),
      url: new URL('https://example.com/path?x=1'),
      params: new URLSearchParams('a=1&b=2')
    }
    source.regexp.lastIndex = 2
    new Uint8Array(source.buffer)[0] = 7

    const copy = clone(source)

    expect(copy).not.toBe(source)
    expect(copy.map).not.toBe(source.map)
    expect([...copy.map.keys()][0]).not.toBe(key)
    expect([...copy.map.values()][0]).not.toBe(value)
    expect(copy.set).not.toBe(source.set)
    expect([...copy.set][0]).not.toBe(value)
    expect(copy.date).not.toBe(source.date)
    expect(copy.date.getTime()).toBe(source.date.getTime())
    expect(copy.regexp).not.toBe(source.regexp)
    expect(copy.regexp.source).toBe(source.regexp.source)
    expect(copy.regexp.flags).toBe(source.regexp.flags)
    expect(copy.regexp.lastIndex).toBe(2)
    expect(copy.buffer).not.toBe(source.buffer)
    expect(new Uint8Array(copy.buffer)[0]).toBe(7)
    expect(copy.typed).not.toBe(source.typed)
    expect([...copy.typed]).toEqual([1, 2])
    expect(copy.view).not.toBe(source.view)
    expect(copy.view.getUint8(0)).toBe(1)
    expect(copy.url).not.toBe(source.url)
    expect(copy.url.href).toBe(source.url.href)
    expect(copy.params).not.toBe(source.params)
    expect(copy.params.toString()).toBe('a=1&b=2')
  })

  it('clones signals as non-reactive, independent raw values', () => {
    const state = signal({
      nested: { value: 1 },
      map: new Map([['item', { value: 2 }]])
    })
    const nestedEffect = effect(() => state.nested.value)
    const mapEffect = effect(() => state.map.get('item').value)

    const copy = clone(state)
    copy.nested.value = 10
    copy.map.get('item').value = 20

    expect(nestedEffect.current).toBe(1)
    expect(mapEffect.current).toBe(2)
    expect(state.nested.value).toBe(1)
    expect(state.map.get('item').value).toBe(2)
  })

  it('uses toClone for custom classes and throws for unsupported objects', () => {
    class Secret {
      #value
      constructor(value) {
        this.#value = value
      }
      get value() {
        return this.#value
      }
      toClone() {
        return new Secret(this.#value)
      }
    }

    class Unsupported {
      #value = 1
      get value() {
        return this.#value
      }
    }

    const original = new Secret(7)
    const copy = clone(original)
    expect(copy).toBeInstanceOf(Secret)
    expect(copy).not.toBe(original)
    expect(copy.value).toBe(7)

    expect(() => clone(new Unsupported())).toThrow(/cannot clone Unsupported/)
    expect(() => clone({ item: new Unsupported() })).toThrow(/cannot clone Unsupported/)
  })

  it('throws instead of cloning custom accessors or broken toClone implementations', () => {
    const accessorObject = {}
    Object.defineProperty(accessorObject, 'hidden', {
      get() {
        return 1
      },
      enumerable: true
    })

    const broken = {
      toClone() {
        return this
      }
    }

    expect(() => clone(accessorObject)).toThrow(/cannot clone Object/)
    expect(() => clone(broken)).toThrow(/toClone\(\) returned the original object/)
    expect(() => clone({}, 'deep')).toThrow(/expects options/)
  })

  it('supports option objects, standard errors and DOM nodes', () => {
    const source = {
      nested: { value: 1 },
      error: new TypeError('broken', { cause: new Error('cause') }),
      element: document.createElement('section')
    }
    source.element.innerHTML = '<p>Hello</p>'

    const shallowCopy = clone(source, { deep: false })
    expect(shallowCopy.nested).toBe(source.nested)

    const copy = clone(source)
    expect(copy.error).toBeInstanceOf(TypeError)
    expect(copy.error).not.toBe(source.error)
    expect(copy.error.message).toBe('broken')
    expect(copy.error.cause).toBeInstanceOf(Error)
    expect(copy.error.cause).not.toBe(source.error.cause)
    expect(copy.element).not.toBe(source.element)
    expect(copy.element.outerHTML).toBe('<section><p>Hello</p></section>')
  })

  it('clones optional platform cloneable objects when available', () => {
    if (typeof SharedArrayBuffer !== 'undefined') {
      const shared = new SharedArrayBuffer(2)
      new Uint8Array(shared)[0] = 9
      const copy = clone(shared)
      expect(copy).not.toBe(shared)
      expect(new Uint8Array(copy)[0]).toBe(9)
    }

    if (typeof Blob !== 'undefined') {
      const blob = new Blob(['hello'], { type: 'text/plain' })
      const copy = clone(blob)
      expect(copy).not.toBe(blob)
      expect(copy.size).toBe(blob.size)
      expect(copy.type).toBe(blob.type)
    }

    if (typeof File !== 'undefined') {
      const file = new File(['hello'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 123
      })
      const copy = clone(file)
      expect(copy).not.toBe(file)
      expect(copy.name).toBe('hello.txt')
      expect(copy.type).toBe('text/plain')
      expect(copy.lastModified).toBe(123)
    }
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

  it('keeps object-valued Map keys intact when notifying entry readers', () => {
    const key = { id: 'entry' }
    const map = signal(new Map([[key, 'first']]))
    const result = effect(() => map.get(key))

    expect(result.current).toBe('first')

    map.set(key, 'second')

    expect(result.current).toBe('second')
  })

  it('does not rerun Map effects for no-op writes', () => {
    const map = signal(new Map([
      ['a', 1],
      ['nan', NaN]
    ]))
    let entryRuns = 0
    let iterationRuns = 0
    const entry = effect(() => {
      entryRuns++
      return map.get('a')
    })
    const keys = effect(() => {
      iterationRuns++
      return [...map.keys()].join(',')
    })

    expect(entry.current).toBe(1)
    expect(keys.current).toBe('a,nan')
    expect(entryRuns).toBe(1)
    expect(iterationRuns).toBe(1)

    map.set('a', 1)
    map.set('nan', NaN)
    map.delete('missing')

    expect(entry.current).toBe(1)
    expect(keys.current).toBe('a,nan')
    expect(entryRuns).toBe(1)
    expect(iterationRuns).toBe(1)

    map.clear()
    expect(entry.current).toBeUndefined()
    expect(keys.current).toBe('')
    expect(entryRuns).toBe(2)
    expect(iterationRuns).toBe(2)

    map.clear()
    expect(entryRuns).toBe(2)
    expect(iterationRuns).toBe(2)
  })

  it('does not rerun Set effects for no-op writes', () => {
    const set = signal(new Set(['a']))
    let hasRuns = 0
    let iterationRuns = 0
    const hasA = effect(() => {
      hasRuns++
      return set.has('a')
    })
    const values = effect(() => {
      iterationRuns++
      return [...set.values()].join(',')
    })

    expect(hasA.current).toBe(true)
    expect(values.current).toBe('a')
    expect(hasRuns).toBe(1)
    expect(iterationRuns).toBe(1)

    set.add('a')
    set.delete('missing')

    expect(hasA.current).toBe(true)
    expect(values.current).toBe('a')
    expect(hasRuns).toBe(1)
    expect(iterationRuns).toBe(1)

    set.clear()
    expect(hasA.current).toBe(false)
    expect(values.current).toBe('')
    expect(hasRuns).toBe(2)
    expect(iterationRuns).toBe(2)

    set.clear()
    expect(hasRuns).toBe(2)
    expect(iterationRuns).toBe(2)
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
