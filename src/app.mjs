import { bind } from './bind.mjs'
import { signal } from './state.mjs'
import { routes } from './route.mjs'
import { commands } from './command.mjs'
import { actions } from './action.mjs'
import { keys, accesskeys } from './key.mjs'
import { html, css } from './highlight.mjs'
import { findAttribute } from './dom.mjs'

const APP_OPTIONS = [
    'container',
    'data',
    'html',
    'css',
    'hooks',
    'components',
    'baseURL',
    'root',
    'commands',
    'keys',
    'keyboard',
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
        this.hooks = options.hooks
        this.components = options.components
        this.baseURL = options.baseURL || options.root

        installHtml(this.container, options.html)
        installCss(this.container, options.css)

        for (const key of Object.keys(options)) {
            switch(key) {
                case 'container':
                case 'data':
                case 'html':
                case 'css':
                case 'hooks':
                case 'components':
                case 'baseURL':
                case 'root':
                case 'bind':
                    // Historical experimental app option. App-level binding is
                    // no longer configurable; use lower-level bind() directly.
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

function installHtml(container, templates)
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

function installCss(container, styles)
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
    const suggestion = closestAppOption(key)
    if (suggestion) {
        console.warn(`simplyflow/app: unknown option "${key}". Did you mean "${suggestion}"? The option was still added to the app as "app.${key}".`)
    }
}

function closestAppOption(key)
{
    // Short custom names like `api` or `db` are common extension points and
    // too short for useful typo detection.
    if (key.length < 4) {
        return
    }

    let closest
    let closestDistance = Infinity
    for (const option of APP_OPTIONS) {
        const distance = editDistance(key, option)
        if (distance < closestDistance) {
            closest = option
            closestDistance = distance
        }
    }
    return closestDistance <= 2 ? closest : undefined
}

function editDistance(a, b)
{
    if (Math.abs(a.length - b.length) > 2) {
        return 3
    }

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
    const current = new Array(b.length + 1)

    for (let ai = 1; ai <= a.length; ai++) {
        current[0] = ai
        for (let bi = 1; bi <= b.length; bi++) {
            const cost = a[ai - 1] === b[bi - 1] ? 0 : 1
            current[bi] = Math.min(
                previous[bi] + 1,
                current[bi - 1] + 1,
                previous[bi - 1] + cost
            )
        }
        previous.splice(0, previous.length, ...current)
    }

    return previous[b.length]
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
