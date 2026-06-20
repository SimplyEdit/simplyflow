# 9. Keyboard shortcuts

Some sanctuary keepers like quick keys.

Add shortcuts to the app:

```js
const sanctuary = simply.app({
  data: {},

  shortcuts: {
    'Control+s'() {
      this.actions.saveDragons()
    },

    'f'() {
      this.actions.feedSelectedDragon({ snacks: 1 })
    }
  },

  actions: {
    saveDragons() {
      // save the register
    },

    feedSelectedDragon({ snacks }) {
      // feed the selected dragon
    }
  }
})
```

A shortcut function runs with `this` set to the app.

```js
this.data
this.actions
this.api
```

## Keep shortcuts memorable

Shortcuts are best for actions people use often:

```text
Control+s  save
f          feed selected dragon
/          focus search
Escape     close panel
```

Use buttons too. Shortcuts are helpful, but visible controls are easier to discover.

## Access keys

You can also mark elements in HTML with `data-simply-accesskey` when you want an element to respond to a key:

```html
<button data-simply-command="feedSelectedDragon" data-simply-accesskey="f">
  Feed selected dragon
</button>
```

The button remains visible, and the key gives keepers a faster path.

Next: [including HTML](10-includes.md).
