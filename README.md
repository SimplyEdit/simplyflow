# SimplyFlow

SimplyFlow is an experimental browser library for building small reactive web applications with ordinary HTML and ordinary JavaScript data.

The intended beginner-facing API is:

```javascript
import { app } from 'simplyflow/src/flow.mjs'

const counter = app({
  container: document.getElementById('counter'),

  data: {
    count: 0
  },

  commands: {
    add1() {
      this.data.count++
    }
  }
})
```

```html
<div id="counter">
  <button data-simply-command="add1">+</button>
  <span data-simply-field="count"></span>
</div>
```

For editable values, use `data-simply-edit`:

```html
<input data-simply-edit="name">
<span data-simply-field="name"></span>
```

The page updates automatically whenever `app.data` changes. Use `data-simply-edit` on form fields when the user should be able to edit a value directly. Text inputs, textareas and selects edit string values; checkboxes edit booleans or toggle values in arrays; radio buttons edit the selected value.

Buttons inside list templates can pass the current item or one of its fields to a command:

```html
<ul data-simply-list="todos">
  <template>
    <li>
      <button data-simply-command="removeTodo" data-simply-value=":value.id">Remove</button>
      <span data-simply-field="text"></span>
    </li>
  </template>
</ul>
```

Custom top-level options become app properties, so you can add services without extra ceremony:

```javascript
const contacts = simply.app({
  data: { contacts: [] },
  api: metro.jsonApi('/api/'),
  actions: {
    async loadContacts() {
      this.data.contacts = await this.api.get('contacts.json')
    }
  }
})
```

If an unknown option looks like a typo of a built-in app option, SimplyFlow logs a warning, but still adds the option to the app.

Reusable element behavior can be attached with `data-simply-behavior`:

```html
<div data-simply-behavior="tabs"></div>
```

```javascript
const page = simply.app({
  data: {},
  behaviors: {
    tabs(element) {
      // Set up the tabs element.
    }
  }
})
```

HTML fragments can be included inside an app container without a build step:

```html
<link rel="simply-include" href="header.html">
```

The include observer is scoped to the app and stops when `app.destroy()` is called.

Keyboard shortcuts can be added with the `shortcuts` option:

```javascript
const notes = simply.app({
  data: {},
  shortcuts: {
    'Control+s'() {
      this.actions.save()
    }
  }
})
```

## Install

```shell
npm install simplyflow
```

or using Git:

```shell
git clone https://github.com/SimplyEdit/simplyflow.git
```

## Browser bundle

```html
<script src="https://cdn.jsdelivr.net/npm/simplyflow/dist/simply.flow.js"></script>
```

Then use the beginner-facing `simply.app()` API:

```javascript
const counter = simply.app({
  data: { count: 0 },
  commands: {
    add1() {
      this.data.count++
    }
  }
})
```

The tutorials focus on `simply.app()`, but the browser global also exposes the lower-level APIs directly for projects that use script tags and do not want a build step:

```javascript
const data = simply.signal({ title: 'Hello' })
simply.bind({ root: data })

const table = simply.model({ data: [] })
table.addEffect(simply.model.sort({ property: 'title' }))
```

The browser bundle also intentionally provides global `html` and `css` template tags. They return strings, but many code editors recognize these tag names and provide syntax highlighting inside template literals:

```javascript
const page = simply.app({
  templates: {
    card: html`<article data-simply-field=":value.title"></article>`
  },
  styles: {
    card: css`.selected { font-weight: bold; }`
  }
})
```

Module imports are still available when you prefer explicit imports:

```javascript
import { signal, effect, batch } from 'simplyflow/src/state.mjs'
import { bind } from 'simplyflow/src/bind.mjs'
import { model, paging, sort, filter, columns } from 'simplyflow/src/model.mjs'

const data = signal({ title: 'Hello' })
bind({ root: data })
```


## Documentation

- [App API](docs/app.md)
- [Binding API](docs/bind.md)
- [Model API](docs/model.md)
- [State API](docs/state.md)
- [Commands](docs/command.md)
- [Actions](docs/action.md)
- [Routes](docs/route.md)
- [Behaviors](docs/behavior.md)
- [Includes](docs/include.md)

Or check the [examples](examples/) for more information.

## License

[MIT](LICENSE) &copy; Muze.nl

## Contributions

Contributions are welcome, but make sure that all code is MIT licensed. If you want to send a merge request, please make sure that there is a ticket that shows the bug/feature and reference it. If you find any problem, please do file a ticket, but you should not expect a timely resolution. This project is still very experimental, don't use it in production unless you are ready to fix problems yourself.
