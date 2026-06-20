# 11. Adding behaviors

Sometimes an element needs a little extra behavior.

Maybe a dragon card can fold open and closed. Maybe a room map uses a small library. Maybe a treasure shelf can be sorted by dragging.

Use `data-simply-behavior` in HTML:

```html
<section data-simply-behavior="foldingCard" class="dragon-card">
  <h2 data-simply-field="selectedDragon.name"></h2>
  <button class="toggle">Open or close</button>
  <div class="details">
    <p data-simply-field="selectedDragon.notes"></p>
  </div>
</section>
```

Add a matching behavior to the app:

```js
const sanctuary = simply.app({
  data: {},

  behaviors: {
    foldingCard(element) {
      const button = element.querySelector('.toggle')
      const details = element.querySelector('.details')

      function toggle() {
        details.hidden = !details.hidden
      }

      button.addEventListener('click', toggle)

      return function cleanup() {
        button.removeEventListener('click', toggle)
      }
    }
  }
})
```

The behavior receives the element. It can set up listeners, call another library, or prepare the element.

If it returns a function, SimplyFlow calls that function when the behavior is removed or the app is destroyed.

## Behaviors and actions

Use behaviors for element setup.

Use actions for data changes.

For example, if a drag library lets the keeper reorder dragons, the behavior can listen to the drag library, then call an action:

```js
behaviors: {
  sortableDragons(element) {
    const sortable = makeSortable(element, {
      onMove: ({ from, to }) => {
        this.actions.moveDragon({ from, to })
      }
    })

    return () => sortable.destroy()
  }
},

actions: {
  moveDragon({ from, to }) {
    const [dragon] = this.data.dragons.splice(from, 1)
    this.data.dragons.splice(to, 0, dragon)
  }
}
```

The behavior works with the element. The action changes the data.

Next: [templates and styles](12-templates-and-styles.md).
