import { DEP } from './symbols.mjs'

const MAP_READS_KEY = new Set(['get', 'has'])
const MAP_READS_ITERATION = new Set(['keys', 'values', 'entries', 'forEach', Symbol.iterator])
const MAP_WRITES = new Set(['set', 'delete', 'clear'])
const SET_WRITES = new Set(['add', 'delete', 'clear'])
const SET_ITERATION_PROPERTIES = {
    entries: {},
    forEach: {},
    has: {},
    keys: {},
    values: {},
    [Symbol.iterator]: {}
}

function isObjectLike(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
}

/**
 * Returns true when value is a SimplyFlow signal proxy.
 *
 * @param {*} value Value to inspect.
 * @returns {boolean} True if value is a signal proxy, otherwise false.
 * @throws {never} Does not intentionally throw.
 */
export function isSignal(value) {
    return Boolean(isObjectLike(value) && value[DEP.SIGNAL])
}

/**
 * Returns the raw target for a signal, or value unchanged when it is not a signal.
 *
 * @param {*} value Signal or ordinary value.
 * @returns {*} The signal target, or the original value.
 * @throws {never} Does not intentionally throw.
 */
export function raw(value) {
    return isSignal(value) ? value[DEP.XRAY] : value
}

/**
 * Returns the existing signal proxy for value, if one has been registered.
 *
 * @param {*} value Raw target or signal proxy.
 * @returns {*} The existing signal proxy, the same signal when value is already a signal, or undefined.
 * @throws {never} Does not intentionally throw.
 */
export function getSignal(value) {
    return isSignal(value) ? value : signals.get(value)
}

function targetSignal(target) {
    return signals.get(target)
}

function readTarget(target, property) {
    // Reflect.get() uses the proxy as the receiver for accessors. That breaks
    // native Map/Set size getters and class getters that rely on private fields.
    return target?.[property]
}

function bindMethod(target, receiver, value) {
    if (
        target instanceof HTMLElement
        || target instanceof Number
        || target instanceof String
        || target instanceof Boolean
    ) {
        return value.bind(target)
    }

    // For user-defined classes, bind to the signal so method bodies remain
    // reactive when they read or write public properties through `this`.
    return value.bind(receiver)
}

function collectRemovedArrayValues(target, nextLength) {
    const values = new Map()
    if (!Array.isArray(target) || nextLength >= target.length) {
        return values
    }

    for (let index = nextLength; index < target.length; index++) {
        if (Object.hasOwn(target, index)) {
            values.set(index, target[index])
        }
    }
    return values
}

function addArrayLengthChanges(context, target, oldLength, removedValues = new Map()) {
    if (!Array.isArray(target) || oldLength === target.length) {
        return
    }

    context.set(DEP.LENGTH, { was: oldLength, now: target.length })
    context.set(DEP.ITERATE, {})

    // Directly shrinking .length deletes indexes without going through the
    // proxy's delete trap. Notify listeners of those indexes explicitly.
    for (const [index, oldValue] of removedValues) {
        context.set(String(index), { delete: true, was: oldValue, now: undefined })
    }
}

function notifyContext(receiver, context) {
    if (context.size) {
        notifySet(receiver, context)
    }
}

function wrapArrayMethod(target, property, receiver, value) {
    return (...args) => {
        const oldLength = target.length

        // Native array methods must run with the proxy as `this`. That lets
        // their internal get/set/delete operations pass through the proxy traps.
        const result = value.apply(receiver, args)

        if (oldLength !== target.length) {
            notifySet(receiver, makeContext(DEP.LENGTH, { was: oldLength, now: target.length }))
        }
        return result
    }
}

function wrapMapMethod(target, property, receiver, value) {
    return (...args) => {
        if (MAP_READS_KEY.has(property)) {
            notifyGet(receiver, args[0])
        }
        if (MAP_READS_ITERATION.has(property)) {
            notifyGet(receiver, DEP.ITERATE)
        }

        const oldSize = target.size
        const clearedEntries = property === 'clear' ? Array.from(target.entries()) : []
        const result = value.apply(target, args)
        const context = new Map()

        if (property === 'set') {
            context.set(args[0], { now: args[1] })
        }
        if (property === 'delete') {
            context.set(args[0], { delete: true })
        }
        if (property === 'clear') {
            for (const [key, oldValue] of clearedEntries) {
                context.set(key, { delete: true, was: oldValue, now: undefined })
            }
        }
        if (oldSize !== target.size) {
            context.set(DEP.SIZE, { was: oldSize, now: target.size })
        }
        if (MAP_WRITES.has(property) || oldSize !== target.size) {
            context.set(DEP.ITERATE, {})
        }

        notifyContext(receiver, context)
        return result
    }
}

