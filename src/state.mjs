const iterate = Symbol('iterate')
if (!Symbol.xRay) {
    Symbol.xRay = Symbol('xRay')
}
if (!Symbol.Signal) {
    Symbol.Signal = Symbol('Signal')
}

const signalHandler = {
    get: (target, property, receiver) => {
        if (property===Symbol.xRay) {
            return target // don't notifyGet here, this is only called by set
        }
        if (property===Symbol.Signal) {
            return true
        }
        const value = target?.[property] // Reflect.get fails on a Set.
        notifyGet(receiver, property)
        if (typeof value === 'function') {
            if (Array.isArray(target)) {
                return (...args) => {
                    let l = target.length
                    // by binding the function to the receiver
                    // all accesses in the function will be trapped
                    // by the Proxy, so get/set/delete is all handled
                    let result = value.apply(receiver, args)
                    if (l != target.length) {
                        notifySet(receiver,  makeContext('length', { was: l, now: target.length }) )
                    }
                    return result
                }
            } else if (target instanceof Set || target instanceof Map) {
                return (...args) => {
                    // node doesn't allow you to call set/map functions
                    // bound to the receiver.. so using target instead
                    // there are no properties to update anyway, except for size
                    let s = target.size
                    let result = value.apply(target, args)
                    if (s != target.size) {
                        notifySet(receiver, makeContext( 'size', { was: s, now: target.size }) )
                    }
                    // there is no efficient way to see if the function called
                    // has actually changed the Set/Map, but by assuming the
                    // 'setter' functions will change the results of the
                    // 'getter' functions, effects should update correctly
                    if (['set','add','clear','delete'].includes(property)) {
                        notifySet(receiver, makeContext( { entries: {}, forEach: {}, has: {}, keys: {}, values: {}, [Symbol.iterator]: {} } ) )
                    }
                    return result
                }
            } else if (
                target instanceof HTMLElement
                || target instanceof Number
                || target instanceof String
                || target instanceof Boolean
            ) {
                return value.bind(target)
            } else {
                // support custom classes, hopefully
                return value.bind(receiver)
            }
        }
        if (value && typeof value == 'object') {
            return signal(value)
        }
        return value
    },
    set: (target, property, value, receiver) => {
        value = value?.[Symbol.xRay] || value // unwraps signal
        //FIXME: if value contains child objects, these may be signals as well... so do this recursively
        unwrap(value)
        let current = target[property]
        if (current!==value) {
            target[property] = value
            notifySet(receiver, makeContext(property, { was: current, now: value } ) )
        }
        if (typeof current === 'undefined') {
            notifySet(receiver, makeContext(iterate, {}))
        }
        return true
    },
    has: (target, property) => { // receiver is not part of the has() call
        let receiver = signals.get(target) // so retrieve it here
        if (receiver) {
            notifyGet(receiver, property)
        }
        return Object.hasOwn(target, property)
    },
    deleteProperty: (target, property) => {
        if (typeof target[property] !== 'undefined') {
            let current = target[property]
            delete target[property]
            let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
            notifySet(receiver, makeContext(property,{ delete: true, was: current }))
        }
        return true
    },
    defineProperty: (target, property, descriptor) => {
        if (typeof target[property] === 'undefined') {
            let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
            notifySet(receiver, makeContext(iterate, {}))
        }
        return Object.defineProperty(target, property, descriptor)
    },
    ownKeys: (target) => {
        let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
        notifyGet(receiver, iterate)
        return Reflect.ownKeys(target)
    }

}

/**
 * Keeps track of the return signal for an update function, as well
 * as signals connected to other objects. 
 * Makes sure that a given object or function always uses the same
 * signal
 */
const signals = new WeakMap()

/**
 * Creates a new signal proxy of the given object, that intercepts get/has and set/delete
 * to allow reactive functions to be triggered when signal values change.
 */
