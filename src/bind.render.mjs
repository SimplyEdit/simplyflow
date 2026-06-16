/*
 * Default renderers for data binding
 * Will be used unless overriden in the SimplyBind options parameter
 */
import { signal as domSignal, trackDomField, trackDomList } from './dom.mjs'
import { throttledEffect, effect, untracked, batch } from './state.mjs'
import { getValueByPath } from './bind.mjs'
import { DEP } from './symbols.mjs'

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
    // make sure this effect is triggered if the length of the array changes
    const length = context.value.length
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

function isInt(s) {
    if (parseInt(s)==s) {
        return true
    }
}

/**
 * This function sets a given value on the given path, starting at the given root.
 * It will automatically create objects if a path part does not yet exist.
 * @param root the root object
 * @param path a JSON path
 * @param value the value to set
 */
export function setValueByPath(root, path, value)
{
    batch(() => {
        let parts = path.split('.')
        let curr = root
        let part
        part = parts.shift()
        let prev = null
        let prevPart = null
        let prevCurr = curr
        while (part && curr) {
            prevCurr = curr
            part = decodeURIComponent(part)
            if (part=='0' && !Array.isArray(curr)) {
                // ignore so that data-flow-list="nonarray" will work
            } else if (part==':key') {
                // FIXME: should change the key, not the value... not supported yet?
                throw new Error('setting key not yet supported')
                curr = prevPart
            } else if (part==':value') {
                // do nothing
            } else if (Array.isArray(curr) && !isInt(part) && typeof curr[part]=='undefined') {
                prev = curr[0]
                curr = curr[0][part] // so that data-flow-field="array.foo" works
            } else {
                prev = curr
                curr = curr[part]
            }
            prevPart = part
            part = parts.shift()
            if (part && !curr) {
                // path in html does not exist yet, so create it
                const intKey = parseInt(part)
                if (intKey>=0 && part===''+intKey) {
                    prevCurr[prevPart] = []
                } else {
                    prevCurr[prevPart] = {}
                }
                curr = prevCurr[prevPart]
            }
        }
        if (prev && prevPart && prev[prevPart]!==value) {
            if (value && typeof value=='object') {
                curr = prev[prevPart]
                if (!curr) {
                    // last part of path in html does not exist yet, create it
                    prev[prevPart] = {}
                    curr = prev[prevPart]
                }
                for (const prop in value) {
                    if (curr[prop]!==value[prop]) {
                        curr[prop] = value[prop]
                    }
                }
            } else {
                prev[prevPart] = value
            }
        }
    })
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
    const attributes     = [attribute+'-field',attribute+'-list',attribute+'-map']
    const attrQuery      = '['+attributes.join('],[')+']'
    const keyAttribute   = attribute+'-key'
    const items          = Array.from(context.element.querySelectorAll(':scope > ['+keyAttribute+']'))
    const usedItems      = new Set()
    let cursor           = 0

    context.list = context.value

    for (let index = 0; index < context.value.length; index++) {
        context.index = index
        const value = context.list[index]
        let item = nextUnusedItem(items, usedItems, cursor)

        if (!item) {
            context.element.appendChild(this.applyTemplate(context))
            continue
        }

        const newTemplate = this.findTemplate(context.templates, value)
        const currentValueMatches = item[DEP.VALUE] === value
        let reusableItem = currentValueMatches
            ? item
            : findReusableItem(items, usedItems, value, newTemplate, cursor + 1)

        if (reusableItem) {
            if (newTemplate != reusableItem[DEP.TEMPLATE]) {
                context.element.replaceChild(this.applyTemplate(context), reusableItem)
            } else {
                context.element.insertBefore(reusableItem, item)
                updateItemKey(reusableItem, index, context.path, keyAttribute, attributes, attrQuery)
                reusableItem[DEP.VALUE] = value
            }
            usedItems.add(reusableItem)
            if (reusableItem === item) {
                cursor++
            }
            continue
        }

        context.element.insertBefore(this.applyTemplate(context), item)
    }

    for (let item of items) {
        if (!usedItems.has(item)) {
            item.remove()
        }
    }

    if (this.options.twoway) {
        trackDomList.call(this, context.element)
    }
}

function nextUnusedItem(items, usedItems, start)
{
    while (start < items.length) {
        const item = items[start]
        if (!usedItems.has(item)) {
            return item
        }
        start++
    }
}

function findReusableItem(items, usedItems, value, template, start)
{
    for (let i = start; i < items.length; i++) {
        const item = items[i]
        if (!usedItems.has(item) && item[DEP.VALUE] === value && item[DEP.TEMPLATE] === template) {
            return item
        }
    }
}


