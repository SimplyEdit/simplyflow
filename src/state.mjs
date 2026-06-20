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

export function isSignal(value) {
    return Boolean(isObjectLike(value) && value[DEP.SIGNAL])
}

export function raw(value) {
    return isSignal(value) ? value[DEP.XRAY] : value
}

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
 * Stable proxy/effect lookup.
 *
 * - raw object/function -> signal proxy
 * - user effect function -> computed signal returned by effect()
 *
 * @deprecated Prefer createSignal(), getSignal(), registerSignal(), isSignal()
 * and raw(). This map stays exported for compatibility and for advanced code
 * that has not yet migrated to the explicit extension API.
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
 * Creates a transparent reactive proxy for an object, array, Map, Set, DOM
 * element, class instance or function. Primitive values are intentionally not
 * supported because reactivity is tracked through property access.
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
 * trace(fn) enables registered tracers while fn runs.
 * trace(signal, property) returns the effects currently depending on property.
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
 * Adds an observer for dependency tracking. Tracers only run inside trace(fn),
 * which keeps normal signal access fast and avoids accidental global logging.
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
        for (const listener of getListeners(self, property)) {
            addContext(listener, makeContext(property, change))
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

function addContext(listener, context) {
    if (!listener.context) {
        listener.context = context
    } else {
        context.forEach((change, property) => listener.context.set(property, change))
    }
    listener.needsUpdate = true
}

function clearContext(listener) {
    delete listener.context
    delete listener.needsUpdate
}

/**
 * Records a dependency on self[property] for the currently running effect.
 */
export function notifyGet(self, property) {
    const currentCompute = computeStack[computeStack.length - 1]
    if (!currentCompute) {
        return
    }

    if (tracing && tracers.length) {
        callTracers('get', self, property)
    }
    setListeners(self, property, currentCompute)
}

const listenersMap = new WeakMap()
const computeMap = new WeakMap()

function getListeners(self, property) {
    const listeners = listenersMap.get(self)
    return listeners ? Array.from(listeners.get(property) || []) : []
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

    for (const listener of Array.from(listeners)) {
        if (listener !== currentEffect && listener?.needsUpdate) {
            if (signal && tracing && tracers.length) {
                callTracers('set', signal, context, listener)
            }
            listener()
        }
        clearContext(listener)
    }
}

/**
 * Runs fn immediately, tracks every signal property it reads, and reruns it
 * synchronously when one of those properties changes.
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
 * Defers effect execution until the outermost batch has finished. Async batches
 * keep batching active until their returned promise settles.
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
    runListeners(listeners)
}

/**
 * Like effect(), but after the immediate first run it recomputes at most once
 * per throttleTime milliseconds.
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

/**
 * Tracks changes like effect(), but only recomputes after the supplied clock's
 * .time value advances. This lets callers coordinate expensive updates.
 */
export function clockEffect(fn, clock) {
    assertFunction(fn, 'clockEffect')
    if (!clock || typeof clock !== 'object' || typeof clock.time !== 'number') {
        throw new TypeError('simplyflow/state: clockEffect() expects a clock object with a numeric .time property')
    }

    const connectedSignal = effectSignal(fn)
    let lastTick = -1
    let hasChanged = true

    const compute = function computeEffect() {
        if (lastTick < clock.time) {
            if (hasChanged) {
                clearListeners(compute)
                compute.effectFunction = fn
                compute.effectType = clockEffect
                computeStack.push(compute)
                lastTick = clock.time

                let result
                try {
                    result = fn(compute, computeStack)
                } finally {
                    computeStack.pop()
                    setEffectResult(connectedSignal, result)
                    hasChanged = false
                }
            } else {
                lastTick = clock.time
            }
        } else {
            hasChanged = true
        }
    }
    compute.fn = fn
    effectMap.set(connectedSignal, compute)

    compute()
    return connectedSignal
}

/**
 * Runs fn without recording reads as dependencies for the current effect.
 * Writes inside fn still notify effects that already depend on those signals.
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
 * clone(value) now deep-clones by default, because a shallow clone of a signal
 * target can still share nested raw objects with the original signal. Passing
 * false keeps the legacy top-level clone behavior for callers that explicitly
 * want to preserve nested references.
 *
 * Built-in cloneable objects such as Array, Object, Map, Set, Date, RegExp,
 * ArrayBuffer, typed arrays, URL and DOM nodes are copied using their native
 * representation. Custom objects must provide toClone(); otherwise clone()
 * throws instead of silently copying public properties or returning a shared
 * reference.
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
