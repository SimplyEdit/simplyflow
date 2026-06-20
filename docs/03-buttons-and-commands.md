# 3. Buttons and commands

Ember is awake now. She would like snacks.

Add two buttons:

```html
<button data-simply-command="feedDragon">Feed Ember</button>
<button data-simply-command="napDragon">Nap time</button>
```

Then add commands and actions to the app:

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    dragon: {
      name: 'Ember',
      mood: 'sleepy',
      snacks: 3
    }
  },

  commands: {
    feedDragon() {
      this.actions.feedDragon()
    },

    napDragon() {
      this.actions.napDragon()
    }
  },

  actions: {
    feedDragon() {
      if (this.data.dragon.snacks > 0) {
        this.data.dragon.snacks--
        this.data.dragon.mood = 'delighted'
      } else {
        this.data.dragon.mood = 'dramatically hungry'
      }
    },

    napDragon() {
      this.data.dragon.mood = 'sleepy'
    }
  }
})
```

A command is connected to the page. This button:

```html
<button data-simply-command="feedDragon">Feed Ember</button>
```

calls this command:

```js
commands: {
  feedDragon() {
    this.actions.feedDragon()
  }
}
```

The command calls an action. The action changes the data.

```js
actions: {
  feedDragon() {
    this.data.dragon.snacks--
  }
}
```

When the data changes, the page updates.

## Commands can receive values

A command can receive a value from HTML:

```html
<button data-simply-command="setMood" data-simply-value="sparkly">
  Sparkly mood
</button>
```

```js
commands: {
  setMood(element, mood) {
    this.actions.setMood({ mood })
  }
},

actions: {
  setMood({ mood }) {
    this.data.dragon.mood = mood
  }
}
```

The command receives:

1. the element that caused the command;
2. the value;
3. the browser event.

You can ignore the parts you do not need:

```js
commands: {
  setMood(_, mood) {
    this.actions.setMood({ mood })
  }
}
```

## A good habit

A helpful pattern is:

```text
Commands respond to the page.
Actions change the data.
```

This keeps the app easy to follow as it grows.

Next: [editing data](04-editing-data.md).
