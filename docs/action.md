# Actions

Actions contain application behavior. They are usually called by commands, routes or `start()`.

```javascript
app({
  data: { selectedId: null },
  actions: {
    selectContact(id) {
      this.data.selectedId = id
    }
  }
})
```

Inside an action, `this` is the app instance.

If `onError(error, context)` is configured on the app, thrown errors and rejected promises from actions are passed to it. The second argument is the action function that failed.
