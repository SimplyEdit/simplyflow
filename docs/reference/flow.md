# Flow entry point

```js
import simply, {
  app,
  bind,
  model,
  state,
  dom,
  commands,
  actions,
  routes
} from './src/flow.mjs'
```

`src/flow.mjs` is the main package entry point. It exports the public modules and initializes the browser global API when used through the bundled script.

## Named exports

| Export | Description |
| --- | --- |
| `app` | Main application API. See [App](app.md). |
| `bind` | Lower-level DOM/data binding. See [Binding](bind.md). |
| `model` | Model namespace with `model()`, `sort()`, `filter()`, etc. See [Model](model.md). |
| `state` | State namespace. See [State](state.md). |
| `dom` | DOM signal namespace. See [DOM signals](dom.md). |
| `behaviors` | Behavior controller factory. See [Behaviors](behavior.md). |
| `actions` | Action proxy factory. See [Actions](action.md). |
| `commands` | Command controller factory. See [Commands](command.md). |
| `include` | Lower-level include helpers. See [Includes](include.md). |
| `includes` | App-scoped include controller factory. See [Includes](include.md). |
| `shortcuts` | Shortcut controller factory. See [Shortcuts](shortcut.md). |
| `path` | Dotted path helpers. See [Path](path.md). |
| `routes` | Route controller factory. See [Routes](route.md). |
| `SimplyRoute` | Route controller class for advanced/module users. |
| `html`, `css` | Template tag helpers. See [Highlight helpers](highlight.md). |

The default export is `globalThis.simply`.

## Browser global

The bundled script creates or extends `globalThis.simply`.

Important globals include:

```js
simply.app
simply.bind
simply.model
simply.state
simply.signal
simply.effect
simply.batch
simply.clone
simply.dom
simply.commands
simply.actions
simply.routes
simply.shortcuts
simply.behaviors
simply.includes
simply.include
simply.path
```

`flow.mjs` also intentionally installs global `html` and `css` template tags for editor syntax highlighting:

```js
html`<template></template>`
css`.button {}`
```

These authoring helpers are not part of the `simply` namespace.
