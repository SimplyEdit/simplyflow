import { throttledEffect, destroy } from './state.mjs'
import { escape_html, fixed_content } from './bind.transformers.mjs'
import * as render from './bind.render.mjs'

if (!Symbol.bindTemplate) {
    Symbol.bindTemplate = Symbol('bindTemplate')
}

/**
 * Implements one way databinding, updating dom elements with matching attributes
 * to changes in signals (see state.mjs)
 * 
 * @class
 */
class SimplyBind
{
    
    /**
     * @param Object options - a set of options for this instance, options may include:
     *  - root (signal) (required) - the root data object that contains al signals that can be bound
     *  - container (HTMLElement) - the dom element to use as the root for all bindings
     *  - attribute (string) - the prefix for the field, list and map attributes, e.g. 'data-bind'
     *  - transformers (object name:function) - a map of transformer names and functions
     *  - render (object with field, list and map properties)
     */
    constructor(options)
    {
        /**
         * A map of HTMLElements and the data bindings on each, in the form of 
         * the connectedSignal returned by the (throttled)Effect.
         * @type {Map}
         * @public
         */
        this.bindings = new Map()

        const defaultTransformers = {
                escape_html,
                fixed_content
        }
        const defaultOptions = {
            container: document.body,
            attribute: 'data-flow',
            transformers: defaultTransformers,
            render: {
                field: [render.field],
                list: [render.list],
                map: [render.map]
            },
            renderers: {
                'INPUT':render.input,
                'BUTTON':render.button,
                'SELECT':render.select,
                'A':render.anchor,
                'IMG':render.image,
                'IFRAME':render.iframe,
                'META':render.meta,
                'TEMPLATE':null,
                '*':render.element
            }
        }
        if (!options?.root) {
            throw new Error('bind needs at least options.root set')
        }
        this.options = Object.assign({}, defaultOptions, options)
        if (options.transformers) {
            this.options.transformers = Object.assign({}, defaultTransformers, options?.transformers)
        }
        const attribute      = this.options.attribute
        const bindAttributes = [attribute+'-field',attribute+'-list',attribute+'-map']
        const transformAttribute = attribute+'-transform'

        const getBindingAttribute = (el) => {
            const foundAttribute = bindAttributes.find(attr => el.hasAttribute(attr))
            if (!foundAttribute) {
                console.error('No matching attribute found',el,bindAttributes)
            }
            return foundAttribute
        }

        // sets up the effect that updates the element if its
        // data binding value changes
        const renderElement = (el) => {
            this.bindings.set(el, throttledEffect(() => {
                if (!el.isConnected) {
                    // el is no longer part of this document
                    untrack(el, this.getBindingPath(el))
                    destroy(this.bindings.get(el))
                    // doing this here instead of in a mutationobserver
                    // allows an element to be temporary removed and then inserted
                    // without the binding having to be reset
                    return
                }
                let context = {
                    templates: el.querySelectorAll(':scope > template'),
                    attribute: getBindingAttribute(el)
                }
                context.path = this.getBindingPath(el)
                context.value = getValueByPath(this.options.root, context.path)
                context.element = el
                track(el, context)
                runTransformers(context)
            }, 50))
        }

        // finds and runs applicable transformers
        // creates a stack of transformers, calls the topmost
        // each transformer can opt to call the next or not
        // transformers should return the context object (possibly altered)
        const runTransformers = (context) => {
            let transformers
            switch(context.attribute) {
                case this.options.attribute+'-field':
                    transformers = Array.from(this.options.render.field)
                    break
                case this.options.attribute+'-list':
                    transformers = Array.from(this.options.render.list)
                    break
                case this.options.attribute+'-map':
                    transformers = Array.from(this.options.render.map)
                    break
                default:
                    throw new Error('no valid context attribute specified',context)
                    break
            }
            if (context.element.hasAttribute(transformAttribute)) {
                context.element.getAttribute(transformAttribute)
                    .split(' ').filter(Boolean)
                    .forEach(t => {
                        if (this.options.transformers[t]) {
                            transformers.push(this.options.transformers[t])
                        } else {
                            console.warn('No transformer with name '+t+' configured', {cause:context.element})
                        }
                    })
            }
            let next
            for (let transformer of transformers) {
                next = ((next, transformer) => {
                    return (context) => {
                        return transformer.call(this, context, next)
                    }
                })(next, transformer)
            }
            next(context)
        }

        // given a set of elements with data bind attribute
        // this renders each of those elements
        const applyBindings = (bindings) => {
            for (let bindingEl of bindings) {
                if (!this.bindings.get(bindingEl)) { // bindingEl may have moved from somewhere else in this document
                    renderElement(bindingEl)
                }
            }
        }

        // this handles the mutation observer changes
        // if any element is added, and has a data bind attribute
        // it applies that data binding
        const updateBindings = (changes) => {
            const selector = `[${attribute}-field],[${attribute}-list],[${attribute}-map]`
            for (const change of changes) {
                if (change.type=="childList" && change.addedNodes) {
                    for (let node of change.addedNodes) {
                        if (node instanceof HTMLElement) {
                            let bindings = Array.from(node.querySelectorAll(selector))
                            if (node.matches(selector)) {
                                bindings.unshift(node)
                            }
                            if (bindings.length) {
                                applyBindings(bindings)
                            }
                        }
                    }
                }
            }
        }

        // this responds to elements getting added to the dom
        // and if any have data bind attributes, it applies those bindings
        this.observer = new MutationObserver((changes) => {
            updateBindings(changes)
        })

        this.observer.observe(this.options.container, {
            subtree: true,
            childList: true
        })

        // this finds elements with data binding attributes and applies those bindings
        // must come after setting up the observer, or included templates
        // won't trigger their own bindings
        const bindings = this.options.container.querySelectorAll(
            ':is(['+this.options.attribute+'-field]'+
            ',['+this.options.attribute+'-list]'+
            ',['+this.options.attribute+'-map]):not(template)'
        )
        if (bindings.length) {
            applyBindings(bindings)
        }

    }

