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
	this.state.selection = null
	this.textarea.addEventListener('selectionchange', (evt) => {
		this.state.selection = {
			start: this.textarea.selectionStart,
			end: this.textarea.selectionEnd,
			before: this.textarea.value.substring(0, this.textarea.selectionStart).split("\n"),
			after: this.textarea.value.substring(this.textarea.selectionEnd).split("\n")
		}
	})
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

export function parseJavascript(options) {
	// will be called on helene instance, so short arrow syntax will bind this correctly
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

export function parseHTML(options) {
	return function() {
		return () => {
			if (this.warnings && options.validate) {
				this.clearWarnings('html')
			}
			const parser = new DOMParser()
			//TODO: support full html as an option
			this.parsedHTML = parser.parseFromString(this.textarea.value, 'text/html')?.body
			if (this.warnings && options.validate) {
				const constructedLines = this.parsedHTML.innerHTML.split("\n")
				let count = 0
				for (const line of constructedLines) {
					if (line != this.state.lines.current[count]) {
						this.addWarning('html', 'Invalid HTML', count+1)
						return
					}
					count++
				}
			} else if (options.validate) {
				console.log('helene: warnings effect not loaded, so parseHTML cannot show parse errors')
			}
		}
	}
}

export function parseCSS(options) {
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