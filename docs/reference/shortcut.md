# Shortcut module

```js
import { shortcuts, accesskeys } from './src/shortcut.mjs'
```

Shortcuts handle keyboard commands.

## `app({ shortcuts })`

```js
app({
  data: {},

  shortcuts: {
    'Control+s'(event) {
      this.actions.save()
    }
  }
})
```

Inside shortcut functions, `this` is the app instance.

If a shortcut returns a falsy value, SimplyFlow prevents the default event behavior. Return `true` to allow the browser behavior to continue.

## Shortcut scopes

Use `data-simply-shortcuts` to select a scope.

```html
<section data-simply-shortcuts="editor">
  ...
</section>
```

```js
shortcuts: {
  editor: {
    'Control+s'() {
      this.actions.save()
    }
  },

  default: {
    Escape() {
      this.actions.close()
    }
  }
}
```

Flat scoped names are also supported:

```js
shortcuts: {
  'editor.Control+s'() {}
}
```

Key combinations may use `+` or `-` separators:

```js
'Control+s'
'Control-s'
```

## Lower-level shortcuts API

```js
const shortcutApi = shortcuts({
  app,
  shortcuts: {
    'Control+s'() {}
  }
})

destroyShortcuts(shortcutApi)
```

## Access keys

Access keys click matching elements when a key combination is pressed.

```html
<button data-simply-accesskey="Control+s">Save</button>
```

`app()` installs accesskey handling automatically for the app container.

Lower-level API:

```js
const accesskeyApi = accesskeys({ app, container })
destroyAccesskeys(accesskeyApi)
```
