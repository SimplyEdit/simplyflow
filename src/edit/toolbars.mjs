import anchor from './anchor.mjs'
import '../flow.mjs'


const simplyToolbarCSS = css`
:host {
    --simply-button-font: arial, helvetica, sans-serif;
    --simply-button-font-size: 11px;
    --simply-button-width: 60px;
    --simply-button-height: 60px;
    --simply-button-color: #333;
    --simply-button-primary: var(--ds-primary);
}
.simply-button {
    height: var(--simply-button-height);
    border-top: 1px solid transparent;
    border-bottom: 2px solid transparent;
    transition: background 0.2s ease;
    font-size: var(--simply-button-font-size);
    letter-spacing: 0;
    font-family: var(--simply-button-font);
    white-space: nowrap;
    user-select: none;
    vertical-align: top;
    min-width: var(--simply-button-width);
    text-align: center;
    cursor: pointer;
    padding: 0 4px;
    text-transform: none;
    background: transparent;
    outline: none;
    box-shadow: none;
    border-radius: 0;
    color: var(--simply-button-color);
}
.simply-button:hover {
    border-bottom: 2px solid var(--simply-button-primary);
    box-shadow: none;
}
.simply-button .ds-icon {
    height: 26px;
    font-size: 26px;
    padding: 0 4px;
    display: block;
    margin: 6px auto -14px;
    position: relative;
}
.simply-button.ds-selected {
    border-top-color: var(--ds-grey-40);
    background-color: var(--ds-grey-light);
    border-left: 1px solid var(--ds-grey-40);
    border-right: 1px solid var(--ds-white);
}
.simply-button:active {
	border-bottom: 2px solid var(--ds-primary);
    box-shadow: none;
}
.simply-toolbar {
    border-top: 1px solid var(--simply-button-primary);
    background: linear-gradient(180deg, var(--ds-white) 0, var(--ds-white) 95%, var(--ds-grey-40) 100%);
    white-space: nowrap;
    min-width: 100%;
    min-height: 60px;
    display: flex;
    position: relative;
}
.simply-toolbar-inline {
	min-width: 100px;
}
.simply-toolbar-inline .ds-button,
.simply-toolbar .ds-button {
    margin: 0;
}
.simply-toolbar-highlight {
    background: var(--ds-primary-gradient-bump);
    color: var(--ds-primary-contrast);
}
.simply-toolbar  .simply-toolbar-title {
    margin-top: 0;
}
.simply-toolbar-spacer {
    border-left: 1px solid #ccc;
    height: 60px;
    position: absolute;
    display: inline-block;
}
.simply-button-expands:not(.ds-selected)::after {
    content: "";
    display: block;
    position: absolute;
    bottom: 6px;
    left: 50%;
    margin-left: -3px;
    width: 0;
    border-top: 3px solid #888;
    border-bottom: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
}
.simply-toolbar .simply-push-right {
    margin-left: auto;
}
.simply-toolbar input[type="text"] {
    margin-right:0;
    margin-bottom: 0;
    margin-top: 10px;
    font-size: small;
    line-height: 1.2em;
    height: 35px;
}
.simply-toolbar-header {
    border-top-width: 5px;
}
.ds-nightmode .simply-toolbar {
    background: linear-gradient(var(--ds-grey-90) 0%, var(--ds-grey-90) 95%, black 100%);
    color: var(--ds-white);
}
.ds-nightmode .simply-button {
    color: var(--ds-white);
}
.ds-nightmode .simply-button.ds-selected {
    background-color: var(--ds-grey-80);
    border-left-color: var(--ds-black);
    border-top-color: var(--ds-black);
    border-right-color: var(--ds-grey-60);
}
.ds-nightmode .simply-button[disabled] {
    background-color: transparent;
    color: var(--ds-grey-60);
}`


