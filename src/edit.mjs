import toolbars from './edit/toolbars.mjs'
import '../src/flow.mjs'

const editSet = new Set()

export function edit(rootElement)
{
  return simply.app({
    container: rootElement,
    actions: {
      editAll: function(elements) {
        for (let el of elements) {
          this.actions.edit(el)
        }
      },
      edit: function(el) {
        el.setAttribute('contenteditable', true)
        editSet.add(el, true)
      },
      editClose: function(el) {
        el.removeAttribute('contenteditable')
        editSet.remove(el)
      },
      editQuit: function() {
        for (let el of editSet.entries()) {
          removeAttribute('contenteditable')
        }
        document.removeEventListener(this.selectionListener)
      }
    },
    keys: {
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
              icon: '#align-left',
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
              icon: '#align-left',
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
    start: function() {
        // Keep this experimental editor state separate from app.data for now.
        this.state = simply.state.signal(this.state),
        simply.bind({
          root: this.state
        })
        for (let component in this.components) {
          if (this.components[component].start) {
            this.components[component].start.apply(this)
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