    /**
     * Finds the first matching template and creates a new DocumentFragment
     * with the correct data bind attributes in it (prepends the current path)
     * @param Context context
     * @return DocumentFragment
     */
    applyTemplate(context)
    {
        const path      = context.path
        const parent    = context.parent
        const templates = context.templates
        const list      = context.list
        const index     = context.index
        const value     = list ? list[index] : context.value

        let template = this.findTemplate(templates, value)
        if (!template) {
            let result = new DocumentFragment()
            result.innerHTML = '<!-- no matching template -->'
            return result
        }
        let clone = template.content.cloneNode(true)
        if (!clone.children?.length) {
            return clone
        }
        if (clone.children.length>1) {
            throw new Error('template must contain a single root node', { cause: template })
        }
        const attribute = this.options.attribute

        const attributes = [attribute+'-field',attribute+'-list',attribute+'-map']
        const bindings = clone.querySelectorAll(`[${attribute}-field],[${attribute}-list],[${attribute}-map]`)
        for (let binding of bindings) {
            if (binding.tagName=='TEMPLATE') {
                continue
            }
            const attr = attributes.find(attr => binding.hasAttribute(attr))
            let bind = binding.getAttribute(attr)
            bind = this.applyLinks(template.links, bind)
            if (bind.substring(0, ':root.'.length)==':root.') {
                binding.setAttribute(attr, bind.substring(':root.'.length))
            } else if (bind==':value' && index!=null) {
                binding.setAttribute(attr, path+'.'+index)
            } else if (index!=null) {
                binding.setAttribute(attr, path+'.'+index+'.'+bind)
            } else {
                binding.setAttribute(attr, parent+bind)
            }
        }
        if (typeof index !== 'undefined') {
            clone.children[0].setAttribute(attribute+'-key',index)
        }
        // keep track of the used template, so if that changes, the item can be updated
        clone.children[0][Symbol.bindTemplate] = template

        // return clone, not the firstChild, so that all whitespace is cloned as well
        return clone
    }