//TODO: allow app to specify which toolbar to show instead of fixed toolbars.floatToolbarText.buttons
const simplyToolbarContents = html`
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@muze-nl/theds@0.2.7/dist/theds.css">
	<style>
		${simplyToolbarCSS}
	</style>
	<nav class="simply-toolbar simply-toolbar-inline" data-flow-list="toolbars.floatToolbarText.buttons">
		<template rel="simply-toolbar"></template>
	</nav>
	<!-- nav class="simply-toolbar-sub" data-flow-list="toolbars">
		<template rel="simply-toolbar"></template>
	</nav -->`

export default {
	css: {
		simplyToolbarFloat: css`
:root {
	--ds-shadow-light: rgba(0,0,0,0.07);
	--ds-shadow-middle: rgba(0,0,0,0.09);
	--ds-shadow-dark: rgba(0,0,0,0.11);
	--ds-shadow-small: 
	    0 1px 1px var(--ds-shadow-dark),
	    0 2px 2px var(--ds-shadow-middle),
	    0 4px 4px var(--ds-shadow-light)
	;
}
.simply-toolbar-float {
	margin: 0;
	border: 0;
	width: auto;
	position-anchor: --cursor-anchor;
	position-area: end span-all;
	position: absolute;
	min-width:100px;
	min-height: 60px;
	background: white;
	z-index: 10000;
	margin-top: -4px;
	border: 1px solid red;
	box-shadow: var(--ds-shadow-small);
}`
	},
	html: {
	'simply-toolbar': 
html`<button class="ds-button simply-button" data-flow-field=":value" data-flow-transform="simplyToolbarButton">
	<svg class="ds-icon ds-icon-feather">
        <use xlink:href="feather-sprite.svg#x" data-flow-transform="simplyIcon" data-flow-field="icon">
    </use></svg>
    <span data-flow-field="label"></span>
</button>`,
	'simply-toolbar-float': 
html`<div class="simply-toolbar simply-toolbar-float simply-toolbar-inline"></div>`
	},
	transformers: {
		simplyToolbarButton: function(context, next) {
			const el = context.element
			el.value = context.value.command
			if (context.value.command=="expand") {
				el.classList.add('simply-toolbar-button-expands')
			}
			if (context.value.command) {
				el.dataset.simplyCommand = context.value.command
			}
			if (context.value.value) {
				el.value = context.value.value
			}
			// skip next()
		},
		simplyIcon: function(context, next) {
			const url = new URL(context.element.getAttribute('xlink:href'), document.location)
			url.hash = context.value
//			context.element.setAttribute('xlink:href', url.href)
			// skip next()
		}
	},
	commands: {
		toggle: function(el, value) {

		},
		align: function(el, value) {

		},
		expand: function(el, value) {
			alert('expand')
		}
	},
	actions: {
		showToolbar: function(position) {
			this.state.toolbar.style.display = 'block'
		},
		hideToolbar: function() {
			this.state.toolbar.style.display = 'none'
		}
	},
	hooks: {
		start: function() {
	        this.state.toolbar = this.container.querySelector('simply-edit-focus-toolbar')
	        if (!this.state.toolbar) {
				this.container.insertAdjacentHTML('beforeend','<simply-render rel="simply-toolbar-float"></simply-render>')
				setTimeout(() => {
					const toolbar = document.querySelector('.simply-toolbar-float')
					const shadow = toolbar.attachShadow({ mode: "open"})
					shadow.innerHTML = simplyToolbarContents
					this.state.toolbar = toolbar
				    simply.state.effect(() => {
						let visible = this.state.anchor.visible
						if (visible) {
							this.actions.showToolbar()
						} else {
							this.actions.hideToolbar()
						}
					})
					// databinding doesn't reach into shadowRoot by default, so set it up here
					simply.bind({
						root: this.state,
						container: toolbar.shadowRoot,
						transformers: this.transformers
					})
					// same for commands, set container explicitly to the shadowRoot
					simply.command({ app: this, container: toolbar.shadowRoot, commands: this.commands})
				}, 100)
	        }
		}
	},
	components: {
		anchor
	}
}