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
command(element, value)
```

For forms, `value` is an object containing the form fields. For buttons and links, `value` is `data-simply-value`, `href` or `value`.
