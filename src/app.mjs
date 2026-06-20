import { bind } from './bind.mjs'
import { signal } from './state.mjs'
import { routes } from './route.mjs'
import { commands } from './command.mjs'
import { actions } from './action.mjs'
import { shortcuts, accesskeys } from './shortcut.mjs'
import { html, css } from './highlight.mjs'
import { findAttribute } from './dom.mjs'
import { closest } from './suggest.mjs'

const APP_OPTIONS = [
    'container',
    'data',
    'templates',
    'styles',
    'start',
    'onError',
    'components',
    'baseURL',
    'root',
    'commands',
    'shortcuts',
    'routes',
    'actions'
]

class SimplyApp
{
    constructor(options={})
    {
        if (options.components) {
            const mergedOptions = {}
            mergeComponents(mergedOptions, options.components)
            mergeOptions(mergedOptions, options) // app options override component options
            options = mergedOptions
        }


        this.container = options.container || document.body
        this.data = signal(options.data || {})
        this.start = options.start
        this.onError = options.onError
        this.components = options.components
        this.baseURL = options.baseURL || options.root

        installTemplates(this.container, options.templates)
        installStyles(this.container, options.styles)

        for (const key of Object.keys(options)) {
            switch(key) {
                case 'container':
                case 'data':
                case 'templates':
                case 'styles':
                case 'start':
                case 'onError':
                case 'components':
                case 'baseURL':
                    break
                case 'commands':
                    this.commands = commands({ app: this, container: this.container, commands: options.commands})
                    break
                case 'shortcuts':
                    this.shortcuts = shortcuts({ app: this, shortcuts: options.shortcuts })
                    break
                case 'routes':
                    this.routes = routes({ app: this, routes: options.routes})
                    break
                case 'actions':
                    this.actions = actions({app: this, actions: options.actions})
                    this.action = function(name) { // backwards compatible with SimplyView2
                        console.warn('simplyflow/app: this.action() is deprecated; use this.actions.<name>() instead')
                        const params = Array.from(arguments).slice()
                        params.shift()
                        return this.actions[name](...params)
                    }
                    break
                case 'prototype':
                case '__proto__':
                    // ignore this to avoid prototype pollution
                    break
                default:
                    // Unknown options become app properties. Warn only when the
                    // name is close to a built-in option, which usually means a typo.
                    warnLikelyOptionTypo(key)
                    this[key] = options[key]
                    break
            }
        }

        this.binding = bind({
            root: this.data,
            container: this.container,
            attribute: 'data-simply'
        })

        accesskeys({ app: this })
    }

    get app()
    {
        return this
    }

    findAttribute(...params) {
        return findAttribute.apply(this, params)
    }

    destroy()
    {
        if (this.binding) {
            this.binding.destroy()
            this.binding = undefined
        }
    }
}

function installTemplates(container, templates)
{
    if (!templates) {
        return
    }
    for (const name of Object.keys(templates)) {
        const element = document.createElement('div')
        element.innerHTML = templates[name]
        let template = container.querySelector('template#'+name)
        if (!template) {
            template = document.createElement('template')
            template.id = name
            template.content.append(...element.children)
            container.appendChild(template)
        } else {
            template.content.replaceChildren(...element.children)
        }
    }
}

function installStyles(container, styles)
{
    if (!styles) {
        return
    }
    for (const name of Object.keys(styles)) {
        let style = container.querySelector('style#'+name+'.css')
        if (!style) {
            style = document.createElement('style')
            style.id = name+'.css'
            container.appendChild(style)
        }
        style.innerHTML = styles[name]
    }
}


function warnLikelyOptionTypo(key)
{
    const suggestion = closest(key, APP_OPTIONS)
    if (suggestion) {
        console.warn(`simplyflow/app: unknown option "${key}". Did you mean "${suggestion}"? The option was still added to the app as "app.${key}".`)
    }
}

function initRoutes(app) {
    if (app.routes) {
        if (app.baseURL) {
            app.routes.init({ baseURL: app.baseURL })
        }
        app.routes.handleEvents()
        globalThis.setTimeout(() => {
            if (app.routes.has(globalThis.location?.hash)) {
                app.routes.match(globalThis.location.hash)
            } else {
                app.routes.match(globalThis.location?.pathname+globalThis.location?.hash)
            }
        })
    }
}


function handleAppError(app, error, context)
{
    if (app.onError) {
        return app.onError.call(app, error, context)
    }
    throw error
}

export function app(options={})
{
    const app = new SimplyApp(options)
    if (!app.start) {
        initRoutes(app)
        return app
    }

    try {
        const result = app.start.call(app)
        if (result instanceof Promise) {
            result.then(() => initRoutes(app)).catch(error => handleAppError(app, error, app.start))
        } else {
            initRoutes(app)
        }
    } catch (error) {
        handleAppError(app, error, app.start)
    }
    return app
}

if (!globalThis.html) {
    globalThis.html = html
}
if (!globalThis.css) {
    globalThis.css = css
}

function mergeOptions(options, otherOptions)
{
    for (const key of Object.keys(otherOptions)) {
        switch(typeof otherOptions[key]) {
            case 'object':
                if (!otherOptions[key]) {
                    continue // null
                }
                if (!options[key]) {
                    options[key] = otherOptions[key]
                } else {
                    mergeOptions(options[key], otherOptions[key])
                }
                break
            default:
                options[key] = otherOptions[key]
        }
    }
}

function mergeComponents(options, components) {
    for (const name of Object.keys(components)) {
        const component = components[name]
        if (component.components) {
            mergeComponents(options, component.components)
        }
        if (!options.components) {
            options.components = {}
        }
        options.components[name] = component
        for (const key of Object.keys(component)) {
            switch(key) {
                case 'start':
                case 'onError':
                    // App lifecycle functions are app-level behavior, not merged component state.
                case 'components':
                    // already handled
                    break
                default:
                    if (!options[key]) {
                        options[key] = Object.create(null)
                    }
                    mergeOptions(options[key], component[key])
                    break
            }
        }
    }
}
