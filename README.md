# SimplyFlow

SimplyFlow is an experimental browser library for building small reactive web applications with ordinary HTML and ordinary JavaScript data.

It now includes the former SimplyView app layer. The intended beginner-facing API is:

```javascript
import { app } from 'simplyflow/src/flow.mjs'

const counter = app({
  container: document.getElementById('counter'),

  data: {
    count: 0
  },

  commands: {
    add1() {
      this.data.count++
    }
  }
})
```

```html
<div id="counter">
  <button data-simply-command="add1">+</button>
  <span data-simply-field="count"></span>
</div>
```

The page updates automatically whenever `app.data` changes.

## Install

```shell
npm install simplyflow
```

or using Git:

```shell
git clone https://github.com/SimplyEdit/simplyflow.git
```

## Browser bundle

```html
<script src="https://cdn.jsdelivr.net/npm/simplyflow/dist/simply.flow.js"></script>
```

Then use the global `simply` object:

```javascript
const counter = simply.app({
  data: { count: 0 },
  commands: {
    add1() {
      this.data.count++
    }
  }
})
```

## Lower-level APIs

The app API is built on smaller modules that can also be used directly:

```javascript
import { signal, effect, batch } from 'simplyflow/src/state.mjs'
import { bind } from 'simplyflow/src/bind.mjs'
import { model, paging, sort, filter, columns } from 'simplyflow/src/model.mjs'

const data = signal({ title: 'Hello' })
bind({ root: data })
```

## Documentation

- [App API](docs/app.md)
- [Binding API](docs/bind.md)
- [Model API](docs/model.md)
- [State API](docs/state.md)
- [Commands](docs/command.md)
- [Actions](docs/action.md)
- [Routes](docs/route.md)

Or check the [examples](examples/) for more information.

## License

[MIT](LICENSE) &copy; Muze.nl

## Contributions

Contributions are welcome, but make sure that all code is MIT licensed. If you want to send a merge request, please make sure that there is a ticket that shows the bug/feature and reference it. If you find any problem, please do file a ticket, but you should not expect a timely resolution. This project is still very experimental, don't use it in production unless you are ready to fix problems yourself.
