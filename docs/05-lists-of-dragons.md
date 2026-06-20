# 5. Lists of dragons

A sanctuary with one dragon is quiet. Let’s add a whole roster.

Use an array in `data`:

```js
data: {
  selectedDragonId: 'ember',
  dragons: [
    { id: 'ember', name: 'Ember', mood: 'sleepy', snacks: 3 },
    { id: 'moss', name: 'Moss', mood: 'curious', snacks: 7 },
    { id: 'pippin', name: 'Pippin', mood: 'muddy', snacks: 1 }
  ]
}
```

Show the array with `data-simply-list` and a `<template>`:

```html
<ul data-simply-list="dragons">
  <template>
    <li>
      <strong data-simply-field="name"></strong>
      <span data-simply-field="mood"></span>
    </li>
  </template>
</ul>
```

Inside the template, paths start at the current dragon. So this:

```html
<strong data-simply-field="name"></strong>
```

means the current dragon’s `name`.

## Use the current item in a command

Add a button to visit a dragon:

```html
<ul data-simply-list="dragons">
  <template>
    <li>
      <strong data-simply-field="name"></strong>
      <span data-simply-field="mood"></span>

      <button data-simply-command="visitDragon"
              data-simply-value=":value.id">
        Visit
      </button>
    </li>
  </template>
</ul>
```

`data-simply-value=":value.id"` passes the current dragon’s `id` to the command.

```js
commands: {
  visitDragon(element, id) {
    this.actions.visitDragon({ id })
  }
},

actions: {
  visitDragon({ id }) {
    this.data.selectedDragonId = id
  }
}
```

## Useful template values

Inside a list template:

```text
:value       the current item
:value.name  a value from the current item
:key         the list position
:root.name   a value from the app data root
```

Examples:

```html
<button data-simply-command="inspectDragon" data-simply-value=":value">
  Inspect dragon
</button>

<button data-simply-command="moveDragon" data-simply-value=":key">
  Move this row
</button>
```

If you pass `:value`, the command receives the current dragon object.

## Add a dragon

Add a form:

```html
<form data-simply-command="addDragon">
  <input name="name" placeholder="Dragon name">
  <button>Add dragon</button>
</form>
```

Then add a command and action:

```js
commands: {
  addDragon(form, values) {
    this.actions.addDragon({ name: values.name })
    form.reset()
  }
},

actions: {
  addDragon({ name }) {
    this.data.dragons.push({
      id: name.toLowerCase().replaceAll(' ', '-'),
      name,
      mood: 'new here',
      snacks: 5
    })
  }
}
```

The list updates when the array changes.

Next: [actions keep things tidy](06-actions.md).