function wrapSetMethod(target, property, receiver, value) {
    return (...args) => {
        const oldSize = target.size
        const result = value.apply(target, args)

        if (oldSize !== target.size) {
            notifySet(receiver, makeContext(DEP.SIZE, { was: oldSize, now: target.size }))
        }

        // Set.has(value) currently tracks at method level rather than per value.
        // Notify all Set read methods after writes so this remains correct.
        if (SET_WRITES.has(property)) {
            notifySet(receiver, makeContext(SET_ITERATION_PROPERTIES))
        }
        return result
    }
}

function propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue) {
    return (
        (Object.hasOwn(descriptor, 'value') && !Object.is(oldValue, newValue))
        || (Object.hasOwn(descriptor, 'get') && oldDescriptor?.get !== newDescriptor?.get)
        || (Object.hasOwn(descriptor, 'set') && oldDescriptor?.set !== newDescriptor?.set)
    )
}

const signalHandler = {
    get(target, property, receiver) {
        const value = readTarget(target, property)
        notifyGet(receiver, property)

        if (typeof value === 'function') {
            if (Array.isArray(target)) {
                return wrapArrayMethod(target, property, receiver, value)
            }
            if (target instanceof Map) {
                return wrapMapMethod(target, property, receiver, value)
            }
            if (target instanceof Set) {
                return wrapSetMethod(target, property, receiver, value)
            }
            return bindMethod(target, receiver, value)
        }

        return isObjectLike(value) ? signal(value) : value
    },

    set(target, property, value, receiver) {
        const hadOwn = Object.hasOwn(target, property)
        const oldLength = Array.isArray(target) ? target.length : undefined
        const removedValues = property === DEP.LENGTH
            ? collectRemovedArrayValues(target, Number(value))
            : new Map()
        const oldValue = target[property]

        target[property] = value

        const hasOwn = Object.hasOwn(target, property)
        const newValue = target[property]
        const context = new Map()

        if (!Object.is(oldValue, newValue) || (!hadOwn && hasOwn)) {
            context.set(property, { was: oldValue, now: newValue })
        }
        if (!hadOwn && hasOwn) {
            context.set(DEP.ITERATE, {})
        }

        addArrayLengthChanges(context, target, oldLength, removedValues)
        notifyContext(receiver, context)
        return true
    },

    has(target, property) {
        // The has trap has no receiver argument. Look up the stable proxy so
        // `property in signal` can still be tracked reactively.
        const receiver = targetSignal(target)
        if (receiver) {
            notifyGet(receiver, property)
        }
        return Reflect.has(target, property)
    },

    deleteProperty(target, property) {
        const hadOwn = Object.hasOwn(target, property)
        if (!hadOwn) {
            return true
        }

        const oldValue = target[property]
        const oldLength = Array.isArray(target) ? target.length : undefined
        const result = Reflect.deleteProperty(target, property)
        if (!result) {
            return result
        }

        const receiver = targetSignal(target)
        const context = makeContext(property, { delete: true, was: oldValue, now: undefined })
        context.set(DEP.ITERATE, { delete: true, property })
        addArrayLengthChanges(context, target, oldLength)
        notifySet(receiver, context)
        return result
    },

    defineProperty(target, property, descriptor) {
        const hadOwn = Object.hasOwn(target, property)
        const oldDescriptor = Object.getOwnPropertyDescriptor(target, property)
        const oldValue = target[property]
        const oldLength = Array.isArray(target) ? target.length : undefined
        const removedValues = property === DEP.LENGTH && Object.hasOwn(descriptor, 'value')
            ? collectRemovedArrayValues(target, Number(descriptor.value))
            : new Map()

        const result = Reflect.defineProperty(target, property, descriptor)
        if (!result) {
            return result
        }

        const hasOwn = Object.hasOwn(target, property)
        const newDescriptor = Object.getOwnPropertyDescriptor(target, property)
        const newValue = target[property]
        const context = new Map()

        if (!hadOwn && hasOwn) {
            context.set(property, { was: oldValue, now: newValue })
            context.set(DEP.ITERATE, {})
        } else if (hadOwn && hasOwn) {
            if (propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue)) {
                context.set(property, { was: oldValue, now: newValue })
            }
            if (oldDescriptor?.enumerable !== newDescriptor?.enumerable) {
                context.set(DEP.ITERATE, {})
            }
        }

        addArrayLengthChanges(context, target, oldLength, removedValues)
        notifyContext(targetSignal(target), context)
        return result
    },

    ownKeys(target) {
        const receiver = targetSignal(target)
        notifyGet(receiver, DEP.ITERATE)
        return Reflect.ownKeys(target)
    }
}

