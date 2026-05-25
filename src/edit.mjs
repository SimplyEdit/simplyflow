/**
 * This function returns the cursor position and height, if the cursor is in
 * the given element. The x and y position are calculated relative to the top
 * left of the given element. This function does not alter the DOM in any way.
 */
function getCursorPosition(element) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;

  const range = document.createRange();
  range.setStart(selection.focusNode, selection.focusOffset);
  range.collapse(true);

  // Try getClientRects() first — often non-empty even on empty lines
  const elementRect = element.getBoundingClientRect();

  const cursorNode = selection.focusNode;
  const cursorElement = cursorNode.nodeType === Node.TEXT_NODE
    ? cursorNode.parentElement
    : cursorNode;

  let x,y,height;
  const rects = range.getClientRects();
  if (rects.length > 0) {
  	x = rects[0].left - elementRect.left
  	y = rects[0].top - elementRect.top
    height = rects[0].height
  } else {
	  // Fallback for truly empty element: use padding from CSS
    const style = window.getComputedStyle(cursorElement);
    const lineHeight = parseFloat(style.lineHeight);
    height = isNaN(lineHeight) ? parseFloat(style.fontSize) : lineHeight
    const cursorElementRect = cursorElement.getBoundingClientRect();
  	x = cursorElementRect.left - elementRect.left + parseFloat(style.paddingLeft)
    y = cursorElementRect.top  - elementRect.top  + parseFloat(style.paddingTop)
  }
  return {
  	x,
  	y,
  	height,
  	element: cursorElement
  }
}

export function edit(element)
{
  return simply.app({
    container: element,
    actions: {
      showToolbar: function(position) {
        const containerRect = this.container.getBoundingClientRect()
        this.toolbar.style.top = containerRect.top + position.y + position.height + 'px'
        this.toolbar.style.left = containerRect.left + position.x + 'px'
        this.toolbar.style.display = 'block'
      },
      hideToolbar: function() {
        this.toolbar.style.display = 'none'
      },
      close: function() {
        this.container.removeAttribute('contenteditable')
        document.removeEventListener(this.selectionListener)
      }
    },
    keyboard: {
      default: {
        'Control+ ': function() {
          if (this.toolbar.style.display == 'none') {
            const position = getCursorPosition(this.container)
            this.actions.showToolbar(position)
          } else {
            this.actions.hideToolbar()
          }
        }
      }
    },
    hooks: {
      start: function() {
        this.container.setAttribute('contenteditable', true)
        this.toolbar = document.querySelector('simply-edit-focus-toolbar')
        if (!this.toolbar) {
          this.toolbar = document.createElement('div')
          this.toolbar.id = 'simply-edit-focus-toolbar'
          this.toolbar.style.position ='absolute'
          this.toolbar.style['z-index'] = 10000
          this.toolbar.style.border = '1px solid blue'
          this.toolbar.innerHTML = 'toolbar'
          document.body.appendChild(this.toolbar)
        }
        this.selectionListener = document.addEventListener('selectionchange', () => {
          console.log('selectionchange')
          const selection = window.getSelection()
          if (!selection.rangeCount || selection.isCollapsed) {
            this.actions.hideToolbar()
            console.log('no selection')
            return
          }
          if (!this.container.contains(selection.anchorNode)) {
            console.log('selection outside container')
            return
          }
          const position = getCursorPosition(this.container)
          console.log('position',position)
          this.actions.showToolbar(position)
        })
      }
    }
  })
}