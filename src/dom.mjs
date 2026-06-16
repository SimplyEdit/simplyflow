import { signals, signal as stateSignal, notifyGet, notifySet, makeContext,
         throttledEffect, effect, untracked, batch } from './state.mjs'
import { getValueByPath } from './bind.mjs'
import { setValueByPath, getProperties } from './bind.render.mjs'
import { DEP } from '../src/symbols.mjs'

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
        if (property===DEP.XRAY) {
            return target // don't notifyGet here, this is only called by set
        }
        if (property===DEP.SIGNAL) {
            return true
        }
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
    has: (target, property) => {
        let receiver = signals.get(target)
        if (receiver) {
            notifyGet(receiver, property)
        }
        return Object.hasOwn(target, property)
    },
    ownKeys: (target) => {
        let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
        if (receiver) {
            notifyGet(receiver, iterate)
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
    if (el[DEP.XRAY]) {
        return el
    }
    if (!signals.has(el)) {
        signals.set(el, new Proxy(el, domSignalHandler))
        domListen(el, signals.get(el), options)
    }
    return signals.get(el)
}

/**
 * This sets up the mutationObserver that calls notifySet on changes in the DOM
 */
function domListen(el, signal, options) {
    const defaultOptions = {
        characterData: true,
        subtree: true,
        attributes: true,
        attributesOldValue: true
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
            el.addEventListener('change', (evt) => {
                notifySet(signal, makeContext('value', { was: prevValue, now: el.value }))
                prevValue = el.value
            })
            if (el.matches('input, textarea')) {
                el.addEventListener('input', (evt) => {
                    notifySet(signal, makeContext('value', { was: prevValue, now: el.value }))
                    prevValue = el.value
                })
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
    })
    return s
}

/**
 * This function sets up the dom signal on an element, provided it has a `data-flow-field` attribute
 * @param HTMLElement element - the element to track
 * @returns Proxy
 */
export function trackDomField(element, props, valueIsString) {
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
            let updateValue = s.innerHTML //FIXME: incorrect: in an anchor this could be s.href - use extract here
            if (!valueIsString) {
                updateValue = getProperties(s, ...props)
            }
            untracked(() => { // don't track changes in data, only in the dom
                // don't trigger this effect when the data changes (root.path)
                setValueByPath(this.options.root, path, updateValue)
            })
        })
    })
    return s
}