# SimplyFlow: state

This is an implementation of the well-known signals/effects paradigm. It lets you
create signals (variables) and effects (functions) with the special ability that
effect functions are automatically run again, if any of the signals that the effect
uses in its function body (in the last run) changes, e.g:

```javascript
let A = signal({value: 'A'})

let B = signal({value: 'B'})

let C = effect(() => {
	return A.value + B.value
})	

let D = effect(() => {
	return C.current + B.value
})

A.value = 'X'

expect(C).toEqual({
	current: 'XB'
})
expect(D).toEqual({
	current: 'XBB'
})
```

Effects return a signal. Each time an effect returns a value, it is assigned to `.current` in that signal.

## Differences to other Signal libraries

1. Signals can contain any javascript object, including arrays, nested objects, maps, sets. Any change inside that object is detected, and any effects using those values will be run again. But signals must be objects, you cannot use plain strings, numbers or booleans, you must wrap those in an object.

2. You can just change any value inside a signal, using javascript functions or assignments. There is no `setValue` function.

3. Signals will work just like the contained value. So if you make a signal of an array, you can just call array functions on the signal. The same for maps, sets, or any custom javascript classes.

4. Effects always return a signal. You can ignore this, but there is no separate `computedEffect`. All effects have this feature. Just use `return` inside the effect function to enable it.

5. Effects van be asynchronous, just add the `async` keyword before the function body:

```javascript
	let url = signal({value: 'https://example.com/'})
	let bar = effect(async () => {
		return fetch(url.value)
	})
```

## SImilarities

Effects are run in-order, glitch-free. You cannot create effects that have circular dependencies, except for the clockEffect - since that breaks the infinite cycle by only doing a single update per clock update.

