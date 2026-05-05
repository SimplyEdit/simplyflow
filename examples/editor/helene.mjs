export class Helene
{
	constructor(options)
	{
		if (!options.textarea) {
			throw new Error('Helene: missing options.textarea')
		}
		if (!globalThis.simply?.state) {
			throw new Error('Helene: missing simply.state library')
		}
		this.textarea = simply.dom.signal(options.textarea)

		const decoration = `<div class="helene">
		<div class="helene-scroll">
			<div class="helene-gutter">
				<div class="helene-warnings"></div>
				<div class="helene-lines"></div>
			</div>
			<div class="helene-pane">
				<pre class="helene-highlight"></pre>
				<textarea></textarea>
			</div>
		</div>
		<div class="helene-status">
			<div class="helene-cursor"></div>
		</div>
	</div>`

        const fragment = globalThis.document.createRange().createContextualFragment(decoration)
		this.editor = fragment.firstChild
		options.textarea.classList.forEach((c) => {
			this.editor.classList.add(c)
		})
		for (const d in options.textarea.dataset) {
			this.editor.dataset[d] = options.textarea.dataset[d]
		}
		options.textarea.classList.add('helene-content')
		options.textarea.parentElement.insertBefore(this.editor, options.textarea)
		this.el = {
			scroll:    this.editor.querySelector('.helene-scroll'),
			viewpane:  this.editor.querySelector('.helene-pane'),
			gutter:    this.editor.querySelector('.helene-gutter'),
			status:    this.editor.querySelector('.helene-status'),
			highlight: this.editor.querySelector('.helene-highlight'),
			warnings:  this.editor.querySelector('.helene-warnings'),
			lines:     this.editor.querySelector('.helene-lines'),
			cursor:    this.editor.querySelector('.helene-cursor')
		}
		this.el.viewpane.replaceChild(options.textarea, this.editor.querySelector('textarea'))
		this.state = simply.state.signal({
			options
		})
		simply.state.effect(() => {
			let content = this.textarea.value
			if (this.languageModule?.highlight) {
				content = this.languageModule.highlight.call(this, content)
			} else {
				content = escapeHTML(content)
			}
			this.el.highlight.innerHTML = content
			this.state.lines = content.split("\n")
			this.el.lines.innerHTML = Array.from(this.state.lines, (_, i) => i+1).join("\n")
		})

		this.state.selection = null
		this.textarea.addEventListener('selectionchange', (evt) => {
			this.state.selection = {
				start: this.textarea.selectionStart,
				end: this.textarea.selectionEnd,
				before: this.textarea.value.substring(0, this.textarea.selectionStart).split("\n"),
				after: this.textarea.value.substring(this.textarea.selectionEnd).split("\n")
			}
		})
		simply.state.effect(() => {
			const lines = {
				start: this.state.selection?.before.length-1
			}
			lines.end = this.state.lines.length - this.state.selection?.after.length
			if (lines.start == lines.end) {
				this.state.block = null
			} else {
				this.state.block = lines
			}
		})

		this.state.cursor = {
		  line: 1,
		  column: 1
		}
		simply.state.effect(() => {
		  if (this.state.selection?.before) {
		    this.state.cursor = {
		      line: this.state.selection.before.length ?? 1,
		      column: this.state.selection.before[this.state.selection.before.length-1]?.length+1
		    }
		  }
		})
		simply.state.effect(() => {
		  if (this.state.selection?.start!=this.state.selection?.end) {
		    let lines = ''
		    if (this.state.block) {
		      lines = this.state.block.end - this.state.block.start + 1
		      if (lines===1) {
		        lines += ' line, '
		      } else {
		        lines += ' lines, '
		      }
		    }
		    this.el.cursor.innerHTML = lines + (this.state.selection.end - this.state.selection.start) + ' characters selected'
		  } else {
		    this.el.cursor.innerHTML = 'Line '+this.state.cursor.line+', column '+this.state.cursor.column
		  }
		})

		this.keyboard = keyboard
		this.textarea.helene = this
		this.textarea.addEventListener('keydown', function(evt) {
			const key = getKeyString(evt)
			if (this.helene.keyboard[key]) {
				this.helene.keyboard[key].call(this.helene, evt)
			}
		})

	}

	addWarning(type, message, line, icon=null)
	{
		const warning = document.createElement('span')
		warning.classList.add('helene-warning')
		warning.classList.add('helene-warning-'+type)
		warning.style=`--line: ${line}`
		warning.title = message
		if (!icon) {
			icon = '⚠'
		}
		warning.innerHTML = icon
		this.el.warnings.appendChild(warning)
	}
	
	clearWarnings(type)
	{
		if (!type) {
			this.el.warnings.innerHTML = ''
		} else {
			this.el.warnings.querySelectorAll('.helene-warning-'+type)?.forEach(w => w.remove())
		}
	}

}

const KEY = Object.freeze({
	Compose: 229,
	Control: 17,
	Meta:    224,
	Alt:     18,
	Shift:   16
})

function getKeyString(e)
{
	if (e.isComposing || e.keyCode === KEY.Compose) {
	    return
	}
	if (e.defaultPrevented) {
	    return
	}
	if (!e.target) {
	    return
	}
	let keyCombination = []
	if (e.ctrlKey && e.keyCode!=KEY.Control) {
	    keyCombination.push('control')
	}
	if (e.metaKey && e.keyCode!=KEY.Meta) {
	    keyCombination.push('meta')
	}
	if (e.altKey && e.keyCode!=KEY.Alt) {
	    keyCombination.push('alt')
	}
	if (e.shiftKey && e.keyCode!=KEY.Shift) {
	    keyCombination.push('shift')
	}
	keyCombination.push(e.key.toLowerCase())
	return keyCombination.join('-')
}

