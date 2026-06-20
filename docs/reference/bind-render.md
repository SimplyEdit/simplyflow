# Binding renderer module

```js
import * as render from './src/bind.render.mjs'
```

This module contains renderer functions used by `bind()`. Most applications use them indirectly through `bind()` or `app()`.

Renderer functions are called with `this` set to the binding instance and receive a `context` object.

## Context object

Common context fields:

| Field | Description |
| --- | --- |
| `context.element` | Element being rendered. |
| `context.path` | Binding path. |
| `context.value` | Current data value. |
| `context.attribute` | Binding attribute, such as `data-flow-field`. |
| `context.edit` | True when rendering an explicit edit binding. |
| `context.templates` | Direct child templates of the bound element. |

## Main renderers

### `field(context)`

Renders a field binding. If the element contains templates, it renders with template matching. Otherwise it uses an element-specific renderer based on tag name.

### `list(context)`

Renders an array value into templates. Supports `:empty` and `:notempty` templates. Uses keyed DOM reuse for existing rendered items.

### `map(context)`

Renders object/map-like values into templates.

## Element renderers

| Function | Used for | Description |
| --- | --- | --- |
| `input(context)` | `INPUT`, `TEXTAREA` | Renders and optionally edits form values. Handles text, checkbox, radio and textarea behavior. |
| `button(context)` | `BUTTON` | Renders button properties/content. |
| `select(context)` | `SELECT` | Renders select options and selected values. Handles single and multiple selects. |
| `anchor(context)` | `A` | Renders anchor properties such as `href`, `target`, `name`, `newwindow`, `nofollow`. |
| `image(context)` | `IMG` | Renders image properties. |
| `iframe(context)` | `IFRAME` | Renders iframe properties. |
| `meta(context)` | `META` | Renders meta properties. |
| `element(context, ...extraProps)` | fallback | Renders general element properties/content. |

## Template renderers

| Function | Description |
| --- | --- |
| `arrayByTemplates(context)` | Renders an array by applying templates to each item. |
| `objectByTemplates(context)` | Renders an object by applying templates to each entry. |
| `fieldByTemplates(context)` | Renders a single field using a matching template. |

## Property helpers

### `setValueByPath(root, path, value)`

Sets a value at a binding path. Missing intermediate path parts are created as arrays or objects when possible.

Throws for unsupported `:key` writes.

### `setProperties(element, data, ...properties)`

Copies selected properties from `data` to `element`.

### `getProperties(element, ...properties)`

Reads selected properties from `element` into an object.

### `matchValue(a, b)`

Compares rendered/selectable values. Used by select and option rendering.

## Select helpers

| Function | Description |
| --- | --- |
| `addOption(select, option)` | Adds an `<option>` to a select element. |
| `setSelectOptions(select, options)` | Replaces select options from data. |

## Stability

This is an advanced renderer extension module. Prefer `app()` or `bind()` unless you are writing custom renderers or extending the binding system.
