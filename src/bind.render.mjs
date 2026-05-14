/*
 * Default renderers for data binding
 * Will be used unless overriden in the SimplyBind options parameter
 */
import { signal as domSignal } from './dom.mjs'

/**
 * This function is used by default to render dom elements with the `data-flow-field` attribute.
 * It will switch to only switching in template content if the context has any templates.
 * Otherwise it will call the matching render function depending on the tagName of the
 * context.element
 */
export function field(context)
{
    if (context.templates?.length) {
        fieldByTemplates.call(this, context)
        // TODO: check if existence of one or more templates must mean that
        // only the template rendering is applied, instead of also rendering attributes
    } else if (Object.hasOwnProperty.call(this.options.renderers, context.element.tagName)) {
        const renderer = this.options.renderers[context.element.tagName]
        if (renderer) {
            renderer.call(this, context)
        }
    } else if (this.options.renderers['*']) {
        this.options.renderers['*'].call(this, context)
        // FIXME: should call a setter (defined in field type) to set the value back into root data
        if (this.options.twoway) { 
            // TODO: make content-editable if editmode is toggled on
            // how do you toggle editmode? global signal?
            // make uneditable if editmode is toggled off
            const s = domSignal(context.element)
            effect(() => {
                setValueByPath(this.options.root, context.path, s.innerHTML)
            })
        }
    }
    return context
}

/**
 * This function is used by default to render DOM elements with the `data-flow-list` attribute.
 * The context.value must be an array. And context.templates must not be empty.
 */
export function list(context)
{
    if (!Array.isArray(context.value)) {
        context.value = [context.value]
    }
    if (!context.templates?.length) {
        console.error('No templates found in', context.element)
    } else {
        arrayByTemplates.call(this, context)
    }
    return context
}

/**
 * This function is used by default to render DOM elements with the `data-flow-map` attribute.
 * The context.value must be a non-null object. And context.templates must not be empty.
 */
export function map(context)
{
    if (typeof context.value != 'object' || !context.value) {
        console.error('Value is not an object.', context.element, context.path, context.value)
    } else if (!context.templates?.length) {
        console.error('No templates found in', context.element)
    } else {
        objectByTemplates.call(this, context)
    }
    return context
}

export function setValueByPath(root, path, value)
{
    let parts = path.split('.')
    let curr = root
    let part
    part = parts.shift()
    let prev = null
    let prevPart = null
    while (part && curr) {
        part = decodeURIComponent(part)
        if (part=='0' && !Array.isArray(curr)) {
            // ignore so that data-flow-list="nonarray" will work
        } else if (part==':key') {
            // FIXME: should change the key, not the value... not supported yet?
            throw new Error('setting key not yet supported')
            curr = prevPart
        } else if (part==':value') {
            // do nothing
        } else if (Array.isArray(curr) && typeof curr[part]=='undefined') {
            prev = curr[0]
            curr = curr[0][part] // so that data-flow-field="array.foo" works
        } else {
            prev = curr
            curr = curr[part]
        }
        prevPart = part
        part = parts.shift()
    }
    if (prev && prevPart && prev[prevPart]!==value) {
        prev[prevPart] = value
    }
}

/**
 * Renders an array value by applying templates for each entry
 * Replaces or removes existing DOM children if needed
 * Reuses (doesn't touch) DOM children if template doesn't change
 * FIXME: this doesn't handle situations where there is no matching template
 * this messes up self healing. check renderObjectByTemplates for a better implementation
 */
