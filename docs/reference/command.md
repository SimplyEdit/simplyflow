# Command module

```js
import { commands } from './src/command.mjs'
```

Commands connect DOM events to application behavior. In normal apps you configure them through `app({ commands })`.

## `data-simply-command`

```html
<button data-simply-command="save">Save</button>
```

```js
app({
  data: {},

  commands: {
    save(button, value, event) {
      this.actions.save()
    }
  },

  actions: {
    save() {}
  }
})
```

A command is called with:

```js
command(element, value, event)
```

| Argument | Description |
| --- | --- |
| `element` | The element that has `data-simply-command`. |
| `value` | The configured or extracted command value. |
| `event` | The original DOM event. |

Inside a command, `this` is the app instance.

If a command returns `true`, the original event is allowed to continue. Any other return value prevents the default event behavior and stops propagation.

## Command values

Use `data-simply-value` to pass a value.

```html
<button data-simply-command="select" data-simply-value="bob">Select Bob</button>
```

Inside list/map templates, dynamic values are supported:

```html
<ul data-simply-list="contacts">
  <template>
    <li>
      <button data-simply-command="select"
              data-simply-value=":value.id">
        Select
      </button>
      <span data-simply-field="name"></span>
    </li>
  </template>
</ul>
```

Supported dynamic values:

| Value | Meaning |
| --- | --- |
| `:value` | Current list/map item. |
| `:value.name` | Property of the current item. |
| `:key` | Current array index or object/map key. |
| `:root.path` | Value from the app data root. |

SimplyFlow may generate internal attributes such as `data-simply-value-path` while rendering templates. Do not write these by hand.

## Built-in event handling

Commands are detected on:

| Element | Event | Value behavior |
| --- | --- | --- |
| `button`, `a` | `click` | `data-simply-value`, otherwise `href` or `value`. |
| `input`, `select`, `textarea` | `change` | `data-simply-value`, otherwise the input value. |
| `input`, `textarea` with `data-simply-immediate` | `input` | The current value. |
| `form` | `submit` | Object built from form element names. |
| any element | `click` | `data-simply-value`, if present. |

## Unknown commands

Missing commands warn once per command name.

```text
simplyflow/command: unknown command "svae". Did you mean "save"?
```

## Manual calls

The command controller exposes `call()` for manual use:

```js
app.commands.call('save', element, value, event)
```

## Lower-level API

```js
const commandApi = commands({
  app,
  container,
  commands: {
    save() {}
  }
})
```

`commands()` registers event listeners on `container` or `app.container`.

Use `destroyCommands(commandApi)` to remove those listeners when using the lower-level API directly.
