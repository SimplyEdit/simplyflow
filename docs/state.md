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

_Note_: You can use the computed signal of an effect inside another effect, but make sure to always use `x.current` inside the effect function. If you assign `foo = x.current` and then use `foo` inside the effect, the system cannot 'see' that you are using a signal. The 'notifier' is called only when you access a property of the signal, e.g. `x.property` and not `x`.

So do this:
```javasript
const options = signal({
	count: 1
})

const result = effect(() => {
	return options.count * 2 // access to .count property of signal options is detected
})
// result.current is now 2

effect(() => {
	document.querySelector('output').innerHTML = result.current // access to .current property of signal result is detected
})
// output now contains '2'

options.count++
// result.current is now 4
// output now contains '4'
```

Do not do this:
```javascript
const options = signal({
	count: 1
})

// DON'T DO THIS!
const count = options.count
const result = effect(() => {
	return count * 2 // access not detected
})

// DON'T DO THIS!
const result2 = result.current
effect(() => {
	document.querySelector('output').innerHTML = result2 // access not detected
})

options.count++
```

Since `result.current` is accessed outside the effect function, the system does not notice that `result2` uses a signal inside the final effect. So if you change `result.current` later, e.g. when you set `options.count` to a new value, `result.current` is updated, but `result2` is not. And even if it is, it won't trigger the final effect again.

The inverse of this does work. You can access child properties of a signal, and if the signal changes such that the child properties change or even disappear, the effect will be called again.

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

## Similarities

Effects are run in-order, glitch-free. You cannot create effects that have circular dependencies, as that would create an infinite loop. However, you can create circular dependencies with a clockEffect - since that breaks the infinite cycle by only doing a single update per clock update.

## API

### signal()

```javascript
const mySignal = signal({
	foo: 'bar'
})
```

Creates a signal from a given object. This object may also be an Array, a Set or a Map, or an instance of your own class definition. It must be an object, you cannot use a string, number. boolean, null or any other value that is not an object.

The returned signal is a completely transparent Proxy for that object, and you should be able to use it anywhere that the original object could be used.

Signals only have additional effects when used inside an `effect()` function.

### effect()

```javascript
const myComputedSignal = effect(() => {
	return mySignal.foo
})
```

An effect is a function that is called immediately when one of the signals it uses changes. It returns a new Signal, called myComputedSignal in the code above. This signal will always have a single property `.current` which contains the result of the last time the effect is called. Effects update their signals synchronously, so this works:

```javascript
let counter = signal({
	value: 1
})
let computed = effect(() => {
	return counter.value * 10
})
console.log(computed.current) // displays (number) 10
counter.value++
console.log(computed.current) // displays (number) 20
```

Effects can not use circular dependencies. You are not allowed to create an effect that depends on a computed signal that changes because of the current effect. That would create an infinite loop.

You also cannot create a recursive call inside an effect, even if it wouldn't cause an infinite loop. This is because simplySignal cannot detect that this is the case, and so counts this as a potential infinite loop.

You can create an asynchronous effect, like this:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let response = effect(async () => {
	return await fetch(url.value)
})
console.log(response.current) // will display 'null'
```

Because the effect function uses `await`, you must declare the effect function as `async`. This means that `response` will be set after `fetch` returns the response.

You cannot chain `.then()` calls outside the async function, the response signal is also not a Promise. If you need to chain await or `.then`, you must do so inside the async effect function:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let response = effect(async () => {
	let response = await fetch(url.value)
	if (response.ok) {
		return response.json() //another promise
	}
	throw new Error('Network error '+response.status)
})
console.log(response.current) // will still display 'null'
```

You can create an effect that uses the computedSignal from the async effect to handle the result, whenever it changes, e.g:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let apiResult = effect(async () => {
	let response = await fetch(url.value)
	if (response.ok) {
		return response.json() //another promise
	}
	throw new Error('Network error '+response.status)
})
effect(() => {
	if (apiResult.current) {
		console.log(apiResult.current)
	}
})
```

Now whenever the url.value changes, the apiResult will update asynchonously, and when it does, the final effect will log the result of that call.

Important: The asynchronous effect function will only be called whenever a signal used before the first `await` or `.then` call changes. Any signals used after that are not detected as a dependency. This is because of how `async`/`await` or Promises work in javascript and cannot be avoided. If you do have such a dependency, make sure you read it-and perhaps set it in a temporary variable-before the first `await` or `.then` call.

### batch()

```javascript
let foo = signal({ value: 'Foo'})
let bar = signal({ value: 'Bar'})
let count = 1
let baz = effect(() => {
	return '"'+foo.value+'":"'+bar.value+'"'+(count++)
})

batch(() +> {
	foo.value = 'foo'
	bar.value = 'bar'
})

console.log(baz.current) // displays: "foo:bar"1
```

The `batch` function allows you to update multiple signals, without triggering effects more than once. Only after your batch function finishes will all effects that depend on changes you made inside the batch function, update.

Unlike some other Signal/Effect implementations, effects always run immediately when a signal they depend on changes. This does help in making sure that the computed signal from an effect always has the correct value. In detail: simplySignal is glitch-free. But it does mean that effects sometimes run too often, e.g. when you update multiple signals. 

The batch() function allows you to prevent this.

### throttledEffect()

```javascript
let foo = signal({ value: 1 })

let bar = throttledEffect(
	() => {
		return foo.value + 1 // imagine a very cpu intensive operation here
	},
	10 // run at most once per 10ms
)

for (let i=0;i<100;i++) {
	foo.value++
}
```

A throttledEffect is identical to a normal effect, except that it will limit updating the effect function to once per given timeperiod, here that is 10ms.

Whenever a change in a signal that it depends on occurs, the effect will run immediately, unless it was called earlier, less than the given timeperiod. After that time period, the effect will update (get called again) if in the mean time a dependency has changed.

In the example code above, the effect is run twice. Once upon definition, as all effects are. And then once after 10ms, because `foo.value` has changed.

### clockEffect()

```javascript
let foo = signal({ value: 0 })
let clock = signal({ time: 0 })

let bar = clockEffect(
	() => {
		console.log(clock.time+': '+foo.value)
	},
	clock
) // console prints '0:0'

foo.value++
// no console log triggered

clock.time++
// console prints '1:1'

clock.time++
// no console log triggered

foo.value++
// no console log triggered

clock.time++
// console prints '3:2'
```

A clockEffect is an effect that is only triggered if the clock.time signal is increased, and any other dependency has changed since the last time the clockEffect has run.

This allows you to create effects with lots of interconnected dependencies, which only run once when the clock progresses. This way you can make cyclical dependencies and not create infinite loops. 


### destroy

```javascript
const foo = signal({value: 1})
const bar = effect(() => {
	return foo+1
})

destroy(bar)
```

This function removes an effect and its associated signal, in this `bar`.

### untracked

This function allows you to use a signal inside an effect, without adding it to the list of tracked signals. This means that you can use a signal value, without triggering the effect if that signal changes.

```javascript
const foo = signal({value: 1})
const bar = signal({value: 2})
const baz = effect(() => {
	let f = foo.value // foo.value is tracked

	return untracked(() => {
		return f + bar.value // bar.value is not tracked
	})

})
```