    parseLinks(links)
    {
        let result = {}
        links = links.split(';').map(link => link.trim())
        for (let link of links) {
            link = link.split('=')
            result[link[0].trim()] = link[1].trim()
        }
        return result
    }

    applyLinks(links, value)
    {
        for (let link in links) {
            if (value.startsWith(link+'.')) {
                return links[link] + value.substr(link.length)
            } else if (value==link) {
                return links[link]
            }
        }
        return value
    }

    /**
     * Returns the path referenced in either the field, list or map attribute
     * @param HTMLElement el
     * @return string The path referenced, or void
     */
    getBindingPath(el)
    {
        const attributes = [
            this.options.attribute+'-field', 
            this.options.attribute+'-list',
            this.options.attribute+'-map'
        ]
        for (let attr of attributes) {
            if (el.hasAttribute(attr)) {
                return el.getAttribute(attr)
            }
        }
    }

    /**
     * Finds the first template from an array of templates that
     * matches the given value. 
     */
    findTemplate(templates, value)
    {
        const templateMatches = t => {
            // find the value to match against (e.g. data-bind="foo")
            let path = this.getBindingPath(t)
            let currentItem
            if (path) {
                if (path.substr(0,6)==':root.') {
                    currentItem = getValueByPath(this.options.root, path)
                } else {
                    currentItem = getValueByPath(value, path)
                }
            } else {
                currentItem = value
            }

            // then check the value against pattern, if set (e.g. data-bind-match="bar")
            const strItem = ''+currentItem
            let matches = t.getAttribute(this.options.attribute+'-match')
            if (matches) {
                if (matches===':empty' && !currentItem) {
                    return t
                } else if (matches===':notempty' && currentItem) {
                    return t
                }
                if (strItem == matches) {
                    return t
                }
            }
            if (!matches) {
                // no data-bind-match is set, so return this template
                return t
            }
        }
        let template = Array.from(templates).find(templateMatches)
        let links = null
        if (template?.hasAttribute(this.options.attribute+'-link')) {
            links = this.parseLinks(template.getAttribute(this.options.attribute+'-link'))
        }
        let rel = template?.getAttribute('rel')
        if (rel) {
            let replacement = document.querySelector('template#'+rel)
            if (!replacement) {
                throw new Error('Could not find template with id '+rel)
            }
            template = replacement
        }
        if (template) {
            template.links = links
        }
        return template
    }

    destroy()
    {
        this.bindings.forEach(binding => {
            destroy(binding)
        })
        this.bindings = new Map()
        this.observer.disconnect()
    }

}

/**
 * Returns a new instance of SimplyBind. This is the normal start
 * of a data bind flow
 */
export function bind(options)
{
    return new SimplyBind(options)
}

const tracking = new Map()

export function trace(path)
{
    return tracking.get(path)
}

function track(el, context) {
    if (!tracking.has(context.path)) {
        tracking.set(context.path, [context])
    } else {
        tracking.get(context.path).push(context)
    }
}

function untrack(el, path) {
    let list = tracking.get(path)
    if (list) {
        list = list.filter(context => context.element == el)
        tracking.set(path, list)
    }
}


/**
 * Returns the value by walking the given path as a json pointer, starting at root
 * if you have a property with a '.' in its name urlencode the '.', e.g: %46
 * 
 * @param HTMLElement root
 * @param string path e.g. 'foo.bar'
 * @return mixed the value found by walking the path from the root object or undefined
 */
export function getValueByPath(root, path)
{
    let parts = path.split('.')
    let curr = root
    let part
    part = parts.shift()
    let prevPart = null
    while (part && curr) {
        part = decodeURIComponent(part)
        if (part=='0' && !Array.isArray(curr)) {
            // ignore so that data-flow-list="nonarray" will work
        } else if (part==':key') {
            curr = prevPart
        } else if (part==':value') {
            // do nothing
        } else if (Array.isArray(curr) && typeof curr[part]=='undefined') {
            curr = curr[0][part] // so that data-flow-field="array.foo" works
        } else {
            curr = curr[part]
        }
        prevPart = part
        part = parts.shift()
    }
    return curr
}
