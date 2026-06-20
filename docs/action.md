# Actions

Actions contain application behavior. They are usually called by commands, routes or hooks.

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

If `hooks.error` is configured, thrown errors and rejected promises from actions are passed to that hook.
