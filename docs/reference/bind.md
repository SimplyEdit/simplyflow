# Bind module

```js
import { bind } from './src/bind.mjs'
```

`bind()` is the lower-level DOM/data binding API. `app()` uses it internally with the `data-simply-*` attribute prefix. The lower-level default prefix is `data-flow-*`.

## `bind(options)`

```js
const data = simply.signal({
  person: { name: 'Ada' },
  todos: []
})

const binding = bind({
  root: data,
  container: document.body
})
```

### Options

| Option | Type | Description |
| --- | --- | --- |
| `root` | signal/object | Required. Root data object. |
| `container` | `Element` | Binding root. Defaults to `document.body`. |
| `attribute` | `string` | Attribute prefix. Defaults to `data-flow`. |
| `transformers` | `object` | Named transformers available through `*-transform`. |
| `render` | `object` | Renderer stacks for `field`, `list`, and `map`. |
| `renderers` | `object` | Element-specific field renderers by tag name. |
| `twoway` | `boolean` | Enables broad DOM-to-data tracking. Defaults to `false`. Prefer explicit `*-edit`. |

Throws when `options.root` is missing.

## Attributes

With the default `data-flow` prefix:

| Attribute | Description |
| --- | --- |
| `data-flow-field="path"` | Render data at `path`. One-way. |
| `data-flow-edit="path"` | Render and edit data at `path`. |
| `data-flow-list="path"` | Render an array using child templates. |
| `data-flow-map="path"` | Render an object/map-like value using child templates. |
| `data-flow-transform="name"` | Run a named transformer. Multiple names are separated by spaces. |

`app()` uses the same attributes with the `data-simply` prefix.

## Field binding

```html
<span data-flow-field="person.name"></span>
<input data-flow-edit="person.name">
```

`data-flow-field` is one-way. `data-flow-edit` updates the bound data when the user edits supported form controls.

## Lists

```html
<ul data-flow-list="todos">
  <template>
    <li>
      <input type="checkbox" data-flow-edit="done">
      <span data-flow-field="text"></span>
    </li>
  </template>
</ul>
```

Inside a list template, relative paths are resolved against the current item. Special paths include:

| Path | Meaning |
| --- | --- |
| `:value` | Current item. |
| `:key` | Current array index or object/map key. |
| `:root.path` | Path from the root data object. |
| `:empty` | Template used when a list/map is empty. |
| `:notempty` | Template used when a list/map is not empty. |

## Maps

`data-flow-map` renders object entries with templates. The current key is available through `:key` and the current value through `:value`.

## Transformers

Built-in transformers:

| Name | Description |
| --- | --- |
| `escape_html` | Escapes HTML-special characters before rendering. |
| `fixed_content` | Prevents replacing content when an element already has fixed content. |

Custom transformers receive `(context, next)` and are called with `this` set to the binding instance. A transformer can change the context and call `next(context)`.

## Instance methods/properties

| Member | Description |
| --- | --- |
| `binding.bindings` | `Map<Element, signal>` of active binding effects. |
| `binding.destroy()` | Destroys all active binding effects and observers. |
| `binding.trace(path)` | Returns trace information for a data path. |

## Helpers

### `getValueByPath(root, path)`

Returns the value at a binding path. Supports binding special paths such as `:root` internally.

### `trace(path)`

Returns global binding trace data for a path.
