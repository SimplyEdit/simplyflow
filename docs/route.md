# Routes

Routes map paths to functions.

```javascript
app({
  routes: {
    '/contacts/:id': function(params) {
      this.actions.selectContact(params.id)
    }
  }
})
```

Inside a route function, `this` is the app instance.

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

Route parameters are passed as an object.
