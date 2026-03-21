# SimplyFlow: bind

This implements one-way databinding between your data and the browser DOM using signals and effects.

```html
<!doctype html>
<h1 data-flow-field="title">A title</h1>
<script type="module">
  import {signal} from 'simplyflow/src/state.mjs'
  import {bind} from 'simplyflow/src/bind.mjs'
  let myData = signal({ title: "The real title"})
  bind({
  	root: myData
  })
</script>
```

The above page will display a page with a H1 element with 'The real title' as contents. Then if you change `myData.title`, the page will be updated immediately, e.g:

```javascript
  myData.title = 'Another title'
```

## How it works

The databinding layer implemented here parses the DOM to see if any of the `data-flow-field`,`data-flow-list` or `data-flow-map` attributes are used. If so, it will add an effect for each that listens for any changes. When the referenced data is changed, the effect is called, and that updates the DOM, but only for the data that is changed. This is called fine-grained updates.

## Options

- root
  The root object (signal) to use
- container
  The DOM element to use as a container element, default to the body
- attribute
  The base attribute name to use, defaults to `data-flow`
- transformers
  Additional transformers that you can use in your data bindings
- defaultTransformers
  Contains optionally any of `field`, `list` or `map` entries, with a different default transformer for those databindings.

## Attributes

- data-flow-field
- data-flow-list
- data-flow-map
	These reference a JSON path inside the root object, to bind to.

- data-flow-transform
    Adds one or more transformers to apply. Use a space-separated list for more than one:
    `data-flow-transformer="toUpper toLink"`
    Transformers are called in order, the output of one is the input of the next. Transformers may have side effects, such as changing the DOM.

- data-flow-match
	If you have more than one template defined for a field, list or map, you can specify which template to use by adding `data-flow-match="{value}"`. By default the variable used in the field, list or map will be checked. But if you specify a specific field on a template, that will be used instead:
	```html
	  <ul data-flow-list="menu">
	  	<template data-flow-field="visible" data-flow-match=":empty"></template>
	  	<template>
	  		<li><a data-flow-field="link"></a></li>
	  	</template>
	```
	The first matching template will be used.

- data-flow-link
  Allows you to link fields in a template to specific fields/data
  ```html
  <div data-flow-field="users">
		<template rel="datatable" data-flow-link="columns=users.state.options.columns;rows=users.view.current"></template>
	</div>
  ```
  In this case, the template uses two lists, called `columns` and `rows` respectively. When the template is rendered, `columns` is mapped to `users.state.options.columns` and `rows` to `users.view.current`.

## Transformers

Transformers can change the rendering of fields, lists and maps. A transformer is a function with this signature:

```javascript
function (context, next) {
	// do something
	next()
}
```

`context` is an object with these properties:
- element
  The DOM element being rendered
- path
  The full path from the root data
- value
  The current value to be rendered
- templates
  The list of templates, if defined
- parent (optionally)
  The parent element, in the case of lists and maps
- list (optionally)
  The list of values of the parent list or map

A transformer doesn't return anything, but it can change the context object for any following transformers. A transformer should call the `next()` function to allow all transformers to run.

Finally the default transformer will always be run. These are provided by the library, but you can override them in the options param to the `bind` function. They are responsible for rendering the data, matching templates, etc.

## Templates

Any field, list or map can use one or more templates:

```html
<ul data-flow-list="menu">
	<template>
		<li><a data-flow-field="link"></a></li>
	</template>
</ul>
<script>
	myData.menu = [
		{
			link: {
				href: '#home',
				innerHTML: 'Home'
			}
		},
		{
			link: {
				href: '#profile',
				innerHTML: 'Profile'
			}
		},
	]
</script>
```

You can add more than one template, if you use `data-flow-match`. The first template that matches is used:

```html
  <ul data-flow-list="menu">
  	<template data-flow-field="visible" data-flow-match=":empty"></template>
  	<template>
  		<li><a data-flow-field="link"></a></li>
  	</template>
```


## Special attribute values

- :key
- :value
	These attribute values can be used for `data-flow-field`, `data-flow-list` and `data-flow-map`, when inside a template used with a `data-flow-list` or `data-flow-map`.
	The template is rendered for each entry in the list or map. For each entry, `:key` will reference the current property name or number, and `:value` the current property value.
	You can add subpaths to these values by adding `.subproperty`, just like a normal JSON path.
	```
	<ul data-flow-list="menu">
	    <template>
	        <li>
	       		<span data-flow-field=":key">0</span>
	       		<a data-flow-field=":value"></a>
	       	</li>
        </template>
	</ul>
	```
- :empty
- :notempty
	These attribute values are meant to be used with `data-flow-match`. `:empty` will match `falsy` values, `:notempty` will match `truthy` values.
- :root
	Whenever you specify this value, you will always reference the root data object. You can add subpaths to this value, just like a normal JSON path.
 	