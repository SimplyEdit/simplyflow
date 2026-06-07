import toolbars from './edit/toolbars.mjs'
import '../src/flow.mjs'

export function edit(rootElement)
{
  return simply.app({
    container: rootElement,
    actions: {
      close: function() {
        this.container.removeAttribute('contenteditable')
        document.removeEventListener(this.selectionListener)
      }
    },
    keyboard: {
      default: {
        'Control+ ': function() {
          if (this.state.anchor.visible) {
            this.actions.showToolbar()
          } else {
            this.actions.hideToolbar()
          }
        }
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
        // make sure this.state is a signal before calling start hooks of components
        // and simply.bind - move to default start() hook in app.mjs (when simplyflow is in simplyview)
        this.state = simply.state.signal(this.state),
        simply.bind({
          root: this.state
        })
        this.container.setAttribute('contenteditable', true)
        // move this code to default start() hook in app.mja, run it before
        // the app.hooks.start function
        for (let component in this.components) {
          if (this.components[component].hooks?.start) {
            this.components[component].hooks.start.apply(this)
          }
        }
      }
    },
    components: {
      toolbars
    }
  })
}

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
