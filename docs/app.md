# SimplyFlow app API

`app()` is the beginner-facing API for building a small reactive web application.
It combines reactive `data`, DOM binding, commands, actions, routes, keyboard shortcuts and optional inline templates/styles setup.

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

When `this.data.count` changes, every matching `data-simply-field` updates automatically. User edits are written back only for fields marked with `data-simply-edit`.

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

### `start`

An optional function that runs after the app is created and before route initialization. Use it to load initial data or start the app.

```javascript
app({
  data: { contacts: [] },

  async start() {
    this.data.contacts = await this.api.get('contacts.json')
  }
})
```

If `start()` returns a promise, routes are initialized after that promise settles successfully.

### `onError`

An optional function that receives errors thrown by actions or `start()`.

```javascript
app({
  onError(error, context) {
    console.error('The app could not finish an operation:', error)
  }
})
```

### `routes`

Routes map URLs to actions or functions. The simplest form uses an action name.

```javascript
actions: {
  selectContact({ id, tab = 'details' }) {
    this.data.selectedContactId = id
    this.data.selectedTab = tab
  }
},

routes: {
  '/contacts/:id': 'selectContact'
}
```

For `/contacts/42?tab=notes`, the route shorthand calls `selectContact({ id: '42', tab: 'notes' })`. Route parameters win over query parameters when names conflict, because query parameters can be changed by anyone.

A route can also use a function directly. Inside that function, `this` is the app instance.

```javascript
routes: {
  '/contacts/:id': function(params, searchParams) {
    this.actions.selectContact({
      id: params.id,
      tab: searchParams.get('tab') || 'details'
    })
  }
}
```

### `shortcuts`

Keyboard shortcuts call functions with the app as `this`.

```javascript
shortcuts: {
  'Control+s'(event) {
    this.actions.save()
  }
}
```

Use `data-simply-shortcuts="name"` on an element to select a named shortcut scope for that part of the page.

### `behaviors`

Behaviors attach reusable JavaScript behavior to DOM elements. Use `data-simply-behavior="name"` in the HTML and define the behavior in the app options.

```html
<div data-simply-behavior="tabs"></div>
```

```javascript
behaviors: {
  tabs(element) {
    // Set up the element.
    return function cleanup(element) {
      // Clean up when the element is removed or the app is destroyed.
    }
  }
}
```

Inside a behavior and its cleanup function, `this` is the app instance.

### `templates`

A map of template names to HTML strings. Each entry is installed as a `<template>` in the app container.

```javascript
templates: {
  item: `<li><span data-simply-field=":value.text"></span></li>`
}
```

### `styles`

A map of style names to CSS strings. Each entry is installed as a `<style>` element in the app container.

```javascript
styles: {
  app: `.selected { font-weight: bold; }`
}
```

### Custom app properties

Any unknown top-level option is copied onto the app. This is useful for app services such as an API client:

```javascript
const contacts = app({
  data: {
    contacts: []
  },

  api: metro.jsonApi('/api/'),

  actions: {
    async loadContacts() {
      this.data.contacts = await this.api.get('contacts.json')
    }
  }
})
```

SimplyFlow warns only when an unknown option looks like a typo of a built-in option. For example, `commmands` warns and suggests `commands`, but `api` is accepted without warning.

### Binding

`app()` always creates a one-way `data-simply` binding for the app container and `app.data`.
Use `data-simply-edit` for individual fields that should write user edits back to `app.data`.

## HTML binding attributes

The app API uses `data-simply-*` attributes. They map directly to the lower-level `bind()` API:

- `data-simply-field="path"` shows one value.
- `data-simply-edit="path"` shows one value and writes user edits back.
- `data-simply-list="path"` repeats an array.
- `data-simply-map="path"` repeats an object or map.
- `data-simply-command="name"` runs a command.
- `data-simply-value="value"` passes a value to a command.
- `data-simply-behavior="name"` attaches a reusable behavior to an element.

Use `data-simply-edit` on ordinary editable controls such as text inputs, textareas and single selects:

```html
<input data-simply-edit="person.name">
<textarea data-simply-edit="person.notes"></textarea>
<select data-simply-edit="person.country">
  <option value="nl">Netherlands</option>
  <option value="be">Belgium</option>
</select>
```

Example list:

```html
<ul data-simply-list="todos">
  <template>
    <li>
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
- `app.shortcuts` - shortcut object, if shortcuts were configured.
- `app.behaviors` - behavior controller, if behaviors were configured.
- `app.binding` - the underlying bind instance.

Use `app.destroy()` to destroy the underlying binding and any active behaviors.
