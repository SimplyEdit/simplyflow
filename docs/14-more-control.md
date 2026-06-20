# 14. More control

Most small apps can start with `simply.app()`.

SimplyFlow also has smaller pieces you can use directly when you want more control.

## Bind data to HTML

`bind()` connects reactive data to HTML.

```js
const data = simply.signal({
  dragon: {
    name: 'Ember'
  }
})

simply.bind({
  root: data,
  container: document.querySelector('#sanctuary'),
  attribute: 'data-simply'
})
```

`app()` uses `bind()` for you.

## Signals and effects

Signals are reactive data. Effects run when the data they read changes.

```js
const data = simply.signal({ snacks: 3 })

const snackText = simply.effect(() => {
  return `Snacks left: ${data.snacks}`
})

data.snacks = 2

console.log(snackText.current)
```

## Models

`model()` helps with data views such as sorting, filtering, columns, and paging.

```js
const dragonTable = simply.model({
  data: [
    { name: 'Ember', snacks: 3 },
    { name: 'Moss', snacks: 7 }
  ]
})

dragonTable.addEffect(simply.model.sort({ property: 'name' }))
```

## Lower-level app modules

The browser bundle exposes useful pieces directly:

```js
simply.app
simply.bind
simply.signal
simply.effect
simply.model
simply.routes
simply.commands
simply.actions
simply.behaviors
simply.includes
```

For exact options and return values, use the [reference documentation](reference/README.md).
