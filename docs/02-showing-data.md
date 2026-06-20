# 2. Show data on the page

A sanctuary needs more than one dragon fact. Let’s give Ember a room and a favorite treasure.

Update the data:

```js
const sanctuary = simply.app({
  container: document.querySelector('#sanctuary'),

  data: {
    dragon: {
      name: 'Ember',
      mood: 'sleepy',
      snacks: 3,
      room: 'Sunstone Cave',
      treasure: 'a tiny silver bell'
    }
  }
})
```

Now add more fields to the HTML:

```html
<section class="dragon-card">
  <h2 data-simply-field="dragon.name"></h2>

  <p>
    Mood:
    <span data-simply-field="dragon.mood"></span>
  </p>

  <p>
    Room:
    <span data-simply-field="dragon.room"></span>
  </p>

  <p>
    Favorite treasure:
    <span data-simply-field="dragon.treasure"></span>
  </p>
</section>
```

`data-simply-field` is for showing data. When the data changes, the field changes.

```js
sanctuary.data.dragon.room = 'Moonlit Library'
```

The room on the page updates.

## Nested data

Paths can go deeper:

```js
data: {
  dragon: {
    name: 'Ember',
    keeper: {
      name: 'Nia',
      badge: 'junior flame watcher'
    }
  }
}
```

```html
<p>
  Keeper:
  <span data-simply-field="dragon.keeper.name"></span>
</p>
```

## Showing numbers and booleans

Fields can show strings, numbers, and booleans:

```js
data: {
  dragon: {
    snacks: 3,
    asleep: true
  }
}
```

```html
<p>Snacks: <span data-simply-field="dragon.snacks"></span></p>
<p>Asleep: <span data-simply-field="dragon.asleep"></span></p>
```

For friendly text, you can store friendly text in your data:

```js
sanctuary.data.dragon.sleepText = sanctuary.data.dragon.asleep ? 'yes' : 'no'
```

Later, actions will help keep values like this tidy.

## Field or edit?

Use `data-simply-field` when the page should show data.

```html
<span data-simply-field="dragon.name"></span>
```

Use `data-simply-edit` when the user should change data.

```html
<input data-simply-edit="dragon.name">
```

We will use editing soon. First, let’s add buttons.

Next: [buttons and commands](03-buttons-and-commands.md).
