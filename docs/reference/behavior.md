# Behavior module

```js
import { behaviors } from './src/behavior.mjs'
```

Behaviors attach reusable JavaScript behavior to DOM elements.

## `app({ behaviors })`

```html
<div data-simply-behavior="tabs"></div>
```

```js
app({
  data: {},

  behaviors: {
    tabs(element) {
      element.classList.add('ready')

      return function cleanup(element) {
        element.classList.remove('ready')
      }
    }
  }
})
```

Inside a behavior and its cleanup function, `this` is the app instance.

## Cleanup

A behavior may return a cleanup function. It is called when the element is removed from the app container or when `app.destroy()` is called.

```js
behaviors: {
  resize(element) {
    const listener = () => {}
    window.addEventListener('resize', listener)

    return () => window.removeEventListener('resize', listener)
  }
}
```

If a behavior returns something other than `undefined` or a function, SimplyFlow logs a warning.

## Unknown behaviors

Unknown behavior names warn once and include a suggestion when possible.

```text
simplyflow/behavior: unknown behavior "tabz". Did you mean "tabs"?
```

## Lower-level API

```js
const behaviorApi = behaviors({
  app,
  container,
  behaviors: {
    tabs(element) {}
  }
})

behaviorApi.destroy()
```

The controller observes `container` for added and removed behavior elements.
