/**
 * Default renderer for data binding
 * Will be used unless overriden in the SimplyBind options parameter
 */
export function field(context)
{
    const el             = context.element
    const templates      = context.templates

    if (templates?.length) {
        fieldByTemplates.call(this, context)
        context = context.withoutHTML()
    }
    if (Object.hasOwnProperty.call(this.renderers, el.tagName)) {
        const renderer = this.renderers[el.tagName]
        if (renderer) {
            renderer.call(this, context)
        }
    } else if (this.renderers['*']) {
        this.renderers['*'].call(this, context)
    }
    return context
}

export function list(context)
{
    const el             = context.element
    const templates      = context.templates
    const path           = context.path
    const value          = context.value
    
    if (!Array.isArray(value)) {
        console.error('Value is not an array.', el, path, value)
    } else if (!templates?.length) {
        console.error('No templates found in', el)
    } else {
        arrayByTemplates.call(this, context)
    }
    return context
}

export function map(context)
{
    const el             = context.element
    const templates      = context.templates
    const path           = context.path
    const value          = context.value

    if (typeof value != 'object') {
        console.error('Value is not an object.', el, path, value)
    } else if (!templates?.length) {
        console.error('No templates found in', el)
    } else {
        objectByTemplates.call(this, context)
    }
    return context
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
    const el             = context.element
    const templates      = context.templates
    const path           = context.path
    const value          = context.value
    const attribute      = this.options.attribute

    let items = el.querySelectorAll(':scope > ['+attribute+'-key]')
    // do single merge strategy for now, in future calculate optimal merge strategy from a number
    // now just do a delete if a key <= last key, insert if a key >= last key
    let lastKey = 0
    let skipped = 0
    context = context.with({list: value})
    for (let item of items) {
        let currentKey = parseInt(item.getAttribute(attribute+'-key'))
        if (currentKey>lastKey) {
            // insert before
            context = context.with({index: lastKey})
            el.insertBefore(this.applyTemplate(context), item)
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
                    && databind.substr(0, path.length)!==path)
            })
            if (!needsReplacement) {
                if (item.$bindTemplate) {
                    let newTemplate = this.findTemplate(templates, value[lastKey])
                    if (newTemplate != item.$bindTemplate){
                        needsReplacement = true
                        if (!newTemplate) {
                            skipped++
                        }
                    }
                }
            }
            if (needsReplacement) {
                context = context.with({index: lastKey})
                el.replaceChild(this.applyTemplate(context), item)
            }
        }
        lastKey++
        if (lastKey>=value.length) {
            break
        }
    }
    items = el.querySelectorAll(':scope > ['+attribute+'-key]')
    let length = items.length + skipped
    if (length > value.length) {
        while (length > value.length) {
            let child = el.querySelectorAll(':scope > :not(template)')?.[length-1]
            child?.remove()
            length--
        }
    } else if (length < value.length ) {
        while (length < value.length) {
            context = context.with({index: length})
            el.appendChild(this.applyTemplate(context))
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
    const el             = context.element
    const templates      = context.templates
    const value          = context.value
    const attribute      = this.options.attribute
    context = context.with({list: value})

    let items = Array.from(el.querySelectorAll(':scope > ['+attribute+'-key]'))
    for (let key in context.list) {
        context = context.with({index: key})
        let item = items.shift()
        if (!item) { // more properties than rendered items
            let clone = this.applyTemplate(context)
            el.appendChild(clone)
            continue
        }
        if (item.getAttribute[attribute+'-key']!=key) { 
            // next item doesn't match key
            items.unshift(item) // put item back for next cycle
            let outOfOrderItem = el.querySelector(':scope > ['+attribute+'-key="'+key+'"]') //FIXME: escape key
            if (!outOfOrderItem) {
                let clone = this.applyTemplate(context)
                el.insertBefore(clone, item)
                continue // new template doesn't need replacement, so continue 
            } else {
                el.insertBefore(outOfOrderItem, item)
                item = outOfOrderItem // check needsreplacement next
                items = items.filter(i => i!=outOfOrderItem)
            }
        }
        let newTemplate = this.findTemplate(templates, value[key])
        if (newTemplate != item.$bindTemplate){
            let clone = this.applyTemplate(context)
            el.replaceChild(clone, item)
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
 * data-bind attributes inside the template use the same
 * parent path as this html element uses
 */
export function fieldByTemplates(context)
{
    const el             = context.element
    const templates      = context.templates
    const value          = context.value
    const attribute      = this.options.attribute

    const rendered = el.querySelector(':scope > :not(template)')
    const template = this.findTemplate(templates, value)

    context = context.with({parent: getParentPath(el, attribute)})
    if (rendered) {
        if (template) {
            if (rendered?.$bindTemplate != template) {
                const clone = this.applyTemplate(context)
                el.replaceChild(clone, rendered)
            }
        } else {
            el.removeChild(rendered)
        }
    } else if (template) {
        const clone = this.applyTemplate(context)
        el.appendChild(clone)
    }
}

function getParentPath(el, attribute)
{
    const parentEl  = el.parentElement?.closest(`[${attribute}-list],[${attribute}-map]`)
    if (!parentEl) {
        return ':root'
    }
    if (parentEl.hasAttribute(`${attribute}-list`)) {
        return parentEl.getAttribute(`${attribute}-list`)
    }
    return parentEl.getAttribute(`${attribute}-map`)
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
    const el    = context.element
    const value = context.value

    element(context)
    setProperties(el, value, 'value')
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
 * Sets the innerHTML and href attribute of an anchor
 * TODO: support target, title, etc. attributes
 */
export function anchor(context)
{
    const el    = context.element
    const value = context.value

    element(context)
    setProperties(el, value, 'title', 'target', 'href', 'name', 'newwindow', 'nofollow')
}

export function image(context)
{
    const el    = context.element
    const value = context.value

    element(context)
    setProperties(el, value, 'title', 'alt', 'src')
}

export function iframe(context)
{
    const el    = context.element
    const value = context.value

    element(context)
    setProperties(el, value, 'title', 'src')
}

export function meta(context)
{
    const el    = context.element
    const value = context.value

    element(context)
    setProperties(el, value, 'content')    
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
        el.innerHTML = strValue
        return
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
