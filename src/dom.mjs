import { signals, signal as stateSignal, notifyGet, notifySet, makeContext } from './state.mjs'

const domSignalHandler = {
    get: (target, property, receiver) => {
        if (property===Symbol.xRay) {
            return target // don't notifyGet here, this is only called by set
        }
        if (property===Symbol.Signal) {
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

export function signal(el, options) {
    if (el[Symbol.xRay]) {
        return el
    }
    if (!signals.has(el)) {
        signals.set(el, new Proxy(el, domSignalHandler))
        domListen(el, signals.get(el), options)
    }
    return signals.get(el)
}

const observers = new WeakMap()

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