/**
 * Low-level registry for signal proxies and effect result signals.
 *
 * @type {WeakMap<object|Function, Proxy>}
 * @returns {WeakMap<object|Function, Proxy>} Maps raw targets to signals, and effect functions to result signals.
 * @throws {never} Reading this property does not throw.
 * @deprecated Prefer createSignal(), getSignal(), registerSignal(), isSignal(), and raw().
 */
export const signals = new WeakMap()

function assertSignalTarget(value, name) {
    if (!isObjectLike(value)) {
        throw new TypeError(
            `simplyflow/state: ${name}() expects an object, array, Map, Set, class instance, function, or DOM node; received ${typeof value}`
        )
    }
}

function assertProxyHandler(handler, name) {
    if (!handler || typeof handler !== 'object') {
        throw new TypeError(`simplyflow/state: ${name}() expects a Proxy handler object`)
    }
}

function signalProxyHandler(handler) {
    // All signal implementations must answer these two private symbol reads in
    // the same way. Keeping that boilerplate here lets custom signal handlers
    // focus on their own get/set/observe behavior.
    return {
        ...handler,
        get(target, property, receiver) {
            if (property === DEP.XRAY) {
                return target
            }
            if (property === DEP.SIGNAL) {
                return true
            }
            if (handler.get) {
                return handler.get(target, property, receiver)
            }
            return readTarget(target, property)
        }
    }
}

/**
 * Registers a custom signal proxy for a raw target.
 *
 * @param {object|Function} target Raw object, function, class instance, collection, or DOM node to register.
 * @param {Proxy} proxy Signal proxy that represents target.
 * @returns {Proxy} The registered proxy.
 * @throws {TypeError} If target is not object-like or proxy is not a signal.
 * @throws {Error} If target is already registered with a different signal.
 */
export function registerSignal(target, proxy) {
    const rawTarget = raw(target)
    assertSignalTarget(rawTarget, 'registerSignal')

    if (!isSignal(proxy)) {
        throw new TypeError('simplyflow/state: registerSignal() expects a signal proxy')
    }

    const existing = signals.get(rawTarget)
    if (existing && existing !== proxy) {
        throw new Error('simplyflow/state: registerSignal() target already has a different signal')
    }

    signals.set(rawTarget, proxy)
    return proxy
}

/**
 * Creates or returns a signal proxy using a custom Proxy handler.
 *
 * @param {object|Function} target Raw object, function, class instance, collection, or DOM node to wrap.
 * @param {ProxyHandler<object>} [handler={}] Custom proxy traps for the signal.
 * @param {Function} [init] Optional initializer called once with (target, proxy).
 * @returns {Proxy} Existing or newly created signal proxy for target.
 * @throws {TypeError} If target is not object-like, handler is not an object, or init is not a function.
 * @throws {*} Re-throws errors from init.
 */
export function createSignal(target, handler = {}, init) {
    assertSignalTarget(target, 'createSignal')
    assertProxyHandler(handler, 'createSignal')
    if (init !== undefined && typeof init !== 'function') {
        throw new TypeError('simplyflow/state: createSignal() expects init to be a function')
    }

    if (isSignal(target)) {
        return target
    }

    const existing = getSignal(target)
    if (existing) {
        return existing
    }

    const proxy = new Proxy(target, signalProxyHandler(handler))
    registerSignal(target, proxy)
    init?.(target, proxy)
    return proxy
}

/**
 * Creates a transparent reactive proxy for an object, collection, class instance, DOM node, or function.
 *
 * @param {object|Function} [value={}] Target to wrap.
 * @returns {Proxy} Existing or newly created signal proxy for value.
 * @throws {TypeError} If value is not object-like.
 */
export function signal(value = {}) {
    if (!isObjectLike(value)) {
        throw new TypeError(
            `simplyflow/state: signal() expects an object, array, Map, Set, class instance, or function; received ${typeof value}`
        )
    }
    return createSignal(value, signalHandler)
}

let tracers = []
let tracing = false

/**
 * Runs a traced function, or returns effects currently depending on a signal property.
 *
 * @param {Function|Proxy} target Function to run with tracing enabled, or signal to inspect.
 * @param {string|symbol|number} [prop] Signal property whose listeners should be returned.
 * @returns {*} Result of target() for traced functions, or an array of listener descriptions.
 * @throws {TypeError} If inspecting listeners and target is not a signal.
 * @throws {*} Re-throws errors from target() when tracing a function.
 */
