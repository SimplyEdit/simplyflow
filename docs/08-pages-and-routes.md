# 8. Pages and routes

A dragon should have a page of its own.

Routes connect URLs to actions.

```js
const sanctuary = simply.app({
  data: {
    selectedDragonId: '',
    tab: 'details',
    dragons: []
  },

  routes: {
    '/dragons/:id': 'visitDragon'
  },

  actions: {
    visitDragon({ id, tab = 'details' }) {
      this.data.selectedDragonId = id
      this.data.tab = tab
    }
  }
})
```

When the browser visits:

```text
/dragons/ember
```

SimplyFlow calls:

```js
this.actions.visitDragon({ id: 'ember' })
```

When the browser visits:

```text
/dragons/ember?tab=treasure
```

SimplyFlow calls:

```js
this.actions.visitDragon({
  id: 'ember',
  tab: 'treasure'
})
```

The action is still a normal action. It receives named values and changes data.

## Route parameters

In this route:

```js
'/dragons/:id'
```

`:id` is a named part of the path.

```text
/dragons/moss
```

passes:

```js
{ id: 'moss' }
```

## Query parameters

The query part of a URL also becomes named values:

```text
/dragons/moss?tab=notes&from=roster
```

passes:

```js
{
  id: 'moss',
  tab: 'notes',
  from: 'roster'
}
```

If a route parameter and query parameter have the same name, the route parameter wins.

```text
/dragons/moss?id=ember
```

passes:

```js
{ id: 'moss' }
```

SimplyFlow also warns in the console, because the query value was ignored.

## Wildcard routes

A wildcard can collect the rest of the path:

```js
routes: {
  '/rooms/:path*': 'openRoom'
},

actions: {
  openRoom({ path }) {
    this.data.currentRoomPath = path
  }
}
```

This URL:

```text
/rooms/mountain/cave/north
```

passes:

```js
{ path: 'mountain/cave/north' }
```

## Route functions

Most of the time, an action name is enough. If you need full control, a route can be a function:

```js
routes: {
  '/dragons/:id': function(params, searchParams) {
    this.actions.visitDragon({
      id: params.id,
      tab: searchParams.get('tab') || 'details'
    })
  }
}
```

Next: [keyboard shortcuts](09-keyboard-shortcuts.md).