export function signal(v) {
    unwrap(v)
    if (v[Symbol.Signal]) { // avoid wrapping a Signal inside a Signal
        let target = v[Symbol.xRay]
        if (!signals.has(target)) {
            signals.set(target, v)
        }
        v = target
    } else if (!signals.has(v)) {
        signals.set(v, new Proxy(v, signalHandler))
    }
    return signals.get(v)
}

const domSignalHandler = {
    get: (target, property, receiver) => {
        if (property===Symbol.xRay) {
            return target // don't notifyGet here, this is only called by set
        }
        if (property===Symbol.Signal) {
            return true
        }
        const value = target?.[property]
        domListen(target, receiver)
        notifyGet(receiver, property)
        if (typeof value === 'function') {
            return value.bind(target) // make sure element functions are not linked to the proxy
        }
        if (value && typeof value == 'object') {
            return signal(value)
        }
        return value
    },
    has: (target, property) => {
        let receiver = signals.get(target)
        if (receiver) {
            domListen(target, receiver)
            notifyGet(receiver, property)
        }
        return Object.hasOwn(target, property)
    },
    ownKeys: (target) => {
        let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
        if (receiver) {
            domListen(target, receiver)
            notifyGet(receiver, iterate)
        }
        return Reflect.ownKeys(target)
    }
}

export function domSignal(el) {
    if (el[Symbol.xRay]) {
        return el
    }
    if (!signals.has(el)) {
        signals.set(el, new Proxy(el, domSignalHandler))
    }
    return signals.get(el)
}

let tracers = []
let tracing = false
/**
 * @param Signal|Function signal
 * If given a singal and property, this function lists all effects 
 * that are currently listening to changes to that signal and property
 * returns a list with 
 * - effect: the effect function (effect, throttledEffect, clockEffect)
 * - fn: the user provided function to this effect function
 * - signal: the connectedSignal to this user provided function
 * @param string prop 
 * @return array of { effect, fn, signal }
 * 
 * If given a function, it will enable any tracers added with addTracer
 * call the given function and then disable all tracers.
 * @return void
 */
export function trace(signal, prop) {
    if (typeof signal==='function') {
        tracing = true
        signal()
        tracing = false
    } else {
        const listeners = getListeners(signal, prop)
        return listeners.map(listener => {
            return {
                effect: listener.effectType,
                fn: listener.effectFunction,
                signal: signals.get(listener.effectFunction)
            }
        })
    }
}

/**
 * Adds a tracer. This is an object with a 'set' and/or 'get' function.
 * If enabled (with the trace() method) each access to notifyGet will 
 * call the 'get' function. Each access to notifySet will call the 'set'
 * function.
 * @param tracer { get: fn, set: fn }
 * get: function(signal, property)
 * set: function(signal, context, listener)
 */
export function addTracer(tracer) {
    if (!tracer.get && !tracer.set) {
        throw new Error('simply.state: addTracer: missing "get" or "set" property in tracer', tracer)
    }
    if (tracer.get && typeof tracer.get!=='function') {
        throw new Error('simply.state: addTracer: "get" is not a function', tracer)
    }
    if (tracer.set && typeof tracer.set!=='function') {
        throw new Error('simply.state: addTracer: "set" is not a function', tracer)
    }
    tracers.push(tracer)
}

function callTracers(getset, ...params) {
    for (const tracer of tracers) {
        if (tracer[getset]) {
            tracer[getset](...params)
        }
    }
}

let batchedListeners = new Set()
let batchMode = 0
/**
 * Called when a signal changes a property (set/delete)
 * Triggers any reactor function that depends on this signal
 * to re-compute its values
 */