export function trace(target, prop) {
    if (typeof target === 'function') {
        tracing = true
        try {
            return target()
        } finally {
            tracing = false
        }
    }

    if (!isSignal(target)) {
        throw new TypeError('simplyflow/state: trace() expects either a function or a signal')
    }

    return getListeners(target, prop).map(listener => ({
        effect: listener.effectType,
        fn: listener.effectFunction,
        signal: signals.get(listener.effectFunction)
    }))
}

/**
 * Adds an observer for dependency tracking events emitted inside trace(fn).
 *
 * @param {{get?: Function, set?: Function}} tracer Object with get and/or set callback functions.
 * @returns {void}
 * @throws {TypeError} If tracer is not an object.
 * @throws {Error} If tracer has no callbacks, or if a provided callback is not a function.
 */
export function addTracer(tracer) {
    if (!tracer || typeof tracer !== 'object') {
        throw new TypeError('simplyflow/state: addTracer() expects a tracer object')
    }
    if (!tracer.get && !tracer.set) {
        throw new Error('simplyflow/state: addTracer: missing "get" or "set" property in tracer')
    }
    if (tracer.get && typeof tracer.get !== 'function') {
        throw new Error('simplyflow/state: addTracer: "get" is not a function')
    }
    if (tracer.set && typeof tracer.set !== 'function') {
        throw new Error('simplyflow/state: addTracer: "set" is not a function')
    }
    tracers.push(tracer)
}

function callTracers(kind, ...params) {
    for (const tracer of tracers) {
        tracer[kind]?.(...params)
    }
}

let batchedListeners = new Set()
let batchDepth = 0

/**
 * Triggers effects that depend on the changed signal properties in context.
 *
 * @param {Proxy} self Signal whose properties changed.
 * @param {Map<string|symbol|number, object>} [context=new Map()] Change map, usually created with makeContext().
 * @returns {void}
 * @throws {TypeError} If self is not a signal or context is not a Map.
 */
export function notifySet(self, context = new Map()) {
    if (!isSignal(self)) {
        throw new TypeError('simplyflow/state: notifySet() expects a signal as first argument')
    }
    if (!(context instanceof Map)) {
        throw new TypeError('simplyflow/state: notifySet() expects context to be a Map; use makeContext()')
    }

    const listeners = new Set()
    context.forEach((change, property) => {
        for (const listener of listenersFor(self, property)) {
            // Avoid makeContext() here: notifySet() is a hot path and this loop
            // can run once per changed property per listener. Writing directly
            // to the listener context keeps object/Map keys intact and avoids
            // creating a short-lived Map for every listener notification.
            addContextChange(listener, property, change)
            listeners.add(listener)
        }
    })

    if (!listeners.size) {
        return
    }

    if (batchDepth) {
        for (const listener of listeners) {
            batchedListeners.add(listener)
        }
        return
    }

    runListeners(listeners, self, context)
}

/**
 * Creates a normalized change context map for notifySet().
 *
 * @param {Map|object|string|symbol|number} property Property name, property-to-change object, or existing context Map.
 * @param {object} [change] Change metadata when property names a single changed property.
 * @returns {Map<string|symbol|number, object>} Normalized change context.
 * @throws {never} Does not intentionally throw.
 */
export function makeContext(property, change) {
    const context = new Map()

    if (property instanceof Map) {
        property.forEach((change, prop) => context.set(prop, change))
        return context
    }

    if (property !== null && typeof property === 'object') {
        for (const prop of Reflect.ownKeys(property)) {
            context.set(prop, property[prop])
        }
    } else {
        context.set(property, change)
    }
    return context
}

function addContextChange(listener, property, change) {
    if (!listener.context) {
        listener.context = new Map()
    }
    listener.context.set(property, change)
    listener.needsUpdate = true
}

function clearContext(listener) {
    delete listener.context
    delete listener.needsUpdate
}

/**
 * Records a dependency on self[property] for the currently running effect.
 *
 * @param {Proxy} self Signal being read.
 * @param {string|symbol|number} property Property being read.
 * @returns {void}
 * @throws {never} Does not intentionally throw.
 */
export function notifyGet(self, property) {
    const currentCompute = computeStack[computeStack.length - 1]
    if (!currentCompute || currentCompute.skipDependency?.(self, property)) {
        return
    }

    if (tracing && tracers.length) {
        callTracers('get', self, property)
    }
    setListeners(self, property, currentCompute)
}

