# 8. Pages and routes

A sanctuary can grow. After a while, one page with everything on it starts to feel crowded.

Routes let different URLs show different parts of your app. For example:

```text
/dragons/ember
/dragons/moss
/dragons/ember?tab=treasure
```

With SimplyFlow, a route can call an action.

## Give each dragon its own page

Start with some dragon data:

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    selectedDragonId: 'ember',

    dragons: [
      {
        id: 'ember',
        name: 'Ember',
        mood: 'sleepy',
        treasure: 'three brass buttons'
      },
      {
        id: 'moss',
        name: 'Moss',
        mood: 'curious',
        treasure: 'a shiny green pebble'
      },
      {
        id: 'luna',
        name: 'Luna',
        mood: 'dramatic',
        treasure: 'one moonlit feather'
      }
    ]
  },

  routes: {
    '/dragons/:id': 'chooseDragon'
  },

  actions: {
    chooseDragon({ id }) {
      this.data.selectedDragonId = id
    }
  }
})
```

The route:

```js
'/dragons/:id': 'chooseDragon'
```

means:

> When the URL looks like `/dragons/ember`, call the `chooseDragon` action with `{ id: 'ember' }`.

So this URL:

```text
/dragons/moss
```

calls:

```js
chooseDragon({ id: 'moss' })
```

## Show the selected dragon

Now add a small helper action that finds the selected dragon.

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    selectedDragonId: 'ember',
    selectedDragon: null,

    dragons: [
      {
        id: 'ember',
        name: 'Ember',
        mood: 'sleepy',
        treasure: 'three brass buttons'
      },
      {
        id: 'moss',
        name: 'Moss',
        mood: 'curious',
        treasure: 'a shiny green pebble'
      },
      {
        id: 'luna',
        name: 'Luna',
        mood: 'dramatic',
        treasure: 'one moonlit feather'
      }
    ]
  },

  start() {
    this.actions.chooseDragon({
      id: this.data.selectedDragonId
    })
  },

  routes: {
    '/dragons/:id': 'chooseDragon'
  },

  actions: {
    chooseDragon({ id }) {
      this.data.selectedDragonId = id

      this.data.selectedDragon = this.data.dragons.find(dragon => {
        return dragon.id === id
      })
    }
  }
})
```

And show it in HTML:

```html
<main id="sanctuary">
  <h1 data-simply-field="selectedDragon.name"></h1>

  <p>
    Mood:
    <strong data-simply-field="selectedDragon.mood"></strong>
  </p>

  <p>
    Treasure:
    <span data-simply-field="selectedDragon.treasure"></span>
  </p>
</main>
```

Now visiting:

```text
/dragons/ember
```

shows Ember, and visiting:

```text
/dragons/moss
```

shows Moss.

## Add links between dragons

You can use normal links:

```html
<nav>
  <a href="/dragons/ember">Visit Ember</a>
  <a href="/dragons/moss">Visit Moss</a>
  <a href="/dragons/luna">Visit Luna</a>
</nav>
```

When the user clicks one of these links, SimplyFlow matches the route and calls the action.

## Query values become named values too

A URL can also contain extra values after a `?`.

```text
/dragons/ember?tab=treasure
```

The route still matches:

```js
'/dragons/:id': 'chooseDragon'
```

And the action receives both values:

```js
chooseDragon({
  id: 'ember',
  tab: 'treasure'
})
```

You can use this to remember which part of the dragon page is open.

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    selectedDragonId: 'ember',
    selectedDragon: null,
    selectedTab: 'profile',

    dragons: [
      {
        id: 'ember',
        name: 'Ember',
        mood: 'sleepy',
        treasure: 'three brass buttons'
      },
      {
        id: 'moss',
        name: 'Moss',
        mood: 'curious',
        treasure: 'a shiny green pebble'
      }
    ]
  },

  routes: {
    '/dragons/:id': 'chooseDragon'
  },

  actions: {
    chooseDragon({ id, tab = 'profile' }) {
      this.data.selectedDragonId = id
      this.data.selectedTab = tab

      this.data.selectedDragon = this.data.dragons.find(dragon => {
        return dragon.id === id
      })
    }
  }
})
```

Now these URLs all work:

```text
/dragons/ember
/dragons/ember?tab=profile
/dragons/ember?tab=treasure
```

## Route values are safer than query values

If a route value and a query value have the same name, the route value wins.

For example:

```text
/dragons/ember?id=moss
```

still calls:

```js
chooseDragon({
  id: 'ember'
})
```

The route says the dragon is `ember`, so SimplyFlow keeps that value.

## Wildcard routes

Sometimes you want a route to catch the rest of a path.

```js
routes: {
  '/dragon-files/:path*': 'openDragonFile'
}
```

This URL:

```text
/dragon-files/ember/maps/cave.txt
```

calls:

```js
openDragonFile({
  path: 'ember/maps/cave.txt'
})
```

Example action:

```js
actions: {
  openDragonFile({ path }) {
    this.data.currentFile = path
  }
}
```

## What you learned

Routes connect URLs to actions.

```js
routes: {
  '/dragons/:id': 'chooseDragon'
}
```

Actions receive named values.

```js
actions: {
  chooseDragon({ id, tab = 'profile' }) {
    this.data.selectedDragonId = id
    this.data.selectedTab = tab
  }
}
```

That means your actions can stay simple. They do not need to know much about URLs. They just receive the values they need.

Next: [add keyboard shortcuts for common dragon-keeper tasks.](./09-keyboard-shortcuts.md)