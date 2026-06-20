import { closest } from './suggest.mjs'
import path from './path.mjs'
const COMMAND_OPTIONS = [
    'commands',
    'handlers',
    'app',
    'container'
]

class SimplyCommands {
	constructor(options={}) {
		if (!options.app) {
			options.app = {}
		}
		if (!options.app.container) {
			options.app.container = document.body
		}
        this.app = options.app
		this.$handlers = options.handlers || defaultHandlers
        if (options.commands) {
    		Object.assign(this, options.commands)
        }

		const commandHandler = (evt) => {
			const command = getCommand(evt, this.$handlers, this.app)
			if (!command) {
				return
			}
			if (!this[command.name]) {
                warnUnknownCommand(this, command.name, command.source)
                return
			}
            const shouldContinue = this[command.name].call(options.app, command.source, command.value, evt)
            if (shouldContinue!==true) {
                evt.preventDefault()
                evt.stopPropagation()
                return false
            }
		}

        options.app.container.addEventListener('click', commandHandler)
        options.app.container.addEventListener('submit', commandHandler)
        options.app.container.addEventListener('change', commandHandler)
        options.app.container.addEventListener('input', commandHandler)
	}

    call(command, el, value, event) {
        if (!this[command]) {
            warnUnknownCommand(this, command, el)
            return
        }
        return this[command].call(this.app, el, value, event)
    }

    action(name) {
        console.warn('simplyflow/command: this.commands.action() is deprecated; use this.app.actions.<name>() instead')
        let params = Array.from(arguments).slice()
        params.shift()
        return this.app.actions[name](...params)
    }

    appendHandler(handler) {
        this.$handlers.push(handler)
    }

    prependHandler(handler) {
        this.$handlers.unshift(handler)
    }
}

export function commands(options={}) {
	return new SimplyCommands(options)
}

function getCommand(evt, handlers, app) {
    var el = evt.target.closest('[data-simply-command]')
    if (el) {
        for (let handler of handlers) {
            if (el.matches(handler.match)) {
                if (handler.check(el, evt)) {
                    return {
                        name:   el.dataset.simplyCommand,
                        source: el,
                        value:  handler.get(el, app)
                    }
                }
                return null
            }
        }
    }
    return null
}


function getConfiguredCommandValue(el, app)
{
    const pathAttribute = 'simplyValuePath'
    if (Object.hasOwn(el.dataset, pathAttribute)) {
        return {
            found: true,
            value: path.get(app?.data, el.dataset[pathAttribute])
        }
    }
    if (Object.hasOwn(el.dataset, 'simplyValue')) {
        return { found: true, value: el.dataset.simplyValue }
    }
    return { found: false, value: undefined }
}

const defaultHandlers = [
    {
        match: 'input,select,textarea',
        get: function(el, app) {
            const configuredValue = getConfiguredCommandValue(el, app)
            if (configuredValue.found) {
                return configuredValue.value
            }
            if (el.tagName==='SELECT' && el.multiple) {
                let values = []
                for (let option of el.options) {
                    if (option.selected) {
                        values.push(option.value)
                    }
                }
                return values
            }
            return el.value
        },
        check: function(el, evt) {
            return evt.type=='change' || (el.dataset.simplyImmediate && evt.type=='input')
        }
    },
    {
        match: 'a,button',
        get: function(el, app) {
            const configuredValue = getConfiguredCommandValue(el, app)
            if (configuredValue.found) {
                return configuredValue.value
            }
            return el.href || el.value
        },
        check: function(el,evt) {
            return evt.type=='click' && evt.ctrlKey==false && evt.button==0
        }
    },
    {
        match: 'form',
        get: function(el) {
            let data = {}
            for (let input of Array.from(el.elements)) {
                if (input.tagName=='INPUT' 
                    && (input.type=='checkbox' || input.type=='radio')
                ) {
                    if (!input.checked) {
                        return;
                    }
                }
                if (data[input.name] && !Array.isArray(data[input.name])) {
                    data[input.name] = [data[input.name]]
                }
                if (Array.isArray(data[input.name])) {
                    data[input.name].push(input.value)
                } else {
                    data[input.name] = input.value
                }
            }
            return data
        },
        check: function(el,evt) {
            return evt.type=='submit'
        }
    },
    {
    	match: '*',
        get: function(el, app) {
            return getConfiguredCommandValue(el, app).value
        },
        check: function(el, evt) {
            return evt.type=='click' && evt.ctrlKey==false && evt.button==0
        }
    }
]

const unknownCommandWarnings = new WeakMap()

function warnUnknownCommand(commands, command, source)
{
    let warned = unknownCommandWarnings.get(commands)
    if (!warned) {
        warned = new Set()
        unknownCommandWarnings.set(commands, warned)
    }
    if (warned.has(command)) {
        return
    }
    warned.add(command)

    const suggestion = closest(command, commandNames(commands))
    const suffix = suggestion ? `. Did you mean "${suggestion}"?` : ''
    if (source) {
        console.warn(`simplyflow/command: unknown command "${command}"${suffix}`, { cause: source })
    } else {
        console.warn(`simplyflow/command: unknown command "${command}"${suffix}`)
    }
}

function commandNames(commands)
{
    return Object.keys(commands).filter(command => {
        return !command.startsWith('$') &&
            !COMMAND_OPTIONS.includes(command) &&
            typeof commands[command] === 'function'
    })
}

