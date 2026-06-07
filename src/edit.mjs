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
    hooks: {
      start: function() {
        // make sure this.state is a signal before calling start hooks of components
        // and simply.bind - move to default start() hook in app.mjs (when simplyflow is in simplyview)
        this.state = simply.state.signal({}),
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