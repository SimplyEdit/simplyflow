# Highlight helper module

```js
import { html, css } from './src/highlight.mjs'
```

This module exports identity template tag helpers. They exist mainly to help code editors apply HTML and CSS syntax highlighting inside template literals.

## `html(strings, ...values)`

Returns the interpolated template literal as a string.

```js
const template = html`
  <li><span data-simply-field="name"></span></li>
`
```

## `css(strings, ...values)`

Returns the interpolated template literal as a string.

```js
const styles = css`
  .selected { font-weight: bold; }
`
```

## Browser globals

The main browser bundle installs:

```js
globalThis.html
globalThis.css
```

This is intentional. Many editors recognize `html\`...\`` and `css\`...\`` template literals and provide syntax highlighting without a build step.

These helpers do not escape values and do not sanitize content.