function updateItemKey(item, key, path, keyAttribute, attributes, attrQuery)
{
    const oldKey = item.getAttribute(keyAttribute)
    const newKey = ''+key

    if (oldKey === newKey) {
        return
    }

    item.setAttribute(keyAttribute, newKey)

    const oldPrefix = path+'.'+oldKey
    const newPrefix = path+'.'+newKey
    const bindings = Array.from(item.querySelectorAll(attrQuery))
    if (item.matches(attrQuery)) {
        bindings.unshift(item)
    }

    for (let binding of bindings) {
        for (let attr of attributes) {
            const bindPath = binding.getAttribute(attr)
            if (!bindPath || bindPath.substr(0,5)===':root') {
                continue
            }
            if (bindPath === oldPrefix) {
                binding.setAttribute(attr, newPrefix)
            } else if (bindPath.startsWith(oldPrefix+'.')) {
                binding.setAttribute(attr, newPrefix+bindPath.substr(oldPrefix.length))
            }
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
    const attribute      = this.options.attribute
    const attributes     = [attribute+'-field',attribute+'-list',attribute+'-map']
    const attrQuery      = '['+attributes.join('],[')+']'
    const keyAttribute   = attribute+'-key'
    const items          = Array.from(context.element.querySelectorAll(':scope > ['+keyAttribute+']'))
    const usedItems      = new Set()
    let cursor           = 0

    context.list = context.value

    for (let key in context.list) {
        context.index = key
        const value = context.list[key]
        let item = nextUnusedItem(items, usedItems, cursor)

        if (!item) {
            context.element.appendChild(this.applyTemplate(context))
            continue
        }

        const newTemplate = this.findTemplate(context.templates, value)
        let reusableItem

        if (item.getAttribute(keyAttribute) === key) {
            reusableItem = item
        } else {
            reusableItem = findItemByKey(items, usedItems, key, keyAttribute)
                || findReusableItem(items, usedItems, value, newTemplate, cursor)
        }

        if (reusableItem) {
            if (newTemplate != reusableItem[DEP.TEMPLATE]) {
                context.element.replaceChild(this.applyTemplate(context), reusableItem)
            } else {
                context.element.insertBefore(reusableItem, item)
                updateItemKey(reusableItem, key, context.path, keyAttribute, attributes, attrQuery)
                reusableItem[DEP.VALUE] = value
            }
            usedItems.add(reusableItem)
            if (reusableItem === item) {
                cursor++
            }
            continue
        }

        context.element.insertBefore(this.applyTemplate(context), item)
    }

    for (let item of items) {
        if (!usedItems.has(item)) {
            item.remove()
        }
    }
}

function findItemByKey(items, usedItems, key, keyAttribute)
{
    const stringKey = ''+key
    for (let item of items) {
        if (!usedItems.has(item) && item.getAttribute(keyAttribute) === stringKey) {
            return item
        }
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
            if (rendered?.[DEP.TEMPLATE] != template) {
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

    element.call(this, context)
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
    element.call(this, context, 'value')
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
    element.call(this, context, 'target', 'href', 'name', 'newwindow', 'nofollow')
    if (this.options.twoway) {
        batch(() => {
            updateProperties.call(this, context, ['target', 'href', 'name', 'newwindow', 'nofollow'])
        })
    }
}

/**
 * Sets the title, id, alt and src attributes of an image.
 */
export function image(context)
{
    setProperties(context.element, context.value, 'title', 'alt', 'src', 'id')
    if (this.options.twoway) {
        batch(() => {
            updateProperties.call(this, context, ['title', 'alt', 'src', 'id'])
        })
    }
}

/**
 * Sets the title, id and src attribute of an iframe
 */
export function iframe(context)
{
    setProperties(context.element, context.value, 'title', 'src', 'id')
    if (this.options.twoway) {
        batch(() => {
            updateProperties.call(this, context, ['title','src','id'])
        })
    }
}

/**
 * Sets the content and id attribute of a meta element
 */
export function meta(context)
{
    setProperties(context.element, context.value, 'content', 'id')
    if (this.options.twoway) {
        batch(() => {
            updateProperties.call(this, context, ['content','id'])
        })
    }
}

/**
 * sets the innerHTML and title and id properties of any HTML element
 */
export function element(context, ...extraprops)
{
    const el  = context.element
    let value = context.value
    let valueIsString = false
    if (typeof value!='undefined' && value!==null) {
        let strValue = ''+value
        if (typeof value!='object' || strValue.substring(0,8)!='[object ') {
            value = { innerHTML: value }
            valueIsString = true
        }
    }
    const props = ['innerHTML','title','id','className'].concat(extraprops)
    setProperties(el, value, ...props)
    if (this.options.twoway) {
        trackDomField.call(this, context.element, props, valueIsString)
    }
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

export function getProperties(el, ...properties) {
    const result = {}
    for (const property of properties) {
        switch(property) {
            default: 
                result[property] = el[property]
            break
        }
    }
    return result
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
