import { bind } from './bind.mjs'
import { signal } from './state.mjs'
import { routes } from './route.mjs'
import { commands } from './command.mjs'
import { actions } from './action.mjs'
import { keys, accesskeys } from './key.mjs'
import { html, css } from './highlight.mjs'
import { findAttribute } from './dom.mjs'

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
        this.hooks = options.hooks
        this.components = options.components
        this.baseURL = options.baseURL || options.root

        installHtml(this.container, options.html)
        installCss(this.container, options.css)

        for (const key of Object.keys(options)) {
            switch(key) {
                case 'container':
                case 'data':
                case 'bind':
                case 'html':
                case 'css':
                case 'hooks':
                case 'components':
                case 'baseURL':
                case 'root':
                    break
                case 'commands':
                    this.commands = commands({ app: this, container: this.container, commands: options.commands})
                    break
                case 'keys':
                    this.keys = keys({ app: this, keys: options.keys })
                    break
                case 'keyboard': // backwards compatible with older SimplyView keyboard option
                    this.keys = keys({ app: this, keys: options.keyboard })
                    break
                case 'routes':
                    this.routes = routes({ app: this, routes: options.routes})
                    break
                case 'actions':
                    this.actions = actions({app: this, actions: options.actions})
                    this.action = function(name) { // backwards compatible with SimplyView2
                        console.warn('deprecated call to `this.action`')
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
                    console.log('simply.app: unknown initialization option "'+key+'", added as-is')
                    this[key] = options[key]
                    break
            }
        }

        if (options.bind !== false) {
            const bindOptions = typeof options.bind === 'object' ? options.bind : {}
            this.binding = bind(Object.assign({
                root: this.data,
                container: this.container,
                attribute: 'data-simply',
                twoway: true
            }, bindOptions, {
                root: this.data,
                container: this.container
            }))
        }

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

function installHtml(container, templates)
{
    if (!templates) {
        return
    }
    for (const name in templates) {
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

function installCss(container, styles)
{
    if (!styles) {
        return
    }
    for (const name in styles) {
        let style = container.querySelector('style#'+name+'.css')
        if (!style) {
            style = document.createElement('style')
            style.id = name+'.css'
            container.appendChild(style)
        }
        style.innerHTML = styles[name]
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

export function app(options={})
{
    const app = new SimplyApp(options)
    if (app.hooks?.start) {
        const promise = app.hooks.start.call(app)
        if (promise instanceof Promise) {
            promise.then(() => initRoutes(app))
        } else {
            initRoutes(app)
        }
    } else {
        initRoutes(app)
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
                case 'hooks':
                    // don't merge these; app.hooks.start controls startup for now
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
