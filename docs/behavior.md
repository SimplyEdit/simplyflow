# Behaviors

Behaviors attach reusable JavaScript behavior to DOM elements.
They are useful when an element needs setup code that is not just a command or data binding, such as tabs, a date picker, a map widget or a third-party UI library.

```html
<div data-simply-behavior="tabs"></div>
```

```javascript
app({
  data: {},

  behaviors: {
    tabs(element) {
      element.classList.add('ready')
    }
  }
})
```

Inside a behavior, `this` is the app instance.

```javascript
behaviors: {
  focusFirstInput(element) {
    element.querySelector('input')?.focus()
    this.data.ready = true
  }
}
```

## Cleanup

A behavior may return a cleanup function. SimplyFlow calls it when the element is removed from the app container or when `app.destroy()` is called.

```javascript
behaviors: {
  widget(element) {
    const widget = createWidget(element)

    return function cleanup() {
      widget.destroy()
    }
  }
}
```

The cleanup function also receives the element as its first argument, and `this` is the app instance.

## Lower-level API

The app API uses the lower-level `behaviors()` function internally:

```javascript
import { behaviors } from './behavior.mjs'

const activeBehaviors = behaviors({
  app,
  container,
  behaviors: {
    tabs(element) {}
  }
})

activeBehaviors.destroy()
```

Use the lower-level API only when you need to attach behavior handling outside `app()`.
