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

export default {
	html: {
		anchor: html`<div class="anchor"></div>`
	},
	css: {
		anchor: css`
.anchor {
	anchor-name: --cursor-anchor;
	position: absolute;
	z-index: 10000;
	width: 10px;
	height: 10px;
	transform: rotate(45deg);
	transform-origin: top left;
	background: red;
	display: none;
}`
	},
	actions: {
		anchorPosition: function(position) {
			this.state.anchor.position = position
		},
		anchorShow: function() {
			this.state.anchor.visible = true
		},
		anchorHide: function() {
			this.state.anchor.visible = false
		}
	},
	hooks: {
		start: function() {
			this.container.insertAdjacentHTML('beforeend','<simply-render rel="anchor"></simply-render>')
			this.state.anchor = {
				element: this.container.querySelector('.anchor'),
				offset: this.container.getBoundingClientRect(),
				visible: false,
				position: {
					x: 0,
					y: 0
				}
			}
			setTimeout(() => {
				this.state.anchor.element = this.container.querySelector('.anchor')
				this.state.anchor.offset = this.container.getBoundingClientRect()
			},100)
 	        this.selectionListener = document.addEventListener('selectionchange', () => {
				const selection = window.getSelection()
				if (!selection.rangeCount || selection.isCollapsed) {
					this.state.anchor.visible = false
					return
				}
				if (!this.container.contains(selection.anchorNode)) {
					this.state.anchor.visible = false
					return
				}
				this.state.anchor.visible = true
				const position = getCursorPosition(this.container)
				this.state.anchor.position = position
	        })
			simply.state.effect(() => {
				const pos = this.state.anchor.position
				const offset = this.state.anchor.offset
				console.log('anchor position', pos, offset)
				simply.state.batch(() => {
					this.state.anchor.element.style.top = (pos.y + pos.height + offset.top) + 'px'
					this.state.anchor.element.style.left = (pos.x + offset.left) + 'px'
				})
			})
			simply.state.effect(() => {
				const visible = this.state.anchor.visible
				console.log('anchor visible ', visible)
				if (visible) {
					this.state.anchor.element.style.display = 'block'
				} else {
					this.state.anchor.element.style.display = 'none'
				}
			})

		}
	}
}