export function arrayByTemplates(context)
{
    const attribute      = this.options.attribute

    let items = context.element.querySelectorAll(':scope > ['+attribute+'-key]')
    // do single merge strategy for now, in future calculate optimal merge strategy from a number
    // now just do a delete if a key <= last key, insert if a key >= last key
    let lastKey = 0
    let skipped = 0
    context.list = context.value
    for (let item of items) {
        let currentKey = parseInt(item.getAttribute(attribute+'-key'))
        if (currentKey>lastKey) {
            // insert before
            context.index = lastKey
            context.element.insertBefore(this.applyTemplate(context), item)
        } else if (currentKey<lastKey) {
            // remove this
            item.remove()
        } else {
            // check that all data-bind params start with current json path or ':root', otherwise replaceChild
            let bindings = Array.from(item.querySelectorAll(`[${attribute}]`))
            if (item.matches(`[${attribute}]`)) {
                bindings.unshift(item)
            }
            let needsReplacement = bindings.find(b => {
                let databind = b.getAttribute(attribute)
                return (databind.substr(0,5)!==':root' 
                    && databind.substr(0, context.path.length)!==context.path)
            })
            if (!needsReplacement) {
                if (item[Symbol.bindTemplate]) {
                    let newTemplate = this.findTemplate(context.templates, context.list[lastKey])
                    if (newTemplate != item[Symbol.bindTemplate]){
                        needsReplacement = true
                        if (!newTemplate) {
                            skipped++
                        }
                    }
                }
            }
            if (needsReplacement) {
                context.index = lastKey
                context.element.replaceChild(this.applyTemplate(context), item)
            }
        }
        lastKey++
        if (lastKey>=context.value.length) {
            break
        }
    }
    items = context.element.querySelectorAll(':scope > ['+attribute+'-key]')
    let length = items.length + skipped
    if (length > context.value.length) {
        while (length > context.value.length) {
            let child = context.element.querySelectorAll(':scope > :not(template)')?.[length-1]
            child?.remove()
            length--
        }
    } else if (length < context.value.length ) {
        while (length < context.value.length) {
            context.index = length
            context.element.appendChild(this.applyTemplate(context))
            length++
        }
    }
}

/**
 * Renders an object value by applying templates for each entry (Object.entries)
 * Replaces,moves or removes existing DOM children if needed
 * Reuses (doesn't touch) DOM children if template doesn't change
 */
export function objectByTemplates(context)
{
    const attribute = this.options.attribute
    context.list = context.value

    let items = Array.from(context.element.querySelectorAll(':scope > ['+attribute+'-key]'))
    for (let key in context.list) {
        context.index = key
        let item = items.shift()
        if (!item) { // more properties than rendered items
            let clone = this.applyTemplate(context)
            context.element.appendChild(clone)
            continue
        }
        if (item.getAttribute(attribute+'-key')!=key) { 
            // next item doesn't match key
            items.unshift(item) // put item back for next cycle
            let outOfOrderItem = context.element.querySelector(':scope > ['+attribute+'-key="'+key+'"]') //FIXME: escape key
            if (!outOfOrderItem) {
                let clone = this.applyTemplate(context)
                context.element.insertBefore(clone, item)
                continue // new template doesn't need replacement, so continue 
            } else {
                context.element.insertBefore(outOfOrderItem, item)
                item = outOfOrderItem // check needsreplacement next
                items = items.filter(i => i!=outOfOrderItem)
            }
        }
        let newTemplate = this.findTemplate(context.templates, context.list[context.index])
        if (newTemplate != item[Symbol.bindTemplate]){
            let clone = this.applyTemplate(context)
            context.element.replaceChild(clone, item)
        }
    }
    // clean up remaining items
    while (items.length) {
        let item = items.shift()
        item.remove()
    }
}

/**
 * renders the contents of an html element by rendering
 * a matching template, once.
 */
export function fieldByTemplates(context)
{
    const rendered = context.element.querySelector(':scope > :not(template)')
    const template = this.findTemplate(context.templates, context.value)
    context.parent = getParentPath(context.element)
    if (rendered) {
        if (template) {
            if (rendered?.[Symbol.bindTemplate] != template) {
                const clone = this.applyTemplate(context)
                context.element.replaceChild(clone, rendered)
            }
        } else {
            context.element.removeChild(rendered)
        }
    } else if (template) {
        const clone = this.applyTemplate(context)
        context.element.appendChild(clone)
    }
}

function getParentPath(el, attribute)
{
    const parentEl  = el.parentElement?.closest(`[${attribute}-list],[${attribute}-map]`)
    if (!parentEl) {
        return ''
    }
    if (parentEl.hasAttribute(`${attribute}-list`)) {
        return parentEl.getAttribute(`${attribute}-list`)+'.'
    }
    return parentEl.getAttribute(`${attribute}-map`)+'.'
}

/**
 * renders a single input type
 * for radio/checkbox inputs it only sets the checked attribute to true/false
 * if the value attribute matches the current value
 * for other inputs the value attribute is updated
 */
export function input(context)
{
    const el  = context.element
    let value = context.value

    element(context)
    if (typeof value == 'undefined') {
        value = ''
    }
    if (el.type=='checkbox' || el.type=='radio') {
        if (matchValue(el.value, value)) {
            el.checked = true
        } else {
            el.checked = false
        }
    } else if (!matchValue(el.value, value)) {
        el.value = ''+value
    }
}

