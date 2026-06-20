# Actions

Actions contain application behavior. They are usually called by commands, routes or `start()`.

```javascript
app({
  data: { selectedId: null },
  actions: {
    selectContact({ id }) {
      this.data.selectedId = id
    }
  }
})
```

Inside an action, `this` is the app instance.

If `onError(error, context)` is configured on the app, thrown errors and rejected promises from actions are passed to it. The second argument is the action function that failed.

If you accidentally read an action name that does not exist, SimplyFlow warns once. If the name looks like a typo of an existing action, the warning includes a suggestion:

```text
simplyflow/action: unknown action "svae". Did you mean "save"?
```

This helps catch mistakes such as `this.actions.svae()`. Unknown action names without a suggestion still warn once, for example `simplyflow/action: unknown action "loadRemoteContacts"`.

