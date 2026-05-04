export class Helene
{

	constructor(options)
	{
		if (!options.textarea) {
			throw new Error('missing options.textarea')
		}
		this.textarea = simply.dom.signal(options.textarea)

		const decoration = `<div class="helene">
		<div class="helene-scroll">
			<div class="helene-gutter"></div>
			<textarea></textarea>
		</div>
		<div class="helene-status">
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
		this.scroll = this.editor.querySelector('.helene-scroll')
		this.scroll.replaceChild(options.textarea, this.scroll.querySelector('textarea'))
		this.gutter = this.editor.querySelector('.helene-gutter')
		this.status = this.editor.querySelector('.helene-status')
		this.state = simply.state.signal({
			options
		})
		this.addEffect(highlight(options)) // highlight makes the text visible and autogrows the editor
	}

	addEffect(fn, resultState) {
		const effect = fn.apply(this)
		if (effect) {
			if (typeof effect !== 'function') {
				throw new Error('helene: addEffect(callback): callback returned something other than a function')
			}
			const result = simply.state.effect(effect)
			if (resultState) {
				this.state[resultState] = result
			}
		}
	}
}

export default function helene(...options) {
	return new Helene(...options)
}

export function heleneForWeb(...options) {
	const editor = new Helene(...options)
	editor.addEffect(lines())
	editor.addEffect(warnings())
	editor.addEffect(cursor())
	switch(editor.state.options.language) {
		case 'javascript':
			editor.addEffect(parseJavascript())
		break;
		case 'html':
			editor.addEffect(parseHTML())
		break;
		case 'css':
			editor.addEffect(parseCSS())
		break;
	} 
	return editor
}

export function warnings(options) {
	return function() {
		this.warnings = document.createElement('div')
		this.warnings.classList.add('helene-warnings')
		this.gutter.appendChild(this.warnings)
		this.addWarning = (type, message, line, icon=null) => {
			const warning = document.createElement('span')
			warning.classList.add('helene-warning')
			warning.classList.add('helene-warning-'+type)
			warning.style=`--line: ${line}`
			warning.title = message
			if (!icon) {
				icon = '⚠'
			}
			warning.innerHTML = icon
			this.warnings.appendChild(warning)
		}
		this.clearWarnings = (type) => {
			if (!type) {
				this.warnings.innerHTML = ''
			} else {
				this.warnings.querySelectorAll('.helene-warning-'+type)?.forEach(w => w.remove())
			}
		}
	}
}

export function lines(options) {
	return function() {
		this.state.lines = simply.state.effect(() => {
			return this.textarea.value.split("\n")
		})
		this.lines = document.createElement('div')
		this.lines.classList.add('helene-lines')
		this.gutter.appendChild(this.lines)
		return () => {
			this.lines.innerHTML = Array.from(this.state.lines.current, (_, i) => i+1).join("\n")
		}
	}
}

export function selection(options) {
	return function() {
		this.state.selection = null
		this.textarea.addEventListener('selectionchange', (evt) => {
			this.state.selection = {
				start: this.textarea.selectionStart,
				end: this.textarea.selectionEnd,
				before: this.textarea.value.substring(0, this.textarea.selectionStart).split("\n"),
				after: this.textarea.value.substring(this.textarea.selectionEnd).split("\n")
			}
		})
		return () => {
			const lines = {
				start: this.state.selection?.before.length-1
			}
			lines.end = this.state.lines.length - this.state.selection?.after.length
			if (lines.start == lines.end) {
				this.state.block = null
			} else {
				this.state.block = lines
			}
		}
	}
}

export function cursor(options) {
	return function() {
		if (!this.state.selection) {
			this.addEffect(selection(options))
		}
		this.cursor = document.createElement('div')
		this.cursor.classList.add('helene-cursor')
		this.status.appendChild(this.cursor)
		this.state.cursor = {
		  line: 1,
		  column: 1
		}
		simply.state.effect(() => {
		  if (this.state.selection?.before) {
		    this.state.cursor = {
		      line: this.state.selection.before.length || 1,
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
		    this.cursor.innerHTML = lines + (this.state.selection.end - this.state.selection.start) + ' characters selected'
		  } else {
		    this.cursor.innerHTML = 'Line '+this.state.cursor.line+', column '+this.state.cursor.column
		  }
		})
	}
}

export function highlight(options) {
	return function() {
		this.highlight = document.createElement('pre')
		this.highlight.classList.add('helene-highlight')
		this.scroll.insertBefore(this.highlight, this.scroll.firstChild)
		if (options.language) {
			this.highlight.classList.add(`language-${options.language}`)
		} else {
			console.log('helene: no options.language set, syntax highlighting is disabled')
		}
		return () => {
			let content = this.textarea.value
			if (globalThis.Prism && options.language) {
				content = Prism.highlight(content, Prism.languages[options.language], options.language)
			}
			this.highlight.innerHTML = content
		}
	}
}

export function parseJavascript(options={}) {
	// will be called on helene instance, so short arrow syntax will bind this correctly
	options = Object.assign({
		validate: true
	}, options)
	return function() {
		return () => {
			if (this.warnings && options.validate) {
				this.clearWarnings('javascript')
			} else if (options.validate) {
				console.log('helene: warnings effect not loaded, so parseJavascript cannot show parse errors')
			}
			if (globalThis.acorn) {
				try {
					this.state.parsedJavascript = acorn.parse(this.textarea.value)
				} catch(err) {
					if (this.warnings && options.validate) {
						this.addWarning('javascript', err.message, err.loc.line)
					}
				}
			} else {
				try {
					eval(this.textarea.value) // new Function is unreliable
				} catch(err) {
					if (this.warnings && options.validate) {
						this.addWarning('javascript', err.message, err.lineNumber)
					}
				}
			}
		}
	}
}

function domWalk(htmlStr, callback) {
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

export function parseHTML(options={}) {
	options = Object.assign({
		validate: true
	}, options)
	return function() {
		return () => {
			if (this.warnings && options.validate) {
				this.clearWarnings('html')
			}
			const fragment = globalThis.document.createRange().createContextualFragment(this.textarea.value)
			this.parsedHTML = document.createElement('div')
			this.parsedHTML.appendChild(fragment)
			if (this.warnings && options.validate) {
				const constructedLines = this.parsedHTML.innerHTML.split("\n")
				let count = 0
				for (const line of constructedLines) {
					if (line != this.state.lines.current[count]) {
						if (!this.state.lines.current[count].match(/\<script\b/i)) {
							this.addWarning('html', 'Invalid HTML', count+1)
							return
						}
					}
					count++
				}
				// now check for script tags
				domWalk(this.textarea.value, (el, lineNumber) => {
					if (el.tagName==='SCRIPT' && !el.src && (!el.type || el.type=='javascript') && el.innerText) {
						this.clearWarnings('javascript'+lineNumber)
						if (globalThis.acorn) {
							try {
								acorn.parse(el.innerText)
							} catch(err) {
								if (this.warnings && options.validate) {
									this.addWarning('javascript'+lineNumber, err.message, lineNumber + err.loc.line)
								}
							}
						} else {
							try {
								eval(el.innerText) // new Function is unreliable
							} catch(err) {
								if (this.warnings && options.validate) {
									this.addWarning('javascript'+lineNumber, err.message, lineNumber + err.lineNumber)
								}
							}
						}
					}
				})
			} else if (options.validate) {
				console.log('helene: warnings effect not loaded, so parseHTML cannot show parse errors')
			}
		}
	}
}

export function parseCSS(options={}) {
	options = Object.assign({
		validate: true
	}, options)
	return function() {
		return () => {
			if (this.warnings && options.validate) {
				this.clearWarnings('css')
			} else if (options.validate) {
				console.log('helene: warnings effect not loaded, so parseCSS cannot show parse errors')
			}
			const css = this.textarea.value
			// do something
		}
	}
}