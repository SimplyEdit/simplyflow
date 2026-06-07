import anchor from './anchor.mjs'

const alignToolbar = {
	buttons: [
		{
			label: 'Left',
			icon: '#align-left',
			command: 'align',
			value: 'left'
		},
		{
			label: 'Center',
			icon: '#align-center',
			command: 'align',
			value: 'center'
		},
		{
			label: 'Right',
			icon: '#align-right',
			command: 'align',
			value: 'right'
		},
		{
			label: 'Justify',
			icon: '#align-justify',
			command: 'align',
			value: 'justify'
		},
		{
			label: 'None',
			icon: '#x',
			command: 'align',
			value: 'none'
		}
	]
}

const styleToolbar = {
	buttons: [
		{
			label: 'Bold',
			icon: '#bold',
			command: 'toggle',
			value: '<strong>'
		},
		{
			label: 'Italic',
			icon: '#italic',
			command: 'toggle',
			value: '<em>'
		},
		{
			label: 'Underline',
			icon: '#underline',
			command: 'toggle',
			value: '<u>'
		},
		{
			label: 'Code',
			icon: '#code',
			command: 'toggle',
			value: '<code>'
		}
	]
}


export default {
	css: {
		'simply-toolbar-float': css`
.simply-toolbar-float {
	margin: 0;
	border: 0;
	width: auto;
	position-anchor: --cursor-anchor;
	position-area: end span-all;
}
`
	},
	html: {
	'simply-toolbar': 
html`<button class="simply-button" data-flow-field=":value" data-flow-transform="simplyToolbarButton">
	<svg class="ds-icon ds-icon-feather">
        <use xlink:href="/files/feather-sprite.svg#" data-flow-field="icon">
    </use></svg>
    <span data-flow-field="label"></span>
</button>`,
	'simply-toolbar-float': 
html`<dialog class="simply-toolbar simply-toolbar-float" open>
	<nav class="simply-toolbar" data-flow-list="buttons">
		<template rel="simply-toolbar"></template>
	</nav>
	<nav class="simply-toolbar-sub" data-flow-list="toolbars">
		<template rel="simply-toolbar"></template>
	</nav>
</dialog>`
	},
	transformers: {
		simplyToolbarButton: function(context, next) {
			this.value = context.value.command
			if (context.value.command=="expand") {
				this.classList.add('simply-toolbar-button-expands')
			}
			if (context.value.command) {
				this.dataset.simplyCommand = context.value.command
			}
			if (context.value.value) {
				this.value = context.value.value
			}
			// skip next()
		}
	},
	commands: {
		toggle: function(el, value) {

		},
		align: function(el, value) {

		},
		expand: function(el, value) {

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
	state: {
		toolbars: {
			mainToolbar: {
				buttons: [
					{
						label: 'Save',
						command: 'save',
						icon: '#save'
					},
					{
						label: 'Undo',
						command: 'undo',
						icon: '#rotate-ccw'
					},
					{
						label: 'Redo',
						command: 'redo',
						icon: '#rotate-cw'
					},
					{
						label: 'Help',
						command: 'help-main',
						icon: '#help-circle'
					},
					{
						label: 'Close',
						command: 'close',
						icon: ''
					}
				]
			},
			floatToolbarText: {
				buttons: [
					{
						label: 'Text',
						icon: '#type',
						value: 'styleToolbar',
						command: 'expand'
					},
					{
						label: 'Align',
						icon: '',
						command: 'expand',
						value: 'alignToolbar'
					}
				],
				toolbars: {
					styleToolbar,
					alignToolbar
				}
			},
			floatToolbarImg: {
				buttons: [
					{
						label: 'Align',
						icon: '',
						command: 'expand',
						value: 'alignToolbar'
					}
				],
				toolbars: {
					alignToolbar
				}
			}
		}
	},
	hooks: {
		start: function() {
	        this.state.toolbar = document.querySelector('simply-edit-focus-toolbar')
	        if (!this.state.toolbar) {
	          document.body.insertAdjacentHTML('beforeend','<simply-render rel="simply-toolbar-float"></simply-render>')
	          setTimeout(() => {
	            this.state.toolbar = document.querySelector('dialog.simply-toolbar-float')
       	        simply.state.effect(() => {
		        	let visible = this.state.anchor.visible
		        	if (visible) {
		        		this.actions.showToolbar()
		        	} else {
		        		this.actions.hideToolbar()
		        	}
		        })

	          }, 1000)
	        }

		}
	},
	components: {
		anchor
	}
}