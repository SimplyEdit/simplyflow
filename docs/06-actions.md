# 6. Actions keep things tidy

As the sanctuary grows, there are more ways to change data:

- buttons;
- forms;
- routes;
- keyboard shortcuts;
- loading data.

Actions give those changes a home.

A good action looks like a normal function with named values:

```js
actions: {
  feedDragon({ id, snacks = 1 }) {
    const dragon = this.data.dragons.find(dragon => dragon.id === id)

    if (!dragon) {
      return
    }

    dragon.snacks += snacks
    dragon.mood = 'well fed'
  }
}
```

You can call it from a command:

```js
commands: {
  feedSelectedDragon() {
    this.actions.feedDragon({
      id: this.data.selectedDragonId,
      snacks: 1
    })
  }
}
```

You can call it from another action:

```js
actions: {
  prepareBreakfast() {
    for (const dragon of this.data.dragons) {
      this.actions.feedDragon({ id: dragon.id, snacks: 2 })
    }
  }
}
```

And routes can call actions too. You will see that in the routes chapter.

## Why named values are helpful

This is easy to read:

```js
this.actions.feedDragon({ id: 'ember', snacks: 2 })
```

The names travel with the values. That makes the code easier to change later.

## Async actions

Actions can be async:

```js
actions: {
  async loadDragons() {
    this.data.loading = true
    this.data.dragons = await this.api.get('dragons.json')
    this.data.loading = false
  }
}
```

If an action fails, `onError` can handle the error:

```js
const sanctuary = simply.app({
  data: {
    error: ''
  },

  onError(error) {
    this.data.error = error.message
  }
})
```

Show the error in HTML:

```html
<p data-simply-field="error"></p>
```

## Missing actions

If you call an action that does not exist, SimplyFlow warns in the console. If the name looks like a typo, the warning includes a suggestion.

```js
this.actions.feedDragn({ id: 'ember' })
```

The console may say:

```text
simplyflow/action: unknown action "feedDragn". Did you mean "feedDragon"?
```

Next: [loading and saving](07-loading-and-saving.md).
