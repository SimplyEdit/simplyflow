# 12. Templates and styles

You can add reusable templates and styles when the app starts.

```js
const sanctuary = simply.app({
  data: {
    dragons: []
  },

  templates: {
    dragonRow: html`
      <li>
        <strong data-simply-field="name"></strong>
        <span data-simply-field="mood"></span>
      </li>
    `
  },

  styles: {
    dragonCards: css`
      .dragon-card {
        border: 2px solid goldenrod;
        border-radius: 0.5rem;
        padding: 1rem;
      }
    `
  }
})
```

The `templates` option creates named `<template>` elements. The `styles` option creates named `<style>` elements.

## The `html` and `css` tags

The browser bundle provides global `html` and `css` tags:

```js
html`<p>Hello</p>`
css`p { color: purple; }`
```

They return strings. Their main purpose is to help code editors highlight HTML and CSS inside template strings.

They do not make unsafe HTML safe. If you put user text into HTML strings, escape it first.

## Use templates with lists

A list can use a template already present in the page, or one installed through `templates`.

```html
<ul data-simply-list="dragons">
  <template>
    <li>
      <strong data-simply-field="name"></strong>
      <span data-simply-field="mood"></span>
    </li>
  </template>
</ul>
```

For many beginner apps, keeping the template in HTML is easiest to read. The `templates` option is useful when a template belongs with the JavaScript that creates a feature.

Next: [components](13-components.md).