/**
 * Sets the value of the button, doesn't touch the innerHTML
 */
export function button(context)
{
    element(context)
    setProperties(context.element, context.value, 'value')
}

/**
 * Sets the selected attribute of select options
 */
export function select(context)
{
    const el  = context.element
    let value = context.value

    if (value === null) {
        value = ''
    }
    if (typeof value!='object') {
        if (el.multiple) {
            if (Array.isArray(value)) { //FIXME: cannot be true, since typeof != 'object'
                for (let option of el.options) {
                    if (value.indexOf(option.value)===false) {
                        option.selected = false
                    } else {
                        option.selected = true
                    }
                }
            }
        } else {
            let option = el.options.find(o => matchValue(o.value,value))
            if (option) {
                option.selected = true
                option.setAttribute('selected', true)
            }
        }
    } else { // value is a non-null object
        if (value.options) {
            setSelectOptions(el, value.options)
        }
        if (value.selected) {
            select(Object.asssign({}, context, {value:value.selected}))
        }
        setProperties(el, value, 'name', 'id', 'selectedIndex', 'className') // allow innerHTML? if so call element instead
    }
}

/**
 * adds a single option to a select element. The option.text property is optional, if not set option.value is used.
 * @param select The select element
 * @param option An option descriptor, either a string, object with {text,value,defaultSelected,selected} properties or an Option object
 */
export function addOption(select, option)
{
    if (!option) {
        return
    }
    if (typeof option !== 'object') {
        select.options.add(new Option(''+option))
    } else if (option.text) {
        select.options.add(new Option(option.text, option.value, option.defaultSelected, option.selected))
    } else if (typeof option.value != 'undefined') {
        select.options.add(new Option(''+option.value, option.value, option.defaultSelected, option.selected))
    }
}

/**
 * This function clears all existing options of a select element, and adds the specified options.
 */
export function setSelectOptions(select,options)
{
    //@TODO: only update in case of changes?
    select.innerHTML = ''
    if (Array.isArray(options)) {
        for (const option of options) {
            addOption(select, option)
        }
    } else if (options && typeof options == 'object') {
        for (const option in options) {
            addOption(select, { text: options[option], value: option })
        }
    }
}

/**
 * Sets the innerHTML and href, id, title, target, name, newwindow, nofollow attributes of an anchor
 */
export function anchor(context)
{
    element(context)
    setProperties(context.element, context.value, 'target', 'href', 'name', 'newwindow', 'nofollow')
}

/**
 * Sets the title, id, alt and src attributes of an image.
 */
export function image(context)
{
    setProperties(context.element, context.value, 'title', 'alt', 'src', 'id')
}

/**
 * Sets the title, id and src attribute of an iframe
 */
export function iframe(context)
{
    setProperties(context.element, context.value, 'title', 'src', 'id')
}

/**
 * Sets the content and id attribute of a meta element
 */
export function meta(context)
{
    setProperties(context.element, context.value, 'content', 'id')    
}

/**
 * sets the innerHTML and title and id properties of any HTML element
 */
export function element(context)
{
    const el  = context.element
    let value = context.value

    if (typeof value=='undefined' || value==null) {
        value = ''
    }
    let strValue = ''+value
    if (typeof value!='object' || strValue.substring(0,8)!='[object ') {
        value = { innerHTML: value }
    }
    setProperties(el, value, 'innerHTML', 'title', 'id', 'className')
}

/**
 * Sets a list of properties on a dom element, equal to 
 * the string value of a data object
 * only updates the dom element if the property doesn't match
 */
export function setProperties(el, data, ...properties) {
    if (!data || typeof data!=='object') {
        return
    }
    for (const property of properties) {
        if (typeof data[property] === 'undefined') {
            continue
        }
        if (matchValue(el[property], data[property])) {
            continue
        }
        if (data[property] === null) {
            el[property] = ''
        } else {
            el[property] = ''+data[property]
        }
    }
}

/**
 * Returns true if a matches b, either by having the
 * same string value, or matching string :empty against a falsy value
 */
export function matchValue(a,b)
{
    if (a==':empty' && !b) {
        return true
    }
    if (b==':empty' && !a) {
        return true
    }
    if (''+a == ''+b) {
        return true
    }
    return false
}
