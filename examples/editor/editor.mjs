export class Helene
{

	constructor(options)
	{
		if (!options.textarea) {
			throw new Error('missing options.textarea')
		}
		if (!options.language) {
			options.language = 'javascript'
		}
		if (!options.theme) {
			options.theme = 'prism-cb.css'
		}
		const ta = simply.dom.signal(options.textarea)

		const decoration = `<div class="helene" data-code-lang="${options.language}">
		<div class="helene-scroll">
			<div class="helene-gutter"></div>
			<div class="helene-warnings"></div>
			<pre class="helene-highlight language-${options.language}"></pre>
			<textarea></textarea>
		</div>
		<div class="helene-status">
			<div class="helene-selection"></div>
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
		this.textarea = ta

		this.state = simply.state.signal({
			options
		})

		this.state.lines = simply.state.effect(() => {
			return this.textarea.value.split("\n")
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

		this.gutter = this.editor.querySelector('.helene-gutter')
		if (this.gutter) {
			simply.state.effect(() => {
				this.gutter.innerHTML = Array.from(this.state.lines.current, (_, i) => i+1).join("\n")
			})
		}

		this.highlight = this.editor.querySelector('.helene-highlight')
		simply.state.effect(() => {
			let content = this.textarea.value
			if (globalThis.Prism) {
				content = Prism.highlight(content, Prism.languages[this.state.options.language], this.state.options.language)
			}
			this.highlight.innerHTML = content
		})

		this.warnings = this.editor.querySelector('.helene-warnings')
	}

	addEffect(fn, resultState) {
		const result = simply.state.effect(fn.apply(this))
		if (resultState) {
			this.state[resultState] = result
		}
	}

	addWarning(type, message, line, icon=null) {
		const warning = document.createElement('span')
		warning.classList.add('helene-warning')
		warning.classList.add('helene-warning-'+type)
		warning.style='--line: ${line}'
		warning.title = message
		if (!icon) {
			icon = '⚠'
		}
		warning.innerHTML = icon
		this.warnings.appendChild(warning)
	}

	clearWarnings(type) {
		if (!type) {
			this.warnings.innerHTML = ''
		} else {
			this.warnings.querySelectorAll('.helene-warning-'+type)?.forEach(w => w.remove())
		}
	}
}

export default function helene(...options) {
	return new Helene(...options)
}

export function parseJavascript() {
	// will be called on helene instance, so short arrow syntax will bind this correctly
	return () => {
		this.clearWarnings('javascript')
		if (globalThis.acorn) {
			try {
				this.state.parsedJavascript = acorn.parse(this.textarea.value)
			} catch(err) {
				this.addWarning('javascript', err.message, err.loc.line)
			}
		} else {
			try {
				eval(this.textarea.value) // new Function is unreliable
			} catch(err) {
				this.addWarning('javascript', err.message, err.lineNumber)
			}
		}
	}
}