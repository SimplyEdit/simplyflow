# SimplyFlow includes

Includes let an app load small HTML fragments into its container without a build step.

```html
<div id="app">
  <link rel="simply-include" href="header.html">
</div>
```

```javascript
import { app } from '../src/flow.mjs'

const page = app({
  container: document.getElementById('app'),
  data: { title: 'Hello' }
})
```

The included HTML is inserted before the `<link>` element. The link is then removed. If the included HTML contains `data-simply-*` attributes, the app binding picks them up automatically.

## Include once

Use `simply-include-once` when the same file should only be loaded once by the same app include controller:

```html
<link rel="simply-include-once" href="shared-toolbar.html">
```

## Styles and scripts

Stylesheets are moved to `document.head` and relative stylesheet URLs are resolved relative to the included file.

Scripts are reinserted so they can run. External scripts are loaded in order by default. Scripts with an explicit `async` attribute do not block later scripts.

## Scope and cleanup

Includes are app-scoped. `app()` watches only its own container, and `app.destroy()` stops watching for new include links. Importing `include.mjs` no longer starts a global document observer.

## Lower-level API

The lower-level include module exports:

```javascript
import { includes, include } from '../src/include.mjs'
```

Use `includes({ container })` to create a destroyable include controller for a specific container. The `include` object contains low-level helpers such as `include.html(html, link)`.
