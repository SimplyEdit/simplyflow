# 10. Including HTML

A sanctuary page can become long. Includes let you keep parts of the HTML in separate files.

For example, put this in `dragon-card.html`:

```html
<section class="dragon-card">
  <h2 data-simply-field="selectedDragon.name"></h2>
  <p>Mood: <span data-simply-field="selectedDragon.mood"></span></p>
  <p>Snacks: <span data-simply-field="selectedDragon.snacks"></span></p>
</section>
```

Then include it in your page:

```html
<link rel="simply-include" href="dragon-card.html">
```

When the include loads, its HTML becomes part of the app. Any `data-simply-*` attributes inside it work like the rest of the page.

## Include a header

`header.html`:

```html
<header class="sanctuary-header">
  <h1>Dragon Sanctuary</h1>
  <p data-simply-field="message"></p>
</header>
```

Main page:

```html
<link rel="simply-include" href="header.html">
```

App data:

```js
data: {
  message: 'The morning bells are ringing.'
}
```

The included header shows the message.

## Scripts inside includes

If an included file contains scripts, SimplyFlow keeps their order sensible: a following script waits for a previous normal script to load first.

For beginner apps, it is usually clearer to keep app code in the main page or in one JavaScript file, and use includes mostly for HTML fragments.

Next: [adding behaviors](11-behaviors.md).