function notifySet(self, context={}) {
    if (disableTracking) {
        return
    }
    let listeners = []
    context.forEach((change, property) => {
        let propListeners = getListeners(self, property)
        if (propListeners?.length) {
            for (let listener of propListeners) {
                addContext(listener, makeContext(property,change))
            }
            listeners = listeners.concat(propListeners)
        }
    })
    listeners = new Set(listeners.filter(Boolean))
    if (listeners) {
        if (batchMode) {
            batchedListeners = batchedListeners.union(listeners)
        } else {
            const currentEffect = computeStack[computeStack.length-1]
            for (let listener of Array.from(listeners)) {
                if (listener!=currentEffect && listener?.needsUpdate) {
                    if (tracing && tracers.length) {
                        callTracers('set', self, context, listener)
                    }
                    listener()
                }
                clearContext(listener)
            }
        }
    }
}

const observers = new WeakMap()

function domListen(el, signal) {
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
                }
            }
            for (const prop in changes) {
                notifySet(signal, makeContext(prop, { was: changes[prop], now: el[prop] }))
            }
        })
        observer.observe(el, {
            characterData: true,
            subtree: true,
            attributes: true,
            attributesOldValue: true
        })
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

function makeContext(property, change) {
    let context = new Map()
    if (typeof property === 'object') {
        for (let prop in property) {
            context.set(prop, property[prop])
        }
    } else {
        context.set(property, change)
    }
    return context
}

function addContext(listener, context) {
    if (!listener.context) {
        listener.context = context
    } else {
        context.forEach((change,property)=> {
            listener.context.set(property, change) // TODO: merge change if needed
        })
    }
    listener.needsUpdate = true
}

function clearContext(listener) {
    delete listener.context
    delete listener.needsUpdate
}

/**
 * Called when a signal property is accessed. If this happens
 * inside a reactor function--computeStack is not empty--
 * then it adds the current reactor (top of this stack) to its
 * listeners. These are later called if this property changes
 */
function notifyGet(self, property) {
    if (disableTracking) {
        return
    }
    let currentCompute = computeStack[computeStack.length-1]
    if (currentCompute) {
        if (tracing && tracers.length) {
            callTracers('get', self, property)
        }
        // get was part of a react() function, so add it
        setListeners(self, property, currentCompute)
    }
}

/**
 * Keeps track of which update() functions are dependent on which
 * signal objects and which properties. Maps signals to update fns
 */
const listenersMap = new WeakMap()

/**
 * Keeps track of which signals and properties are linked to which
 * update functions. Maps update functions and properties to signals
 */
const computeMap = new WeakMap()

/**
 * Returns the update functions for a given signal and property
 */
function getListeners(self, property) {
    let listeners = listenersMap.get(self)
    return listeners ? Array.from(listeners.get(property) || []) : []
}

/**
 * Adds an update function (compute) to the list of listeners on
 * the given signal (self) and property
 */
function setListeners(self, property, compute) {
    if (!listenersMap.has(self)) {
        listenersMap.set(self, new Map())
    }
    let listeners = listenersMap.get(self)
    if (!listeners.has(property)) {
        listeners.set(property, new Set())
    }
    listeners.get(property).add(compute)

    if (!computeMap.has(compute)) {
        computeMap.set(compute, new Map())
    }
    let connectedSignals = computeMap.get(compute)
    if (!connectedSignals.has(property)) {
        connectedSignals.set(property, new Set)
    }
    connectedSignals.get(property).add(self)
}

/**
 * Removes alle listeners that trigger the given reactor function (compute)
 * This happens when a reactor is called, so that it can set new listeners
 * based on the current call (code path)
 */
function clearListeners(compute) {
    let connectedSignals = computeMap.get(compute)
    if (connectedSignals) {
        connectedSignals.forEach(property => {
            property.forEach(s => {
                let listeners = listenersMap.get(s)
                if (listeners.has(property)) {
                    listeners.get(property).delete(compute)
                }
            })
        })
    }
}

/**
 * The top most entry is the currently running update function, used
 * to automatically record signals used in an update function.
 */
let computeStack = []

/**
 * Used for cycle detection: effectStack contains all running effect
 * functions. If the same function appears twice in this stack, there
 * is a recursive update call, which would cause an infinite loop.
 */
