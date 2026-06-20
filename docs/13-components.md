# 13. Components

Components are a way to collect reusable app pieces.

This part of SimplyFlow is still experimental. You can skip this chapter until you find yourself copying the same app options several times.

A component can provide options such as commands, actions, templates, styles, or behaviors.

```js
const dragonFeeding = {
  commands: {
    feedDragon(element, id) {
      this.actions.feedDragon({ id })
    }
  },

  actions: {
    feedDragon({ id }) {
      const dragon = this.data.dragons.find(dragon => dragon.id === id)
      if (dragon) {
        dragon.snacks++
        dragon.mood = 'pleased'
      }
    }
  }
}
```

Use it in an app:

```js
const sanctuary = simply.app({
  data: {
    dragons: []
  },

  components: {
    dragonFeeding
  }
})
```

The exact component style may change while SimplyFlow grows. For now, think of components as a way to keep a reusable feature together.

## When components help

Components are useful when a feature has several parts:

- a template;
- styles;
- commands;
- actions;
- behaviors.

For example, a dragon feeding feature might include a button template, a command, and an action. Keeping those together makes it easier to reuse the feature in another sanctuary page.

Next: [more control](14-more-control.md).