const listenersMap = new WeakMap()
const computeMap = new WeakMap()

const emptyListeners = new Set()

function listenersFor(self, property) {
    return listenersMap.get(self)?.get(property) || emptyListeners
}

function getListeners(self, property) {
    return Array.from(listenersFor(self, property))
}

function setListeners(self, property, compute) {
    if (!listenersMap.has(self)) {
        listenersMap.set(self, new Map())
    }
    const listeners = listenersMap.get(self)
    if (!listeners.has(property)) {
        listeners.set(property, new Set())
    }
    listeners.get(property).add(compute)

    if (!computeMap.has(compute)) {
        computeMap.set(compute, new Map())
    }
    const dependencies = computeMap.get(compute)
    if (!dependencies.has(property)) {
        dependencies.set(property, new Set())
    }
    dependencies.get(property).add(self)
}

function clearListeners(compute) {
    const dependencies = computeMap.get(compute)
    if (!dependencies) {
        return
    }

    dependencies.forEach((signals, property) => {
        signals.forEach(signal => {
            const listeners = listenersMap.get(signal)
            listeners?.get(property)?.delete(compute)
        })
    })

    computeMap.delete(compute)
}

const computeStack = []
const effectStack = []
const signalStack = []
const effectMap = new WeakMap()

function assertFunction(fn, name) {
    if (typeof fn !== 'function') {
        throw new TypeError(`simplyflow/state: ${name}() expects a function`)
    }
}

function assertNotRecursive(fn) {
    if (effectStack.includes(fn)) {
        throw new Error('Recursive update() call', { cause: fn })
    }
}

function effectSignal(fn) {
    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({ current: null })
        signals.set(fn, connectedSignal)
    }
    return connectedSignal
}

function setEffectResult(connectedSignal, result) {
    if (result instanceof Promise) {
        result.then(value => {
            connectedSignal.current = value
        })
    } else {
        connectedSignal.current = result
    }
}

function runTracked(compute, connectedSignal, fn, effectType, args = [compute, computeStack, signalStack]) {
    if (signalStack.includes(connectedSignal)) {
        throw new Error('Cyclical dependency in update() call', { cause: fn })
    }

    clearListeners(compute)
    compute.effectFunction = fn
    compute.effectType = effectType
    computeStack.push(compute)
    signalStack.push(connectedSignal)

    let result
    try {
        result = fn(...args)
    } finally {
        computeStack.pop()
        signalStack.pop()
        setEffectResult(connectedSignal, result)
    }
}

function runListeners(listeners, signal, context) {
    const currentEffect = computeStack[computeStack.length - 1]

    for (const listener of listeners) {
        if (listener !== currentEffect && listener?.needsUpdate) {
            if (listener.scheduleClock) {
                listener.scheduleClock()
            } else {
                if (signal && tracing && tracers.length) {
                    callTracers('set', signal, context, listener)
                }
                listener()
            }
        }
        clearContext(listener)
    }
}

/**
 * Runs fn immediately and reruns it synchronously when any signal property it reads changes.
 *
 * @param {Function} fn Effect function to run and track.
 * @returns {Proxy} Signal whose current property contains the latest effect result.
 * @throws {TypeError} If fn is not a function.
 * @throws {Error} If fn is already running recursively or creates a cyclic dependency.
 * @throws {*} Re-throws errors from fn during the initial run.
 */
export function effect(fn) {
    assertFunction(fn, 'effect')
    assertNotRecursive(fn)
    effectStack.push(fn)

    const connectedSignal = effectSignal(fn)
    const compute = function computeEffect() {
        runTracked(compute, connectedSignal, fn, effect)
    }
    compute.fn = fn
    effectMap.set(connectedSignal, compute)

    compute()
    return connectedSignal
}

/**
 * Stops an effect, clears its dependencies, and releases its reusable function mapping.
 *
 * @param {Proxy} connectedSignal Signal returned by effect(), throttledEffect(), or clockEffect().
 * @returns {void}
 * @throws {TypeError} If connectedSignal is not a signal.
 */
export function destroy(connectedSignal) {
    if (!isSignal(connectedSignal)) {
        throw new TypeError('simplyflow/state: destroy() expects an effect signal')
    }

    const compute = effectMap.get(connectedSignal)
    if (!compute) {
        return
    }

    compute.destroy?.()
    clearListeners(compute)

    if (compute.fn) {
        signals.delete(compute.fn)
        const index = effectStack.findIndex(fn => fn === compute.fn)
        if (index !== -1) {
            effectStack.splice(index, 1)
        }
    }

    effectMap.delete(connectedSignal)
}

