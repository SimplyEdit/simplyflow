import { createSignal, getSignal, isSignal, signal as stateSignal, notifyGet, notifySet, makeContext,
         throttledEffect, untracked, batch } from './state.mjs'
import { getValueByPath } from './bind.mjs'
import { setValueByPath, getProperties } from './bind.render.mjs'
import { DEP } from './symbols.mjs'

/**
 * Tracks element => signal mapping so that each element only has one signal
 */
const domSignals = new WeakMap()

/**
 * Tracks element => mutationObservers
 */
const observers = new WeakMap()

/**
 * A dom signal is a Proxy, to track access to properties
 */
const domSignalHandler = {
    get: (target, property, receiver) => {
        const value = target?.[property]
        notifyGet(receiver, property)
        if (typeof value === 'function') {
            return value.bind(target) // make sure element functions are not linked to the proxy
        }
        if (value && typeof value == 'object') {
            return stateSignal(value)
        }
        return value
    },
    set: (target, property, value, receiver) => {
        const current = target[property]
        target[property] = value
        const now = target[property]
        if (!Object.is(current, now)) {
            notifySet(receiver, makeContext(property, { was: current, now }))
        }
        return true
    },
    has: (target, property) => {
        const receiver = getSignal(target)
        if (receiver) {
            notifyGet(receiver, property)
        }
        return Reflect.has(target, property)
    },
    ownKeys: (target) => {
        // The ownKeys trap has no receiver argument. Recover the stable signal
        // proxy so Object.keys(domSignal) can track DOM key iteration.
        const receiver = getSignal(target)
        if (receiver) {
            notifyGet(receiver, DEP.ITERATE)
        }
        return Reflect.ownKeys(target)
    }
}

/**
 * This function returns a dom signal. Using this in an effect() function
 * will automatically trigger the effect if a property of the dom signal 
 * changes.
 * Valid options are any of the mutationObserver options, like characterData, subtree, etc.
 * @param HTMLElement el
 * @param Object options
 * @returns Proxy
 */
export function signal(el, options) {
    if (isSignal(el)) {
        return el
    }

    const existing = getSignal(el)
    if (existing) {
        return existing
    }

    return createSignal(el, domSignalHandler, (target, proxy) => {
        domListen(target, proxy, options)
    })
}

/**
 * This sets up the mutationObserver that calls notifySet on changes in the DOM
 */
function domListen(el, signal, options) {
    const defaultOptions = {
        characterData: true,
        subtree: true,
        attributes: true,
        attributesOldValue: true,
        childList: true
    }
    if (!options) {
        options = defaultOptions
    }
    let oldContentHTML = el.innerHTML
    let oldContentText = el.innerText
    if (!observers.has(el)) {
        const observer = new MutationObserver((mutationList, observer) => {
            // collect changes
            const changes = {}
            for (const mutation of mutationList) {
                if (mutation.type==='attributes') {
                    // check if any listeners for each attribute
                    changes[mutation.attributeName] = mutation.attributeOldValue
                } else if (mutation.type==='subtree' || mutation.type==='characterData') {
                    // change on innerHTML/innerText
                    if (el.innerHTML != oldContentHTML) {
                        changes.innerHTML = oldContentHTML
                        oldContentHTML = el.innerHTML
                    }
                    if (el.innerText != oldContentText) {
                        changes.innerText = oldContentText
                        oldContentText = el.innerText
                    }
                } else if (mutation.type==='childList') {
                    changes.children = { //FIXME: overwrites changes in this list path if list is rendered multiple times
                        was: Array.from(el.children) //FIXME; fill in 'now'
                    }
                    changes.length = -1 //FIXME: don't do this :)
                    if (el.innerHTML != oldContentHTML) {
                        changes.innerHTML = oldContentHTML
                        oldContentHTML = el.innerHTML
                    }
                    if (el.innerText != oldContentText) {
                        changes.innerText = oldContentText
                        oldContentText = el.innerText
                    }
                } else {
                    console.log('nothing to do for',el,mutation.type)
                }
            }
            for (const prop in changes) {
                notifySet(signal, makeContext(prop, { was: changes[prop], now: el[prop] }))
            }
        })
        observer.observe(el, options)
        observers.set(el, observer)
        //@TODO: unregister the observer when el is removed from the dom (after a timeout)
        if (el.matches('input, textarea, select')) {
            let prevValue = el.value
            let prevChecked = el.checked
            const notifyFormValue = () => {
                notifySet(signal, makeContext('value', { was: prevValue, now: el.value }))
                prevValue = el.value
                if ('checked' in el) {
                    notifySet(signal, makeContext('checked', { was: prevChecked, now: el.checked }))
                    prevChecked = el.checked
                }
            }
            el.addEventListener('change', notifyFormValue)
            if (el.matches('input, textarea')) {
                el.addEventListener('input', notifyFormValue)
            }
        }
    }
}

