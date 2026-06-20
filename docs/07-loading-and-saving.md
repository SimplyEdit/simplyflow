# 7. Loading and saving

The sanctuary roster can start in a file or come from an API.

This chapter uses Metro, a small helper library for calling APIs. Add it to the page after SimplyFlow:

```html
<script src="https://cdn.jsdelivr.net/npm/simplyflow/dist/simply.flow.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/everything.js"></script>
```

Now both `simply.app()` and `metro.jsonApi()` are available.

SimplyFlow lets you add your own helpers to the app. For example, you might add an `api` helper:

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    dragons: [],
    loading: false,
    message: ''
  },

  api: metro.jsonApi('/sanctuary/'),

  start() {
    this.actions.loadDragons()
  },

  actions: {
    async loadDragons() {
      this.data.loading = true
      this.data.message = 'Opening the dragon register...'

      this.data.dragons = await this.api.get('dragons.json')

      this.data.loading = false
      this.data.message = 'The register is ready.'
    }
  }
})
```

Because `api` is an app option, actions can use it as `this.api`.

```js
this.api.get('dragons.json')
```

The same idea works for anything useful to your app:

```js
simply.app({
  data: {},
  storage: localStorage,
  clock: new Date()
})
```

Inside actions, those become:

```js
this.storage
this.clock
```

## Show loading text

Add this to the page:

```html
<p data-simply-field="message"></p>
```

When the action changes `message`, the page changes.

## Save data

A save action can send the current data back:

```js
actions: {
  async saveDragons() {
    this.data.message = 'Saving the dragon register...'

    await this.api.put('dragons.json', this.data.dragons)

    this.data.message = 'Saved. The dragons are accounted for.'
  }
}
```

And a command can call it:

```html
<button data-simply-command="saveDragons">Save register</button>
```

```js
commands: {
  saveDragons() {
    this.actions.saveDragons()
  }
}
```

## Handle errors

Add `onError`:

```js
const sanctuary = simply.app({
  data: {
    message: ''
  },

  onError(error) {
    this.data.message = `Trouble in the sanctuary: ${error.message}`
  }
})
```

Now errors become part of the app data, and the page can show them.

Next: [pages and routes](08-pages-and-routes.md).