/**
 * Runs fn while deferring effect execution until the outermost batch finishes.
 *
 * @param {Function} fn Function to run inside the batch.
 * @returns {*} The value returned by fn.
 * @throws {TypeError} If fn is not a function.
 * @throws {*} Re-throws errors from fn.
 */
export function batch(fn) {
    assertFunction(fn, 'batch')
    batchDepth++

    let result
    try {
        result = fn()
    } finally {
        const finish = () => {
            batchDepth--
            if (!batchDepth) {
                runBatchedListeners()
            }
        }

        if (result instanceof Promise) {
            result.then(finish, finish)
        } else {
            finish()
        }
    }
    return result
}

function runBatchedListeners() {
    const listeners = batchedListeners
    batchedListeners = new Set()

    // Batched clocked dependency changes must be marked before clock ticks are
    // flushed. Otherwise batch(() => { clock.time++; source.value++ }) would see
    // the tick first and leave the source change pending until the next tick.
    const clocked = new Set()
    const ready = new Set()
    for (const listener of listeners) {
        if (listener.scheduleClock) {
            clocked.add(listener)
        } else {
            ready.add(listener)
        }
    }

    runListeners(clocked)
    runListeners(ready)
}

/**
 * Runs fn as an effect, throttling reruns to at most once per throttleTime milliseconds.
 *
 * @param {Function} fn Effect function to run and track.
 * @param {number} throttleTime Minimum time in milliseconds between reruns after the initial run.
 * @returns {Proxy} Signal whose current property contains the latest effect result.
 * @throws {TypeError} If fn is not a function or throttleTime is not a non-negative finite number.
 * @throws {Error} If fn is already running recursively or creates a cyclic dependency.
 * @throws {*} Re-throws errors from fn during the initial run.
 */
export function throttledEffect(fn, throttleTime) {
    assertFunction(fn, 'throttledEffect')
    if (!Number.isFinite(throttleTime) || throttleTime < 0) {
        throw new TypeError('simplyflow/state: throttledEffect() expects throttleTime to be a non-negative number')
    }
    assertNotRecursive(fn)
    effectStack.push(fn)

    const connectedSignal = effectSignal(fn)
    let throttledUntil = 0
    let hasChange = true
    let timeout = null

    const compute = function computeEffect() {
        const now = Date.now()
        if (throttledUntil > now) {
            hasChange = true
            schedule()
            return
        }

        runTracked(compute, connectedSignal, fn, throttledEffect)
        hasChange = false
        throttledUntil = Date.now() + throttleTime
        schedule()
    }

    function schedule() {
        if (timeout) {
            return
        }

        const delay = Math.max(0, throttledUntil - Date.now())
        timeout = globalThis.setTimeout(() => {
            timeout = null
            if (hasChange) {
                compute()
            }
        }, delay)
    }

    compute.fn = fn
    compute.destroy = () => {
        if (timeout) {
            globalThis.clearTimeout(timeout)
            timeout = null
        }
        hasChange = false
    }
    effectMap.set(connectedSignal, compute)

    compute()
    return connectedSignal
}

const clockQueues = new WeakMap()

function readClockTime(clock) {
    return raw(clock).time
}

function getClockQueue(clock) {
    if (!clockQueues.has(clock)) {
        const queue = {
            clock,
            effects: new Set(),
            pending: new Set(),
            time: readClockTime(clock)
        }

        // A clock has exactly one listener on `.time`. Ordinary dependency
        // changes add clock effects to `pending`; the shared tick listener only
        // flushes that pending set after time increases. This avoids waking every
        // clockEffect on every clock tick just to discover most of them have no
        // pending changes.
        queue.tick = function tickClockEffects() {
            const time = readClockTime(clock)
            if (time <= queue.time) {
                return
            }

            queue.time = time
            const pending = Array.from(queue.pending)
            queue.pending.clear()

            for (const compute of pending) {
                compute.clockPending = false
                if (queue.effects.has(compute)) {
                    compute()
                }
            }
        }
        queue.tick.effectFunction = queue.tick
        queue.tick.effectType = clockEffect
        setListeners(clock, 'time', queue.tick)
        clockQueues.set(clock, queue)
    }

    return clockQueues.get(clock)
}

function detachClockEffect(compute) {
    const queue = compute.clockQueue
    if (!queue) {
        return
    }

    queue.pending.delete(compute)
    queue.effects.delete(compute)
    if (!queue.effects.size) {
        clearListeners(queue.tick)
        clockQueues.delete(queue.clock)
    }
}