/**
 * This function sets up the dom signal on an element, provided it has a `data-flow-list` attribute
 * @param HTMLElement element - the element to track
 * @returns Proxy
 */
export function trackDomList(element)
{
    const path = this.getBindingPath(element)
    if (!path) {
        throw new Error('Could not find binding path for element', { cause: element })
    }
    const s = signal(element, {
        childList: true
    })
    throttledEffect(() => {
        const children = Array.from(s.children)
        untracked(() => { // don't track access to the data, only track dom changes
            batch(() => { // apply all changes in the list as one change
                let key=0
                const currentList = getValueByPath(this.options.root, path)
                const source = currentList.slice() // make sure changes in currentList don't affect the original source
                for (const item of children) {
                    if (item.tagName==='TEMPLATE') {
                        continue
                    }
                    if (item.dataset.flowKey) { //FIXME: could be other attribute name
                        if (item.dataset.flowKey!=key) {
                            setValueByPath(this.options.root, path+'.'+key,
                                source[item.dataset.flowKey])
                        }
                        key++
                    }
                }
                if (currentList.length>key) {
                    // remove extra values
                    currentList.length = key
                }
            })
        })
    }, 50)
    return s
}

/**
 * This function sets up the dom signal on an element, provided it has a `data-flow-field` attribute
 * @param HTMLElement element - the element to track
 * @returns Proxy
 */
export function trackDomField(element, props, valueIsString, stringProperty = 'innerHTML', getUpdateValue) {
    if (domSignals.has(element)) {
        return
    }
    const path = this.getBindingPath(element)
    if (!path) {
        throw new Error('Could not find binding path for element', { cause: element })
    }
    const s = signal(element)
    domSignals.set(element, s)
    //TODO: run reverse transformers (extract)
    batch(() => { // avoids cyclical dependencies - check why
        throttledEffect(() => {
            let updateValue
            if (getUpdateValue) {
                // Custom edit extractors often need the current data value, for
                // example to toggle a checkbox value in an array. Read the DOM
                // properties here for dependency tracking, but read the data only
                // in the untracked section below to avoid DOM/data cycles.
                for (const prop of props) {
                    s[prop]
                }
            } else {
                updateValue = s[stringProperty]
                if (!valueIsString) {
                    updateValue = getProperties(s, ...props)
                }
            }
            untracked(() => { // don't track changes in data, only in the dom
                // Rendering a primitive value into the DOM usually turns it into
                // a string. Do not write that string straight back to the data
                // when it still represents the current value. This keeps numbers
                // and booleans stable after one-way rendering in a two-way bind.
                const currentValue = getValueByPath(this.options.root, path)
                if (getUpdateValue) {
                    updateValue = getUpdateValue.call(this, s, currentValue)
                }
                if (typeof updateValue === 'undefined') {
                    return
                }
                if (valueIsString && !Object.is(currentValue, updateValue) && String(currentValue) === updateValue) {
                    return
                }
                // don't trigger this effect when the data changes (root.path)
                setValueByPath(this.options.root, path, updateValue)
            })
        }, 50)
    })
    return s
}


/**
 * Finds the closest ancestor, including `el` itself, that has `attr` and
 * returns that attribute value.
 *
 * This helper is used by the app/command layer and lives in this module so
 * DOM utility helpers shared by the app and binding layers.
 *
 * @param {Element} el - Element to start searching from.
 * @param {string} attr - Attribute name to find.
 * @returns {string|undefined} The attribute value, or undefined if not found.
 */
export function findAttribute(el, attr) {
    return el.closest('['+attr+']')
        ?.getAttribute(attr)
}
