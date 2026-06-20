# Commands

Commands connect DOM events to app behavior. They are usually defined through `app({ commands })`.

```html
<button data-simply-command="addTodo" data-simply-value="Buy milk">Add</button>
```

```javascript
app({
  data: { todos: [] },
  commands: {
    addTodo(el, value) {
      this.actions.addTodo(value)
    }
  },
  actions: {
    addTodo(text) {
      this.data.todos.push({ text, done: false })
    }
  }
})
```

Inside a command, `this` is the app instance.

## Event handling

By default commands run for:

- clicks on links, buttons and other clickable elements;
- form submissions;
- input/select/textarea changes;
- input events when `data-simply-immediate` is present.

A command receives:

```javascript
command(element, value, event)
```

- `element` is the element that has `data-simply-command`.
- `value` is the command value. For forms, this is an object containing the form fields. For buttons and links, it is `data-simply-value`, `href` or `value`.
- `event` is the original DOM event. Use it only when the command needs event details such as modifier keys or pointer information.

## Dynamic values in templates

Inside `data-simply-list` and `data-simply-map` templates, `data-simply-value` can refer to the current item:

```html
<ul data-simply-list="todos">
  <template>
    <li>
      <button data-simply-command="remove" data-simply-value=":value.id">Remove</button>
      <span data-simply-field="text"></span>
    </li>
  </template>
</ul>
```

Supported dynamic values are:

- `:value` — the current list or map item;
- `:value.name` — a property of the current item;
- `:key` — the current list index or map key;
- `:root.name` — a value from the app data root.

Literal command values still work normally:

```html
<button data-simply-command="filter" data-simply-value="done">Done</button>
```

Unknown commands log a warning once. If the name looks like a typo of one of your commands, SimplyFlow suggests the closest command name.
