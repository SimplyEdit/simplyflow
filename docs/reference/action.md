# Action module

```js
import { actions } from './src/action.mjs'
```

Actions are named application functions. In normal apps you configure them through `app({ actions })`.

## `app({ actions })`

```js
app({
  data: { count: 0 },

  actions: {
    increment({ amount = 1 } = {}) {
      this.data.count += amount
    }
  },

  commands: {
    addOne() {
      this.actions.increment({ amount: 1 })
    }
  }
})
```

Inside an action, `this` is the app instance.

## Named parameters

SimplyFlow encourages actions that take one object argument with named values:

```js
actions: {
  selectContact({ id, tab = 'details' }) {
    this.data.selectedContactId = id
    this.data.tab = tab
  }
}
```

This style works well with route action shorthand and commands.

## Error handling

When the app has `onError`, action errors are caught and passed to it.

```js
app({
  data: {},

  onError(error, context) {
    console.error('Action failed', error, context)
  },

  actions: {
    async save() {
      throw new Error('not saved')
    }
  }
})
```

`context` is the action function that failed.

Without `onError`, action errors throw normally.

## Unknown actions

Reading or calling a missing action logs a warning once per missing action name.

```text
simplyflow/action: unknown action "svae". Did you mean "save"?
```

If there is no close match, the warning omits the suggestion.

## `actions(options)`

Lower-level factory.

```js
const actionApi = actions({
  app: myApp,
  actions: {
    save() {}
  }
})
```

When `options.app` is supplied, returned action functions are bound to that app. When no app is supplied, `actions(options)` returns `options` unchanged.
