import { signal, effect, batch, throttledEffect, clockEffect } from '../src/state.mjs'

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

	it('throttledEffect', (done) => {
		let foo = signal({ value: 1})
		let count = 0
		let bar = throttledEffect(() => {
			return foo.value+':'+count++
		}, 10)
		// throttled effect is called immediately
		expect(bar.current).toBe('1:0')
		for (let i=0;i<10;i++) {
			setTimeout(() => {
				foo.value++
			},1)
		}
		setTimeout(() => {
			// throttled effect called only once in each 10ms
			try {
				expect(bar.current).toBe('11:1')
			} finally {
				setTimeout(() => {
					// make sure that throttle end timeout is only called if foo.value has changed in the mean time
					try {
						expect(bar.current).toBe('11:1')
					} finally {
						done()
					}
				}, 20)
			}
		}, 20)
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
})