/**
 * Tracks fn like an effect, but recomputes only after clock.time advances.
 *
 * @param {Function} fn Effect function to run and track.
 * @param {{time: number}} clock Clock object controlling when pending changes recompute.
 * @returns {Proxy} Signal whose current property contains the latest effect result.
 * @throws {TypeError} If fn is not a function or clock lacks a numeric time property.
 * @throws {*} Re-throws errors from fn during the initial run.
 */
export function clockEffect(fn, clock) {
    assertFunction(fn, 'clockEffect')
    if (!clock || typeof clock !== 'object' || typeof raw(clock).time !== 'number') {
        throw new TypeError('simplyflow/state: clockEffect() expects a clock object with a numeric .time property')
    }

    const clockSignal = isSignal(clock) ? clock : signal(raw(clock))
    const connectedSignal = effectSignal(fn)
    const queue = getClockQueue(clockSignal)

    const compute = function computeEffect() {
        clearListeners(compute)
        compute.effectFunction = fn
        compute.effectType = clockEffect
        computeStack.push(compute)

        let result
        try {
            result = fn(compute, computeStack)
        } finally {
            computeStack.pop()
            setEffectResult(connectedSignal, result)
        }
    }

    compute.fn = fn
    compute.clockQueue = queue
    compute.skipDependency = (self, property) => self === clockSignal && property === 'time'
    compute.scheduleClock = () => {
        if (!compute.clockPending) {
            compute.clockPending = true
            queue.pending.add(compute)
        }
    }
    compute.destroy = () => detachClockEffect(compute)

    queue.effects.add(compute)
    effectMap.set(connectedSignal, compute)

    compute()
    return connectedSignal
}

/**
 * Runs fn without recording signal reads as dependencies for the current effect.
 *
 * @param {Function} fn Function to run without dependency tracking.
 * @returns {*} The value returned by fn.
 * @throws {TypeError} If fn is not a function.
 * @throws {*} Re-throws errors from fn.
 */
export function untracked(fn) {
    assertFunction(fn, 'untracked')
    const index = computeStack.length - 1
    const current = computeStack[index]
    computeStack[index] = false
    try {
        return fn()
    } finally {
        computeStack[index] = current
    }
}

function cloneOptions(options) {
    if (typeof options === 'boolean') {
        return { deep: options }
    }
    if (options === undefined) {
        return { deep: true }
    }
    if (!options || typeof options !== 'object') {
        throw new TypeError('simplyflow/state: clone() expects options to be a boolean or object')
    }
    return { deep: options.deep !== false }
}

function typeName(value) {
    return value?.constructor?.name || Object.prototype.toString.call(value).slice(8, -1)
}

