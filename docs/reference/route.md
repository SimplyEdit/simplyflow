# Route module

```js
import { routes, SimplyRoute } from './src/route.mjs'
```

Routes connect URLs to functions or action names.

## `app({ routes })`

The beginner-facing form maps path patterns to action names.

```js
app({
  data: { selectedContactId: null, tab: 'details' },

  actions: {
    showContact({ id, tab = 'details' }) {
      this.data.selectedContactId = id
      this.data.tab = tab
    }
  },

  routes: {
    '/contacts/:id': 'showContact'
  }
})
```

Visiting:

```text
/contacts/bob?tab=notes
```

calls:

```js
showContact({ id: 'bob', tab: 'notes' })
```

## Route parameters

Use `:name` for one path segment:

```js
'/contacts/:id'
```

Use `:name*` for a named wildcard:

```js
'/files/:path*'
```

For `/files/docs/readme.md`, the action receives:

```js
{ path: 'docs/readme.md' }
```

The old wildcard syntax `:*` is not supported.

## Query parameters

Query parameters are merged into the named action argument.

```text
/search?q=signals&page=2
```

passes:

```js
{ q: 'signals', page: '2' }
```

Repeated query parameters become arrays:

```text
/search?tag=js&tag=html
```

passes:

```js
{ tag: ['js', 'html'] }
```

If a query parameter conflicts with a route parameter, the route parameter wins and SimplyFlow warns once.

```text
/contacts/bob?id=alice
```

with route `/contacts/:id` passes `{ id: 'bob' }`.

## Route functions

Routes can also be functions. Route functions receive route-specific arguments:

```js
routes: {
  '/contacts/:id'(params, searchParams) {
    this.actions.showContact({
      id: params.id,
      tab: searchParams.get('tab') || 'details'
    })
  }
}
```

Inside route functions, `this` is the app instance.

## Lower-level `routes(options)`

```js
const routeApi = routes({
  app,
  baseURL: '/',
  routes: {
    '/contacts/:id': 'showContact'
  }
})
```

Options:

| Option | Description |
| --- | --- |
| `app` | App-like object used as `this` and for action lookup. |
| `routes` | Route map. |
| `baseURL` | Base path. Defaults to `/`. |
| `addMissingSlash` | If true, matching may add a trailing slash and replace browser history. |
| `matchExact` | If true, route patterns match the full route path. |
| `hijackLinks` | If true, internal matching links are handled by the router. |

## `SimplyRoute` methods

| Method | Description |
| --- | --- |
| `load(routes)` | Adds route definitions. |
| `clear()` | Clears routes and listeners. |
| `match(path?, options?)` | Matches a path or the current location. If `path` has a query string, query values are passed to action shorthand but not used for path matching. |
| `goto(path)` | Pushes browser history and matches the path. |
| `has(path)` | Returns `true` when a path matches a route. |
| `handleEvents()` | Adds browser `popstate` and internal link-click handlers. |
| `removeEvents()` | Removes those browser event handlers. |
| `destroy()` | Removes browser event handlers. |
| `init({ baseURL })` | Updates router options. |
| `addListener(type, route, callback)` | Adds a listener. Types: `match`, `call`, `goto`, `finish`. |
| `removeListener(type, route, callback)` | Removes a listener. |

## Listener callbacks

Listeners receive an object describing the route operation. Returning a replacement object changes the values passed to later steps.

Unknown listener types throw a `TypeError`.
