# SimplyFlow reference

This folder contains reference documentation for the public SimplyFlow modules. It is meant as a lookup guide, not as a tutorial. Start with the main project README and examples when learning the library for the first time.

## Beginner-facing modules

- [App](app.md) — `app()` and the application options: `data`, `commands`, `actions`, `routes`, `shortcuts`, `behaviors`, `templates`, `styles`, `start`, and `onError`.
- [Commands](command.md) — DOM events to command functions, form values, dynamic command values, and manual command calls.
- [Actions](action.md) — application actions, `this` binding, error handling, and unknown-action warnings.
- [Routes](route.md) — URL routes, route parameters, query parameters, link handling, and lower-level route instances.
- [Shortcuts](shortcut.md) — keyboard shortcuts and access keys.
- [Behaviors](behavior.md) — attaching reusable JavaScript behavior to DOM elements.
- [Includes](include.md) — app-scoped HTML includes and the lower-level include helpers.

## Data, rendering and advanced modules

- [Binding](bind.md) — lower-level DOM/data binding: fields, edit fields, lists, maps, renderers, transformers, and tracing.
- [Binding renderers](bind-render.md) — renderer functions used by the binding module.
- [Binding transformers](bind-transformers.md) — built-in binding transformers.
- [State](state.md) — signals, effects, batching, custom signals, cloning, and low-level reactive primitives.
- [Model](model.md) — list/data transforms: sorting, paging, filtering, columns, and virtual scrolling.
- [DOM signals](dom.md) — reactive DOM proxies and DOM-to-data tracking helpers.
- [Path](path.md) — dotted-path helpers used by commands and binding.
- [Render element](render.md) — the `<simply-render>` custom element.

## Entry point and utilities

- [Flow entry point](flow.md) — main module exports and browser globals.
- [Highlight helpers](highlight.md) — global `html` and `css` template tags for editor syntax highlighting.

## Experimental and support modules

- [Edit](edit.md) — experimental editing helper built on top of the app layer.
- [Suggest](suggest.md) — typo-suggestion helpers used by developer warnings.
- [Symbols](symbols.md) — shared internal symbols used by advanced extensions.
