# Edit module

```js
import { edit } from './src/edit.mjs'
```

The edit module is experimental. It builds an editing application on top of SimplyFlow's app, state and binding APIs.

## `edit(rootElement)`

Creates an editing app rooted at `rootElement`.

```js
const editor = edit(document.querySelector('#editor'))
```

Current behavior includes actions for enabling/disabling `contenteditable`, editor shortcuts and toolbar components.

## Stability

This module is not part of the beginner-facing application API and still contains experimental editor-specific assumptions. Treat it as a work-in-progress example of building a larger app layer on top of SimplyFlow rather than a stable reference API.
