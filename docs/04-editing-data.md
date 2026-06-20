# 4. Editing data

The sanctuary register has Ember’s name in it. Let’s make it editable.

Add an input:

```html
<label>
  Dragon name
  <input data-simply-edit="dragon.name">
</label>

<p>
  Welcome,
  <strong data-simply-field="dragon.name"></strong>!
</p>
```

`data-simply-edit` shows the current value and writes user changes back to `data`.

When you type a new name, this changes:

```js
sanctuary.data.dragon.name
```

and every matching field updates.

## Editing text

Text inputs and textareas edit strings:

```html
<label>
  Name
  <input data-simply-edit="dragon.name">
</label>

<label>
  Notes
  <textarea data-simply-edit="dragon.notes"></textarea>
</label>
```

```js
data: {
  dragon: {
    name: 'Ember',
    notes: 'Likes warm stones.'
  }
}
```

## Editing a checkbox

A checkbox edits a boolean value:

```html
<label>
  Has been brushed today
  <input type="checkbox" data-simply-edit="dragon.brushed">
</label>
```

```js
data: {
  dragon: {
    brushed: false
  }
}
```

Checked means `true`. Unchecked means `false`.

## Choosing one value

Radio buttons edit one selected value:

```html
<p>Favorite snack:</p>

<label>
  <input type="radio" name="snack" value="moonberries" data-simply-edit="dragon.favoriteSnack">
  Moonberries
</label>

<label>
  <input type="radio" name="snack" value="crystal biscuits" data-simply-edit="dragon.favoriteSnack">
  Crystal biscuits
</label>
```

```js
data: {
  dragon: {
    favoriteSnack: 'moonberries'
  }
}
```

## Choosing many values

A group of checkboxes can edit an array:

```html
<p>Training badges:</p>

<label>
  <input type="checkbox" value="flying" data-simply-edit="dragon.badges">
  Flying
</label>

<label>
  <input type="checkbox" value="fire safety" data-simply-edit="dragon.badges">
  Fire safety
</label>

<label>
  <input type="checkbox" value="treasure sorting" data-simply-edit="dragon.badges">
  Treasure sorting
</label>
```

```js
data: {
  dragon: {
    badges: ['flying']
  }
}
```

Checking a box adds its value to the array. Unchecking it removes the value.

## Select menus

A normal select edits one string:

```html
<select data-simply-edit="dragon.room">
  <option>Sunstone Cave</option>
  <option>Moonlit Library</option>
  <option>Cloud Nest</option>
</select>
```

A multiple select edits an array:

```html
<select multiple data-simply-edit="dragon.chores">
  <option value="polish scales">Polish scales</option>
  <option value="sort gems">Sort gems</option>
  <option value="water moss">Water moss</option>
</select>
```

## Field and edit together

A common pattern is to edit data in one place and show it somewhere else:

```html
<input data-simply-edit="dragon.name">
<h2 data-simply-field="dragon.name"></h2>
```

Next: [lists of dragons](05-lists-of-dragons.md).