function isPlainObject(value) {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function isTypedArray(value) {
    return ArrayBuffer.isView(value) && !(value instanceof DataView)
}

function isIntegerKey(property) {
    if (typeof property !== 'string' || property === '') {
        return false
    }
    const index = Number(property)
    return Number.isInteger(index) && index >= 0 && String(index) === property
}

function hasToClone(value) {
    return typeof value.toClone === 'function'
}

function cannotClone(value, path) {
    throw new TypeError(
        `simplyflow/state: clone() cannot clone ${typeName(value)} at ${path}; add a toClone() method for custom objects`
    )
}

function cloneDescriptorProperties(source, result, cloneValue, skip = () => false) {
    const descriptors = Object.getOwnPropertyDescriptors(source)

    for (const key of Reflect.ownKeys(descriptors)) {
        if (skip(key)) {
            delete descriptors[key]
            continue
        }

        const descriptor = descriptors[key]
        // Accessor descriptors may hide state in closures or private fields.
        // Copying the accessor would not necessarily create an independent clone,
        // and reading it would execute user code. Custom objects that need this
        // should expose toClone() so they control how hidden state is copied.
        if (!Object.hasOwn(descriptor, 'value')) {
            cannotClone(source, String(key))
        }
        descriptor.value = cloneValue(descriptor.value, String(key))
    }

    Object.defineProperties(result, descriptors)
    return result
}

function cloneArrayBuffer(value) {
    return value.slice(0)
}

function cloneSharedArrayBuffer(value) {
    const result = new SharedArrayBuffer(value.byteLength)
    new Uint8Array(result).set(new Uint8Array(value))
    return result
}

function cloneErrorObject(value, cloneValue, path) {
    const standardErrors = new Set([
        Error,
        EvalError,
        RangeError,
        ReferenceError,
        SyntaxError,
        TypeError,
        URIError,
        typeof AggregateError === 'undefined' ? undefined : AggregateError
    ])

    if (!standardErrors.has(value.constructor)) {
        cannotClone(value, path)
    }

    const options = Object.hasOwn(value, 'cause')
        ? { cause: cloneValue(value.cause, 'cause') }
        : undefined

    if (typeof AggregateError !== 'undefined' && value instanceof AggregateError) {
        const errors = Array.from(value.errors || [], (error, index) => cloneValue(error, `errors.${index}`))
        return new AggregateError(errors, value.message, options)
    }

    return new value.constructor(value.message, options)
}

/**
 * Creates a non-reactive clone of a value or signal target.
 *
 * Deep-clones by default so nested signal data is not shared with the source. Built-in cloneable objects use their
 * native representation. Custom objects must provide toClone(); otherwise clone() throws instead of returning a
 * shared reference or copying only public properties.
 *
 * @param {*} value Value or signal target to clone.
 * @param {boolean|{deep?: boolean}} [options] false or { deep: false } keeps legacy shallow top-level cloning.
 * @returns {*} Non-reactive clone of value.
 * @throws {TypeError} If options are invalid, an unsupported object is encountered, an accessor property is found, or toClone() returns the original object.
 * @throws {*} Re-throws errors from custom toClone() methods.
 */
export function clone(value, options) {
    const { deep } = cloneOptions(options)
    const seen = new Map()

    function cloneChild(value, path) {
        return deep ? cloneValue(value, path) : raw(value)
    }

    function cloneValue(value, path = 'value') {
        const source = raw(value)

        if (!isObjectLike(source)) {
            return source
        }
        if (seen.has(source)) {
            return seen.get(source)
        }
        if (hasToClone(source)) {
            const result = raw(source.toClone())
            if (Object.is(result, source)) {
                throw new TypeError(`simplyflow/state: clone() toClone() returned the original object at ${path}`)
            }
            seen.set(source, result)
            return result
        }

        if (Array.isArray(source)) {
            const result = new Array(source.length)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild, key => key === 'length')
        }

        if (isPlainObject(source)) {
            const result = Object.create(Object.getPrototypeOf(source))
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (source instanceof Map) {
            const result = new Map()
            seen.set(source, result)
            source.forEach((mapValue, mapKey) => {
                result.set(cloneChild(mapKey, 'map key'), cloneChild(mapValue, 'map value'))
            })
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (source instanceof Set) {
            const result = new Set()
            seen.set(source, result)
            source.forEach(setValue => result.add(cloneChild(setValue, 'set value')))
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (source instanceof Date) {
            const result = new Date(source.getTime())
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (source instanceof RegExp) {
            const result = new RegExp(source.source, source.flags)
            result.lastIndex = source.lastIndex
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild, key => key === 'lastIndex')
        }

        if (source instanceof ArrayBuffer) {
            const result = cloneArrayBuffer(source)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (typeof SharedArrayBuffer !== 'undefined' && source instanceof SharedArrayBuffer) {
            const result = cloneSharedArrayBuffer(source)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (source instanceof DataView) {
            const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
            const result = new DataView(buffer)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild)
        }

        if (isTypedArray(source)) {
            const result = new source.constructor(source)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild, isIntegerKey)
        }

        if (typeof URL !== 'undefined' && source instanceof URL) {
            const result = new URL(source.href)
            seen.set(source, result)
            // Browser and jsdom URL objects can store implementation details in
            // own symbol properties. Copying those would couple the clone back
            // to the original, so the URL constructor is the complete clone.
            return result
        }

        if (typeof URLSearchParams !== 'undefined' && source instanceof URLSearchParams) {
            const result = new URLSearchParams(source)
            seen.set(source, result)
            return result
        }

        if (typeof File !== 'undefined' && source instanceof File) {
            const result = new File([source], source.name, {
                type: source.type,
                lastModified: source.lastModified
            })
            seen.set(source, result)
            return result
        }

        if (typeof Blob !== 'undefined' && source instanceof Blob) {
            const result = source.slice(0, source.size, source.type)
            seen.set(source, result)
            return result
        }

        if (source instanceof Error) {
            const result = cloneErrorObject(source, cloneChild, path)
            seen.set(source, result)
            return cloneDescriptorProperties(source, result, cloneChild, key => (
                key === 'message' || key === 'cause' || key === 'errors' || key === 'stack'
            ))
        }

        if (typeof Node !== 'undefined' && source instanceof Node && typeof source.cloneNode === 'function') {
            const result = source.cloneNode(deep)
            seen.set(source, result)
            return result
        }

        cannotClone(source, path)
    }

    return cloneValue(value)
}