const effectStack = []

const effectMap = new WeakMap()
/**
 * Used for cycle detection: signalStack contains all used signals. 
 * If the same signal appears more than once, there is a cyclical 
 * dependency between signals, which would cause an infinite loop.
 */
const signalStack = []

/**
 * Runs the given function at once, and then whenever a signal changes that
 * is used by the given function (or at least signals used in the previous run).
 */
export function effect(fn) {
    if (effectStack.findIndex(f => fn==f)!==-1) {
        throw new Error('Recursive update() call', {cause:fn})
    }
    effectStack.push(fn)

    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({
            current: null
        })
        signals.set(fn, connectedSignal)
    }

    // this is the function that is called automatically
    // whenever a signal dependency changes
    const computeEffect = function computeEffect() {
        if (signalStack.findIndex(s => s==connectedSignal)!==-1) {
            throw new Error('Cyclical dependency in update() call', { cause: fn})
        }
        // remove all dependencies (signals) from previous runs 
        clearListeners(computeEffect)
        computeEffect.effectFunction = fn
        computeEffect.effectType = effect
        // record new dependencies on this run
        computeStack.push(computeEffect)
        // prevent recursion
        signalStack.push(connectedSignal)
        // call the actual update function
        let result
        try {
            result = fn(computeEffect, computeStack, signalStack)
        } finally {
            // stop recording dependencies
            computeStack.pop()
            // stop the recursion prevention
            signalStack.pop()
            if (result instanceof Promise) {
                result.then((result) => {
                    connectedSignal.current = result
                })
            } else {
                connectedSignal.current = result
            }
        }
    }
    computeEffect.fn = fn
    effectMap.set(connectedSignal, computeEffect)

    // run the computEffect immediately upon creation
    computeEffect()
    return connectedSignal
}


export function destroy(connectedSignal) {
    // find the computeEffect associated with this signal
    const computeEffect = effectMap.get(connectedSignal)?.deref()
    if (!computeEffect) {
        return
    }

    // remove all listeners for this effect
    clearListeners(computeEffect)

    // remove all references to connectedSignal
    let fn = computeEffect.fn
    signals.remove(fn)

    effectMap.delete(connectedSignal)

    // if no other references to connectedSignal exist, it will be garbage collected
}

/**
 * Inside a batch() call, any changes to signals do not trigger effects
 * immediately. Instead, immediately after finishing the batch() call,
 * these effects will be called. Effects that are triggered by multiple
 * signals are called only once.
 * @param Function fn batch() calls this function immediately
 * @result mixed the result of the fn() function call
 */
export function batch(fn) {
    batchMode++
    let result
    try {
        result = fn()
    } finally {
        if (result instanceof Promise) {
            result.then(() => {
                batchMode--
                if (!batchMode) {
                    runBatchedListeners()
                }
            })
        } else {
            batchMode--
            if (!batchMode) {
                runBatchedListeners()
            }
        }
    }
    return result
}

function runBatchedListeners() {
    let copyBatchedListeners = Array.from(batchedListeners)
    batchedListeners = new Set()
    const currentEffect = computeStack[computeStack.length-1]
    for (let listener of copyBatchedListeners) {
        if (listener!=currentEffect && listener?.needsUpdate) {
            listener()
        }
        clearContext(listener)
    }
}

/**
 * A throttledEffect is run immediately once. And then only once
 * per throttleTime (in ms).
 * @param Function fn the effect function to run whenever a signal changes
 * @param int throttleTime in ms
 * @returns signal with the result of the effect function fn
 */
