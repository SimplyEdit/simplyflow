# DOM signal module

```js
import * as dom from './src/dom.mjs'
```

The DOM module provides reactive proxies for DOM elements and helpers used by the binding layer.

## `dom.signal(element, options?)`

Wraps an element in a signal proxy. Effects that read DOM properties rerun when those DOM properties change.

```js
const input = dom.signal(document.querySelector('input'))

const value = simply.effect(() => input.value)
```

`options` are `MutationObserver` options. When omitted, SimplyFlow observes attributes, character data, child list changes and the subtree.

For form controls, `change` and `input` events notify `value` and `checked` listeners where appropriate.

## `dom.trackDomField(element, props, valueIsString, stringProperty, getUpdateValue)`

Low-level helper used by editable bindings. It tracks changes to DOM properties and writes the extracted value back to the bound data path.

This is primarily a binding internals API for custom renderers.

## `dom.trackDomList(element)`

Low-level helper used by broad two-way list binding. It tracks child order and writes DOM order back to the data list.

This is an advanced/editor-oriented API. App-level `data-simply-list` is one-way by default.

## `dom.findAttribute(element, attr)`

Finds the closest ancestor, including `element`, that has `attr` and returns the attribute value.

```js
dom.findAttribute(button, 'data-simply-command')
```