export default function helene(options)
{
	return new Helene(options)
}

export function domWalk(htmlStr, callback)
{
    const dom = globalThis.document.createRange().createContextualFragment(htmlStr)
	const lines = htmlStr.split("\n")
	let lineNumber = 0
	const tagRE = /^[a-zA-Z][a-zA-Z\-]*/
	const tagStack = lines.map(l => l.split('<').map(s => tagRE.exec(s)?.[0]).filter(Boolean))
	let alltags = []
	for (let line=0; line<tagStack.length; line++) {
		for (const tag of tagStack[line]) {
			alltags.push({tag, line})
		}
	}
	const findTag = function(tag) {
		while (alltags.length && alltags[0]?.tag.toUpperCase()!==tag) {
			alltags = alltags.slice(1)
		}
		if (alltags[0]?.tag) {
			const line = alltags[0].line
			alltags = alltags.slice(1)
			return line
		}
	}
	const innerWalk = function(el) {
		lineNumber = findTag(el.tagName)
		callback(el, lineNumber)
		if (el.childElements) {
			for (const child of el.childElements) {
				innerWalk(child)
			}
		}
	}
	for (const child of dom.children) {
		innerWalk(child)
	}
}

function escapeHTML(str)
{
	return str.replace(/\</g, '&lt;')
}

export const html = {
	highlight: function(content) {
		if (globalThis.Prism) {
			content = Prism.highlight(content, Prism.languages.html, 'html')
		}
		return content
	},
	parse: function(content, options) {
		options = {
			lineNumber: 0,
			...options
		}
		const fragment = globalThis.document.createRange().createContextualFragment(content)
		this.parsedHTML = document.createElement('div')
		this.parsedHTML.appendChild(fragment)
		if (options.validate) {
			const constructedLines = this.parsedHTML.innerHTML.split("\n")
			let count = 0
			for (const line of constructedLines) {
				if (line != this.state.lines.current[count]) {
					if (!this.state.lines.current[count].match(/\<script\b/i)) {
						this.addWarning('html', 'Invalid HTML', lineNumber + count+1)
						return
					}
				}
				count++
			}
			// now check for script tags
			domWalk(this.textarea.value, (el, lineNumber) => {
				if (el.tagName==='SCRIPT' && !el.src && (!el.type || el.type=='javascript') && el.innerText) {
					javascript.parse(el.innerText, {
						lineNumber: lineNumber + options.lineNumber,
						...options
					})
				} else if (el.tagName==='STYLE') {
					// css.parse....
				}
			})
		}

	}
}

export const javascript = {
	highlight: function(content) {
		if (globalThis.Prism) {
			content = Prism.highlight(content, Prism.languages.javascript, 'javascript')
		}
		return content
	},
	parse: function(content, options) {
		options = {
			lineNumber: 0,
			...options
		}
		if (options.validate) {
			this.clearWarnings('html')
		}
		if (globalThis.acorn) {
			try {
				this.state.parsedJavascript = acorn.parse(content)
			} catch(err) {
				if (options.validate) {
					this.addWarning('javascript', err.message, options.lineNumber + err.loc.line)
				}
			}
		} else {
			try {
				eval(content) // new Function is unreliable
			} catch(err) {
				if (options.validate) {
					this.addWarning('javascript', err.message, options.lineNumber + err.lineNumber)
				}
			}
		}
	}
}

export const css = {
	highlight: function(content) {
		if (globalThis.Prism) {
			content = Prism.highlight(content, Prism.languages.css, 'css')
		}
		return content
	}	
}

export const keyboard = {
	'tab': (evt) => {
		if (this.state.block) {
			blockChange(this.textarea, this.state.block.start, this.state.block.end, indentCode)
			fireInput(evt)
		} else {
			insertTab(this.textarea, this.textarea.selectionStart, this.textarea.selectionEnd)
			fireInput(evt)
		}
	},
	'shift-tab': (evt) => {
		if (this.state.block) {
			blockChange(this.textarea, this.state.block.start, this.state.block.end, outdentCode)
			fireInput(evt)
		}
	},
	'control-/': (evt) => {
		blockChange(this.textarea, this.state.block.start, this.state.block.end, toggleBlockComments)
		fireInput(evt)
	}
}

export function fireInput(evt) {
  evt.preventDefault()
  evt.target.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertTab(textarea, start, end) {
  textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end)
  textarea.selectionStart = start + 1
  textarea.selectionEnd = textarea.selectionStart
}

export function blockChange(textarea, start, end, fn) {
  const block = state.lines.slice(start, end)
  let outblock, outcount;
  [ outblock, outcount ] = fn(block)
  const selection = { start: state.selection.start, end: state.selection.end}
  textarea.value = state.lines.slice(0, start).concat(outblock).concat(state.lines.slice(end)).join("\n")
  textarea.selectionStart = selection.start
  textarea.selectionEnd = selection.end + outcount
}

export function indentCode(block) {
  let count = 0
  const indented = block.map(line => {
    count++ //inserted characters
    return "\t"+line
  })
  return [ indented, count ]
}

export function outdentCode(block) {
  let count = 0
  const outdented = block.map(line => {
    if (line[0]==="\t") {
      count-- //removed characters
      return line.substring(1)
    }
    return line
  })
  return [ outdented, count ]
}
