# 1. Meet your first app

Ember is a sleepy dragon. We will make a tiny page that knows her name, mood, and snack count.

Create an HTML file like this:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dragon Sanctuary</title>
  <script src="https://cdn.jsdelivr.net/npm/simplyflow/dist/simply.flow.js"></script>
</head>
<body>
  <main id="sanctuary">
    <h1>Dragon Sanctuary</h1>

    <p>
      <strong data-simply-field="dragon.name"></strong>
      is feeling
      <span data-simply-field="dragon.mood"></span>.
    </p>

    <p>
      Snacks left:
      <span data-simply-field="dragon.snacks"></span>
    </p>
  </main>

  <script>
    const sanctuary = simply.app({
      container: document.querySelector('#sanctuary'),

      data: {
        dragon: {
          name: 'Ember',
          mood: 'sleepy',
          snacks: 3
        }
      }
    })
  </script>
</body>
</html>
```

Open the file in a browser. The empty parts of the page are filled from `data`.

This line:

```html
<strong data-simply-field="dragon.name"></strong>
```

shows this value:

```js
data: {
  dragon: {
    name: 'Ember'
  }
}
```

The path `dragon.name` means: start at `data`, then look inside `dragon`, then show `name`.

## Try changing the data

Open the browser console and type:

```js
sanctuary.data.dragon.mood = 'curious'
```

The page changes right away.

Then try:

```js
sanctuary.data.dragon.snacks = 10
```

The snack count changes too.

You are changing ordinary JavaScript data. SimplyFlow notices and updates the matching HTML.

## What you have made

You now have an app with:

- a container: `#sanctuary`
- some app data: `dragon.name`, `dragon.mood`, `dragon.snacks`
- fields in the HTML that show that data

Next: [show more kinds of data](02-showing-data.md).