export function throttledEffect(fn, throttleTime) {
    if (effectStack.findIndex(f => fn==f)!==-1) {
        throw new Error('Recursive update() call', {cause:fn})
    }
    effectStack.push(fn)

    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({
            current: null
        })
        signals.set(fn, connectedSignal)
    }

    let throttled = false
    let hasChange = true
    // this is the function that is called automatically
    // whenever a signal dependency changes
    const computeEffect = function computeEffect() {
        if (signalStack.findIndex(s => s==connectedSignal)!==-1) {
            throw new Error('Cyclical dependency in update() call', { cause: fn})
        }
        if (throttled && throttled>Date.now()) {
            hasChange = true
            return
        }
        // remove all dependencies (signals) from previous runs 
        clearListeners(computeEffect)
        // record new dependencies on this run
        computeEffect.effectFunction = fn
        computeEffect.effectType = throttledEffect
        computeStack.push(computeEffect)
        // prevent recursion
        signalStack.push(connectedSignal)
        // call the actual update function
        let result
        try {
            result = fn(computeEffect, computeStack, signalStack)
        } finally {
            hasChange = false
            // stop recording dependencies
            computeStack.pop()
            // stop the recursion prevention
            signalStack.pop()
            if (result instanceof Promise) {
                result.then((result) => {
                    connectedSignal.current = result
                })
            } else {
                connectedSignal.current = result
            }
        }
        throttled = Date.now()+throttleTime
        globalThis.setTimeout(() => {
            if (hasChange) {
                computeEffect()
            }
        }, throttleTime)
    }
    // run the computEffect immediately upon creation
    computeEffect()
    return connectedSignal
}

// refactor: Class clock() with an effect() method
// keep track of effects per clock, and add clock property to the effect function
// on notifySet add clock.effects to clock.needsUpdate list
// on clock.tick() (or clock.time++) run only the clock.needsUpdate effects 
// (first create a copy and reset clock.needsUpdate, then run effects)
export function clockEffect(fn, clock) {
    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({
            current: null
        })
        signals.set(fn, connectedSignal)
    }

    let lastTick = -1 // clock.time should start at 0 or larger
    let hasChanged = true // make sure the first run goes through
    // this is the function that is called automatically
    // whenever a signal dependency changes
    const computeEffect = function computeEffect() {
        if (lastTick < clock.time) {
            if (hasChanged) {
                // remove all dependencies (signals) from previous runs 
                clearListeners(computeEffect)
                computeEffect.effectFunction = fn
                computeEffect.effectType = clockEffect
                // record new dependencies on this run
                computeStack.push(computeEffect)
                // make sure the clock.time signal is a dependency
                lastTick = clock.time
                // call the actual update function
                let result 
                try {
                    result = fn(computeEffect, computeStack)
                } finally {
                    // stop recording dependencies
                    computeStack.pop()
                    if (result instanceof Promise) {
                        result.then((result) => {
                            connectedSignal.current = result
                        })
                    } else {
                        connectedSignal.current = result
                    }
                    hasChanged = false
                }
            } else {
                lastTick = clock.time
            }
        } else {
            hasChanged = true
        }
    }
    // run the computEffect immediately upon creation
    computeEffect()
    return connectedSignal
}

let disableTracking = false
export function untracked(fn) {
    disableTracking = true
    try {
        return fn()
    } finally {
        disableTracking = false
    }
}

let seen = new WeakMap()

function innerUnwrap(ob) {
    if (!ob || typeof ob!=='object' || seen.has(ob)) {
        return
    }
    seen.set(ob, true)
    for (const prop in ob) {
        if (ob[prop]?.[Symbol.Signal]) {
            ob[prop] = ob[prop][Symbol.xRay]
        }
        if (Array.isArray(ob[prop])) {
            for (const [key, value] of Object.entries(ob[prop])) {
                if (value && typeof value==='object') {
                    innerUnwrap(value)
                }
            }
        } else if (ob[prop] && typeof ob[prop] === 'object') {
            innerUnwrap(ob[prop])
        }
    }
}

export function unwrap(ob) {
    if (ob && typeof ob==='object') {
        seen = new WeakMap()
        innerUnwrap(ob)
        seen = null
    }
}
