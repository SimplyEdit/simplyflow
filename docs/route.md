# Routes

Routes map paths to actions or functions.

The simplest form uses an action name:

```javascript
app({
  actions: {
    selectContact({ id, tab = 'details' }) {
      this.data.selectedContactId = id
      this.data.selectedTab = tab
    }
  },

  routes: {
    '/contacts/:id': 'selectContact'
  }
})
```

When the route matches, SimplyFlow calls the action with one plain object of named parameters. Query parameters are added first, then route parameters are added after them. If both use the same name, the route parameter wins and SimplyFlow logs a warning.

For example, `/contacts/42?tab=notes` calls:

```javascript
this.actions.selectContact({
  id: '42',
  tab: 'notes'
})
```

Repeated query parameters become arrays. For example, `/search?tag=js&tag=html` passes `{ tag: ['js', 'html'] }`.

Routes can also use functions directly:

```javascript
app({
  routes: {
    '/contacts/:id': function(params, searchParams) {
      this.actions.selectContact({
        id: params.id,
        tab: searchParams.get('tab') || 'details'
      })
    }
  }
})
```

Inside a route function, `this` is the app instance. Function routes receive route params and the raw `URLSearchParams` object because they are route-specific handlers.

Routes can also be used directly:

```javascript
import { routes } from '../src/flow.mjs'

const router = routes({
  routes: {
    '/hello/:name': params => params.name
  }
})

router.match('/hello/Ada')
```

