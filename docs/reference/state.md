# State module

```js
import * as state from './src/state.mjs'
```

The state module contains SimplyFlow's reactive engine: signals, effects, batching and custom signal support.

## `signal(value = {})`

Returns a reactive proxy for an object-like value.

```js
const data = state.signal({ count: 0 })

const doubled = state.effect(() => data.count * 2)

data.count++
doubled.current // 2
```

Signals preserve identity: calling `signal()` for the same object returns the same proxy.

## `effect(fn)`

Runs `fn`, tracks signal reads, and reruns when those values change. Returns a signal result with a `current` property.

```js
const result = state.effect(() => data.count + 1)
result.current
```

## `destroy(effectSignal)`

Stops an effect, throttled effect or clock effect.

```js
const result = state.effect(() => data.count)
state.destroy(result)
```

## `batch(fn)`

Groups updates so dependent effects rerun once after the batch.

```js
state.batch(() => {
  data.first = 'Ada'
  data.last = 'Lovelace'
})
```

If `fn` returns a promise, batch mode remains active until it settles.

## `throttledEffect(fn, throttleTime)`

Like `effect()`, but reruns are throttled by `throttleTime` milliseconds.

```js
const result = state.throttledEffect(() => data.query, 50)
```

Throws if `throttleTime` is not a finite non-negative number.

## `clockEffect(fn, clock)`

Runs an effect only when one of its dependencies changed and `clock.time` increases.

```js
const clock = state.signal({ time: 0 })
const result = state.clockEffect(() => data.value, clock)

data.value = 2
clock.time++
```

This is useful when an external clock or animation frame should control when pending updates are processed.

## `untracked(fn)`

Runs `fn` without collecting signal dependencies.

```js
state.untracked(() => data.count)
```

## Signal helpers

| Function | Description |
| --- | --- |
| `isSignal(value)` | Returns true when `value` is a SimplyFlow signal proxy. |
| `raw(value)` | Returns the raw target behind a signal, otherwise returns `value`. |
| `getSignal(value)` | Returns the registered signal proxy for a raw target, if any. |
| `registerSignal(target, proxy)` | Registers a custom signal proxy for a target. |
| `createSignal(target, handler, init)` | Creates or returns a custom signal proxy using a proxy handler extension. |

## Custom signals

`createSignal()` is the recommended extension point for custom signal implementations.

```js
const proxy = state.createSignal(target, {
  get(target, property, receiver) {
    state.notifyGet(receiver, property)
    return target[property]
  },

  set(target, property, value, receiver) {
    const was = target[property]
    target[property] = value
    state.notifySet(receiver, state.makeContext(property, { was, now: value }))
    return true
  }
})
```

## Low-level notification helpers

These are mainly for custom signal implementations:

| Function/property | Description |
| --- | --- |
| `signals` | Deprecated/low-level `WeakMap` registry from raw targets to signal proxies. Prefer helper functions. |
| `trace(target, prop)` | Returns dependency trace information. |
| `addTracer(tracer)` | Adds a tracing callback. |
| `notifyGet(signal, property)` | Records that the current effect depends on `property`. |
| `notifySet(signal, context)` | Notifies listeners for changed properties. |
| `makeContext(property, change)` | Creates a context map for a single changed property. |

## `clone(value, options?)`

Clones a signal target into non-reactive data. Signals are unwrapped first.

```js
const plain = state.clone(data)
```

By default, cloning is deep. Supported built-in types include plain objects, arrays, `Map`, `Set`, dates, regexps, buffers, typed arrays, `URL`, `URLSearchParams`, blobs/files, errors and DOM nodes.

Custom classes must define `toClone()`:

```js
class Person {
  #name
  constructor(name) { this.#name = name }
  toClone() { return new Person(this.#name) }
}
```

Unsupported objects throw a `TypeError` instead of copying the reference.

Legacy shallow cloning is available with:

```js
state.clone(value, false)
state.clone(value, { deep: false })
```
