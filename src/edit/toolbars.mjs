import anchor from './anchor.mjs'
import '../flow.mjs'


const simplyToolbarCSS = css`
:host {
    --simply-button-font: arial, helvetica, sans-serif;
    --simply-button-font-size: 11px;
    --simply-button-width: 50px;
    --simply-button-height: 50px;
    --simply-button-color: #333;
    --simply-button-primary: #ea5922;
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
    position: relative;
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
    margin: -2px auto -2px;
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
    white-space: nowrap;
    min-width: 100%;
    min-height: 50px;
    display: flex;
    position: relative;
}
.simply-toolbar-main {
    border-top: 2px solid var(--simply-button-primary);
    background: linear-gradient(180deg, white 0, white 95%, #CCC 100%);
}
.simply-toolbar-inline {
	min-width: 100px;
}
.simply-toolbar-inline .ds-button,
.simply-toolbar .ds-button {
    margin: 0;
}
.simply-toolbar-sub .simply-toolbar {
	background: #EEE;
	min-height: 40px;
}
.simply-toolbar-sub .simply-button {
	height: 40px;
	min-width: 40px;
}
.simply-toolbar-sub .simply-button .ds-icon {
    height: 20px;
    font-size: 20px;
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
    bottom: 2px;
    left: 50%;
    margin-left: -3px;
    width: 0;
    border-top: 3px solid #888;
    border-bottom: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
}
.simply-button-expanded {
	background: #EEE;
}
.simply-button.simply-button-expanded::after {
	display: none;
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
}
.ds-hidden {
	display: none;
}`


//TODO: allow app to specify which toolbar to show instead of fixed toolbars.floatToolbarText.buttons
const simplyToolbarContents = html`
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@muze-nl/theds@0.2.7/dist/theds.css">
	<style>
		${simplyToolbarCSS}
	</style>
	<nav class="simply-toolbar simply-toolbar-main simply-toolbar-inline" data-flow-list="toolbars.floatToolbarText.buttons">
		<template rel="simply-toolbar"></template>
	</nav>
	<div class="simply-toolbar-sub" data-flow-map="toolbars.floatToolbarText.toolbars">
		<template>
			<nav class="simply-toolbar ds-hidden" data-flow-field=":key" data-flow-transform="simplyToolbar">
				<div data-flow-list="buttons">
					<template rel="simply-toolbar"></template>
				</div>
			</nav>
		</template>
	</div>`

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
	padding: 0;
	border: 0;
	width: auto;
	position-anchor: --cursor-anchor;
	position-area: end span-all;
	position: absolute;
	min-width:100px;
	min-height: 50px;
	background: white;
	z-index: 10000;
	margin-top: -4px;
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
html`<div class="simply-toolbar simply-toolbar-float simply-toolbar-inline" popover="manual"></div>`
	},
	transformers: {
		simplyToolbar: function(context, next) {
			context.element.id = context.value
		},
		simplyToolbarButton: function(context, next) {
			const el = context.element
			el.value = context.value.command
			if (context.value.command=="expand") {
				el.classList.add('simply-button-expands')
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
			context.element.setAttribute('xlink:href', url.href)
			// skip next()
		}
	},
	commands: {
		toggle: function(el, value) {

		},
		align: function(el, value) {

		},
		expand: function(el, value) {
			const toolbar = el.closest('.simply-toolbar')
			const subToolbars = toolbar.nextElementSibling;
			if (!subToolbars) {
				console.error('no subtoolbars')
				return
			}
			const current = Array.from(subToolbars.querySelectorAll('.simply-toolbar:not(.ds-hidden)'))
			for( let t of current) {
				t.classList.add('ds-hidden')
			}
			const selectedToolbar = subToolbars.querySelector('#'+value)
			if (selectedToolbar) {
				selectedToolbar.classList.remove('ds-hidden')
				const buttons = Array.from(toolbar.querySelectorAll('.simply-button-expanded'))
				for (let button of buttons) {
					button.classList.remove('simply-button-expanded')
				}
				el.classList.add('simply-button-expanded')
			} else {
				console.error('toolbar '+value+' not found')
			}
		}
	},
	actions: {
		showToolbar: function(position) {
			this.state.toolbar.showPopover()
		},
		hideToolbar: function() {
			this.state.toolbar.hidePopover()
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