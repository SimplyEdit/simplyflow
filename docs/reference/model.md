# Model module

```js
import { model } from './src/flow.mjs'
```

The model module creates reactive data-view pipelines. It is useful for tables and lists that need sorting, filtering, paging or virtual scrolling.

## `model(options)`

```js
const table = model.model({
  data: [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Grace' }
  ]
})
```

When imported from `flow.mjs`, `model` is a namespace. In the browser global, `simply.model` is callable and also has helper methods:

```js
const table = simply.model({ data: [] })
table.addEffect(simply.model.sort({ sortBy: 'name' }))
```

A model has:

| Property | Description |
| --- | --- |
| `state` | Reactive model state, including `data` and `options`. |
| `effects` | Pipeline outputs. The first item is the source data signal. |
| `view` | The current output signal. Usually read as `model.view.current`. |

## `model.addEffect(fn)`

Adds a transform to the pipeline. `fn` is called with the previous pipeline signal and must return a signal.

Most users use the built-in transform factories below.

## `sort(options)`

Sorts the input data.

```js
table.addEffect(model.sort({
  sortBy: 'name',
  sortDirection: 'asc'
}))
```

Options:

| Option | Default | Description |
| --- | --- | --- |
| `sortBy` | `null` | Property name to sort by. |
| `direction` | `'asc'` | Sort direction. |
| `sortDirection` | — | Preferred direction option. Overrides `direction`. |
| `sortFn` | default comparator | Custom comparator called with `this` set to the model. |

Changing `table.state.options.sort` reruns the sort.

## `filter(options)`

Filters input rows when enabled.

```js
table.addEffect(model.filter({
  name: 'activeFilter',
  enabled: false,
  matches(row) {
    return row.active === this.state.options.activeFilter.active
  },
  active: true
}))

// later
table.state.options.activeFilter.enabled = true
```

Options:

| Option | Description |
| --- | --- |
| `name` | Required unique filter name. |
| `matches` | Required predicate called with `this` set to the model. |
| `enabled` | Filter only applies when truthy. Disabled by default if omitted. |

The filter options are stored under `model.state.options[name]`, so extra custom options may live there too.

## `paging(options)`

Slices input data to a page.

```js
table.addEffect(model.paging({ page: 1, pageSize: 20 }))
```

Options:

| Option | Default | Description |
| --- | --- | --- |
| `page` | `1` | Current page, starting at 1. |
| `pageSize` | `20` | Items per page. |
| `max` | calculated | Number of available pages. |

## `columns(options)`

Selects visible columns from object rows.

```js
table.addEffect(model.columns({
  columns: {
    id: {},
    name: {},
    email: { hidden: true }
  }
}))
```

A shorthand object shape is also supported:

```js
model.columns({ id: {}, name: {} })
```

## `scroll(options)`

Returns a slice suitable for virtual scrolling.

Options include:

| Option | Default | Description |
| --- | --- | --- |
| `offset` | `0` | First row offset. |
| `rowHeight` | `26` | Row height in pixels. |
| `rowCount` | `20` | Number of rows in the slice. |
| `itemsPerRow` | `1` | Items per visual row. |
| `size` | input length | Source size. |
| `scrollbar` | — | Optional scrollbar element to update. |
| `container` | — | Optional scrolling container. |
