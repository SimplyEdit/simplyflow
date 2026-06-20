# SimplyFlow app API

`app()` is the beginner-facing API for building a small reactive web application.
It combines reactive `data`, DOM binding, commands, actions, routes, keyboard shortcuts and optional inline HTML/CSS setup.

```javascript
import { app } from '../src/flow.mjs'

const counter = app({
  container: document.getElementById('counter'),

  data: {
    count: 0
  },

  commands: {
    add1() {
      this.data.count++
    }
  }
})
```

```html
<div id="counter">
  <button data-simply-command="add1">+</button>
  <span data-simply-field="count"></span>
</div>
```

When `this.data.count` changes, every matching `data-simply-field` updates automatically.

## Options

### `container`

The DOM element that contains the app. Defaults to `document.body`.

### `data`

The application data object. SimplyFlow turns this object into a signal, so normal JavaScript changes update the page:

```javascript
this.data.title = 'New title'
this.data.todos.push({ text: 'Buy milk', done: false })
```

`data` replaces the old SimplyView `view` option. There is no `state` or `view` alias in the new API.

### `commands`

Commands respond to DOM events. Add `data-simply-command="name"` to a button, link, input, select, textarea, form or any clickable element.

```html
<button data-simply-command="remove" data-simply-value="42">Remove</button>
```

```javascript
commands: {
  remove(el, value) {
    this.actions.removeTodo(value)
  }
}
```

Inside a command, `this` is the app instance.

### `actions`

Actions contain application behavior. Commands usually call actions, and actions usually change `this.data`.

```javascript
actions: {
  removeTodo(id) {
    this.data.todos = this.data.todos.filter(todo => todo.id !== id)
  }
}
```

Inside an action, `this` is the app instance.

### `routes`

Routes map URLs to actions or functions.

```javascript
routes: {
  '/contacts/:id': function(params) {
    this.actions.selectContact(params.id)
  }
}
```

### `keys` / `keyboard`

Keyboard shortcuts call functions with the app as `this`.

```javascript
keys: {
  'Control+s'(event) {
    this.actions.save()
  }
}
```

### `html`

A map of template names to HTML strings. Each entry is installed as a `<template>` in the app container.

```javascript
html: {
  item: `<li><span data-simply-field=":value.text"></span></li>`
}
```

### `css`

A map of style names to CSS strings. Each entry is installed as a `<style>` element in the app container.

### `bind`

Binding options passed to the underlying `bind()` call. Set `bind: false` to disable automatic binding.

```javascript
app({
  bind: {
    transformers: {
      uppercase(context, next) {
        context.value = String(context.value).toUpperCase()
        next(context)
      }
    }
  }
})
```

The app always uses:

```javascript
attribute: 'data-simply'
root: app.data
container: app.container
```

## HTML binding attributes

The app API uses `data-simply-*` attributes. They map directly to the lower-level `bind()` API:

- `data-simply-field="path"` shows or edits one value.
- `data-simply-list="path"` repeats an array.
- `data-simply-map="path"` repeats an object or map.
- `data-simply-command="name"` runs a command.
- `data-simply-value="value"` passes a value to a command.

Example list:

```html
<ul data-simply-list="todos">
  <template>
    <li>
      <input type="checkbox" data-simply-field=":value.done">
      <span data-simply-field=":value.text"></span>
    </li>
  </template>
</ul>
```

## Result

`app(options)` returns the app instance. The most important properties are:

- `app.data` - the reactive application data.
- `app.commands` - command object.
- `app.actions` - action object.
- `app.routes` - route object, if routes were configured.
- `app.binding` - the underlying bind instance.

Use `app.destroy()` to destroy the underlying binding.
