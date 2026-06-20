# Include module

```js
import { includes, include } from './src/include.mjs'
```

Includes load external HTML fragments into a page. `app()` automatically creates an app-scoped include controller for the app container.

## App-scoped includes

Inside an app container:

```html
<link rel="simply-include" href="header.html">
```

SimplyFlow fetches `header.html`, inserts its contents before the link, then removes the link.

```html
<link rel="simply-include-once" href="header.html">
```

`simply-include-once` only loads a given URL once per include controller.

Included content is inside the app container, so new `data-simply-*` bindings, commands and behaviors are picked up by the app.

## `includes(options)`

Creates a destroyable include controller.

```js
const controller = includes({
  container: document.querySelector('#app')
})

controller.destroy()
```

Options:

| Option | Description |
| --- | --- |
| `container` | Container to observe. Defaults to `document`. |
| `cacheBuster` | Optional cache-busting value appended as `cb`. |
| `observe` | Set to `false` to avoid starting a mutation observer. |

## Controller methods

| Method | Description |
| --- | --- |
| `includeLinks(links)` | Loads the given include link elements. |
| `html(html, link)` | Inserts an HTML string using `link` as the base URL for assets. |
| `scripts(scripts, base)` | Inserts scripts sequentially, preserving blocking script order. |
| `destroy()` | Stops observing and prevents further include work. |

## Script order

Blocking external scripts from an include are inserted in document order and SimplyFlow waits for each one to load before inserting the next script. Scripts with an explicit `async` attribute do not block following scripts.

## Lower-level `include` helper

`include` is a convenience object for one-off include operations:

```js
include.cacheBuster = Date.now()
await include.links(document.querySelectorAll('link[rel="simply-include"]'))
```

Properties/methods:

| Member | Description |
| --- | --- |
| `include.cacheBuster` | Shared cache-busting value for default helper calls. |
| `include.links(links)` | Loads link elements. |
| `include.html(html, link)` | Inserts an HTML fragment. |
| `include.scripts(scripts, base)` | Inserts scripts with ordering support. |
