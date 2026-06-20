(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/state.mjs
  var state_exports = {};
  __export(state_exports, {
    addTracer: () => addTracer,
    batch: () => batch,
    clockEffect: () => clockEffect,
    clone: () => clone,
    createSignal: () => createSignal,
    destroy: () => destroy,
    effect: () => effect,
    getSignal: () => getSignal,
    isSignal: () => isSignal,
    makeContext: () => makeContext,
    notifyGet: () => notifyGet,
    notifySet: () => notifySet,
    raw: () => raw,
    registerSignal: () => registerSignal,
    signal: () => signal,
    signals: () => signals,
    throttledEffect: () => throttledEffect,
    trace: () => trace,
    untracked: () => untracked
  });

  // src/symbols.mjs
  var DEP = {
    ITERATE: Symbol.for("@simplyedit/simplyflow.iterate"),
    XRAY: Symbol.for("@simplyedit/simplyflow.xRay"),
    SIGNAL: Symbol.for("@simplyedit/simplyflow.Signal"),
    TEMPLATE: Symbol.for("@simplyedit/simplyflow.bindTemplate"),
    VALUE: Symbol.for("@simplyedit/simplyflow.bindValue"),
    LENGTH: "length",
    SIZE: "size"
  };

  // src/state.mjs
  var MAP_READS_KEY = /* @__PURE__ */ new Set(["get", "has"]);
  var MAP_READS_ITERATION = /* @__PURE__ */ new Set(["keys", "values", "entries", "forEach", Symbol.iterator]);
  var MAP_WRITES = /* @__PURE__ */ new Set(["set", "delete", "clear"]);
  var SET_WRITES = /* @__PURE__ */ new Set(["add", "delete", "clear"]);
  var SET_ITERATION_PROPERTIES = {
    entries: {},
    forEach: {},
    has: {},
    keys: {},
    values: {},
    [Symbol.iterator]: {}
  };
  function isObjectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  function isSignal(value) {
    return Boolean(isObjectLike(value) && value[DEP.SIGNAL]);
  }
  function raw(value) {
    return isSignal(value) ? value[DEP.XRAY] : value;
  }
  function getSignal(value) {
    return isSignal(value) ? value : signals.get(value);
  }
  function targetSignal(target) {
    return signals.get(target);
  }
  function readTarget(target, property) {
    return target?.[property];
  }
  function bindMethod(target, receiver, value) {
    if (target instanceof HTMLElement || target instanceof Number || target instanceof String || target instanceof Boolean) {
      return value.bind(target);
    }
    return value.bind(receiver);
  }
  function collectRemovedArrayValues(target, nextLength) {
    const values = /* @__PURE__ */ new Map();
    if (!Array.isArray(target) || nextLength >= target.length) {
      return values;
    }
    for (let index = nextLength; index < target.length; index++) {
      if (Object.hasOwn(target, index)) {
        values.set(index, target[index]);
      }
    }
    return values;
  }
  function addArrayLengthChanges(context, target, oldLength, removedValues = /* @__PURE__ */ new Map()) {
    if (!Array.isArray(target) || oldLength === target.length) {
      return;
    }
    context.set(DEP.LENGTH, { was: oldLength, now: target.length });
    context.set(DEP.ITERATE, {});
    for (const [index, oldValue] of removedValues) {
      context.set(String(index), { delete: true, was: oldValue, now: void 0 });
    }
  }
  function notifyContext(receiver, context) {
    if (context.size) {
      notifySet(receiver, context);
    }
  }
  function wrapArrayMethod(target, property, receiver, value) {
    return (...args) => {
      const oldLength = target.length;
      const result = value.apply(receiver, args);
      if (oldLength !== target.length) {
        notifySet(receiver, makeContext(DEP.LENGTH, { was: oldLength, now: target.length }));
      }
      return result;
    };
  }
  function wrapMapMethod(target, property, receiver, value) {
    return (...args) => {
      if (MAP_READS_KEY.has(property)) {
        notifyGet(receiver, args[0]);
      }
      if (MAP_READS_ITERATION.has(property)) {
        notifyGet(receiver, DEP.ITERATE);
      }
      const oldSize = target.size;
      const clearedEntries = property === "clear" ? Array.from(target.entries()) : [];
      const result = value.apply(target, args);
      const context = /* @__PURE__ */ new Map();
      if (property === "set") {
        context.set(args[0], { now: args[1] });
      }
      if (property === "delete") {
        context.set(args[0], { delete: true });
      }
      if (property === "clear") {
        for (const [key, oldValue] of clearedEntries) {
          context.set(key, { delete: true, was: oldValue, now: void 0 });
        }
      }
      if (oldSize !== target.size) {
        context.set(DEP.SIZE, { was: oldSize, now: target.size });
      }
      if (MAP_WRITES.has(property) || oldSize !== target.size) {
        context.set(DEP.ITERATE, {});
      }
      notifyContext(receiver, context);
      return result;
    };
  }
  function wrapSetMethod(target, property, receiver, value) {
    return (...args) => {
      const oldSize = target.size;
      const result = value.apply(target, args);
      if (oldSize !== target.size) {
        notifySet(receiver, makeContext(DEP.SIZE, { was: oldSize, now: target.size }));
      }
      if (SET_WRITES.has(property)) {
        notifySet(receiver, makeContext(SET_ITERATION_PROPERTIES));
      }
      return result;
    };
  }
  function propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue) {
    return Object.hasOwn(descriptor, "value") && !Object.is(oldValue, newValue) || Object.hasOwn(descriptor, "get") && oldDescriptor?.get !== newDescriptor?.get || Object.hasOwn(descriptor, "set") && oldDescriptor?.set !== newDescriptor?.set;
  }
  var signalHandler = {
    get(target, property, receiver) {
      const value = readTarget(target, property);
      notifyGet(receiver, property);
      if (typeof value === "function") {
        if (Array.isArray(target)) {
          return wrapArrayMethod(target, property, receiver, value);
        }
        if (target instanceof Map) {
          return wrapMapMethod(target, property, receiver, value);
        }
        if (target instanceof Set) {
          return wrapSetMethod(target, property, receiver, value);
        }
        return bindMethod(target, receiver, value);
      }
      return isObjectLike(value) ? signal(value) : value;
    },
    set(target, property, value, receiver) {
      const hadOwn = Object.hasOwn(target, property);
      const oldLength = Array.isArray(target) ? target.length : void 0;
      const removedValues = property === DEP.LENGTH ? collectRemovedArrayValues(target, Number(value)) : /* @__PURE__ */ new Map();
      const oldValue = target[property];
      target[property] = value;
      const hasOwn = Object.hasOwn(target, property);
      const newValue = target[property];
      const context = /* @__PURE__ */ new Map();
      if (!Object.is(oldValue, newValue) || !hadOwn && hasOwn) {
        context.set(property, { was: oldValue, now: newValue });
      }
      if (!hadOwn && hasOwn) {
        context.set(DEP.ITERATE, {});
      }
      addArrayLengthChanges(context, target, oldLength, removedValues);
      notifyContext(receiver, context);
      return true;
    },
    has(target, property) {
      const receiver = targetSignal(target);
      if (receiver) {
        notifyGet(receiver, property);
      }
      return Reflect.has(target, property);
    },
    deleteProperty(target, property) {
      const hadOwn = Object.hasOwn(target, property);
      if (!hadOwn) {
        return true;
      }
      const oldValue = target[property];
      const oldLength = Array.isArray(target) ? target.length : void 0;
      const result = Reflect.deleteProperty(target, property);
      if (!result) {
        return result;
      }
      const receiver = targetSignal(target);
      const context = makeContext(property, { delete: true, was: oldValue, now: void 0 });
      context.set(DEP.ITERATE, { delete: true, property });
      addArrayLengthChanges(context, target, oldLength);
      notifySet(receiver, context);
      return result;
    },
    defineProperty(target, property, descriptor) {
      const hadOwn = Object.hasOwn(target, property);
      const oldDescriptor = Object.getOwnPropertyDescriptor(target, property);
      const oldValue = target[property];
      const oldLength = Array.isArray(target) ? target.length : void 0;
      const removedValues = property === DEP.LENGTH && Object.hasOwn(descriptor, "value") ? collectRemovedArrayValues(target, Number(descriptor.value)) : /* @__PURE__ */ new Map();
      const result = Reflect.defineProperty(target, property, descriptor);
      if (!result) {
        return result;
      }
      const hasOwn = Object.hasOwn(target, property);
      const newDescriptor = Object.getOwnPropertyDescriptor(target, property);
      const newValue = target[property];
      const context = /* @__PURE__ */ new Map();
      if (!hadOwn && hasOwn) {
        context.set(property, { was: oldValue, now: newValue });
        context.set(DEP.ITERATE, {});
      } else if (hadOwn && hasOwn) {
        if (propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue)) {
          context.set(property, { was: oldValue, now: newValue });
        }
        if (oldDescriptor?.enumerable !== newDescriptor?.enumerable) {
          context.set(DEP.ITERATE, {});
        }
      }
      addArrayLengthChanges(context, target, oldLength, removedValues);
      notifyContext(targetSignal(target), context);
      return result;
    },
    ownKeys(target) {
      const receiver = targetSignal(target);
      notifyGet(receiver, DEP.ITERATE);
      return Reflect.ownKeys(target);
    }
  };
  var signals = /* @__PURE__ */ new WeakMap();
  function assertSignalTarget(value, name) {
    if (!isObjectLike(value)) {
      throw new TypeError(
        `simplyflow/state: ${name}() expects an object, array, Map, Set, class instance, function, or DOM node; received ${typeof value}`
      );
    }
  }
  function assertProxyHandler(handler, name) {
    if (!handler || typeof handler !== "object") {
      throw new TypeError(`simplyflow/state: ${name}() expects a Proxy handler object`);
    }
  }
  function signalProxyHandler(handler) {
    return {
      ...handler,
      get(target, property, receiver) {
        if (property === DEP.XRAY) {
          return target;
        }
        if (property === DEP.SIGNAL) {
          return true;
        }
        if (handler.get) {
          return handler.get(target, property, receiver);
        }
        return readTarget(target, property);
      }
    };
  }
  function registerSignal(target, proxy) {
    const rawTarget = raw(target);
    assertSignalTarget(rawTarget, "registerSignal");
    if (!isSignal(proxy)) {
      throw new TypeError("simplyflow/state: registerSignal() expects a signal proxy");
    }
    const existing = signals.get(rawTarget);
    if (existing && existing !== proxy) {
      throw new Error("simplyflow/state: registerSignal() target already has a different signal");
    }
    signals.set(rawTarget, proxy);
    return proxy;
  }
  function createSignal(target, handler = {}, init) {
    assertSignalTarget(target, "createSignal");
    assertProxyHandler(handler, "createSignal");
    if (init !== void 0 && typeof init !== "function") {
      throw new TypeError("simplyflow/state: createSignal() expects init to be a function");
    }
    if (isSignal(target)) {
      return target;
    }
    const existing = getSignal(target);
    if (existing) {
      return existing;
    }
    const proxy = new Proxy(target, signalProxyHandler(handler));
    registerSignal(target, proxy);
    init?.(target, proxy);
    return proxy;
  }
  function signal(value = {}) {
    if (!isObjectLike(value)) {
      throw new TypeError(
        `simplyflow/state: signal() expects an object, array, Map, Set, class instance, or function; received ${typeof value}`
      );
    }
    return createSignal(value, signalHandler);
  }
  var tracers = [];
  var tracing = false;
  function trace(target, prop) {
    if (typeof target === "function") {
      tracing = true;
      try {
        return target();
      } finally {
        tracing = false;
      }
    }
    if (!isSignal(target)) {
      throw new TypeError("simplyflow/state: trace() expects either a function or a signal");
    }
    return getListeners(target, prop).map((listener) => ({
      effect: listener.effectType,
      fn: listener.effectFunction,
      signal: signals.get(listener.effectFunction)
    }));
  }
  function addTracer(tracer) {
    if (!tracer || typeof tracer !== "object") {
      throw new TypeError("simplyflow/state: addTracer() expects a tracer object");
    }
    if (!tracer.get && !tracer.set) {
      throw new Error('simplyflow/state: addTracer: missing "get" or "set" property in tracer');
    }
    if (tracer.get && typeof tracer.get !== "function") {
      throw new Error('simplyflow/state: addTracer: "get" is not a function');
    }
    if (tracer.set && typeof tracer.set !== "function") {
      throw new Error('simplyflow/state: addTracer: "set" is not a function');
    }
    tracers.push(tracer);
  }
  function callTracers(kind, ...params) {
    for (const tracer of tracers) {
      tracer[kind]?.(...params);
    }
  }
  var batchedListeners = /* @__PURE__ */ new Set();
  var batchDepth = 0;
  function notifySet(self, context = /* @__PURE__ */ new Map()) {
    if (!isSignal(self)) {
      throw new TypeError("simplyflow/state: notifySet() expects a signal as first argument");
    }
    if (!(context instanceof Map)) {
      throw new TypeError("simplyflow/state: notifySet() expects context to be a Map; use makeContext()");
    }
    const listeners = /* @__PURE__ */ new Set();
    context.forEach((change, property) => {
      for (const listener of listenersFor(self, property)) {
        addContextChange(listener, property, change);
        listeners.add(listener);
      }
    });
    if (!listeners.size) {
      return;
    }
    if (batchDepth) {
      for (const listener of listeners) {
        batchedListeners.add(listener);
      }
      return;
    }
    runListeners(listeners, self, context);
  }
  function makeContext(property, change) {
    const context = /* @__PURE__ */ new Map();
    if (property instanceof Map) {
      property.forEach((change2, prop) => context.set(prop, change2));
      return context;
    }
    if (property !== null && typeof property === "object") {
      for (const prop of Reflect.ownKeys(property)) {
        context.set(prop, property[prop]);
      }
    } else {
      context.set(property, change);
    }
    return context;
  }
  function addContextChange(listener, property, change) {
    if (!listener.context) {
      listener.context = /* @__PURE__ */ new Map();
    }
    listener.context.set(property, change);
    listener.needsUpdate = true;
  }
  function clearContext(listener) {
    delete listener.context;
    delete listener.needsUpdate;
  }
  function notifyGet(self, property) {
    const currentCompute = computeStack[computeStack.length - 1];
    if (!currentCompute || currentCompute.skipDependency?.(self, property)) {
      return;
    }
    if (tracing && tracers.length) {
      callTracers("get", self, property);
    }
    setListeners(self, property, currentCompute);
  }
  var listenersMap = /* @__PURE__ */ new WeakMap();
  var computeMap = /* @__PURE__ */ new WeakMap();
  var emptyListeners = /* @__PURE__ */ new Set();
  function listenersFor(self, property) {
    return listenersMap.get(self)?.get(property) || emptyListeners;
  }
  function getListeners(self, property) {
    return Array.from(listenersFor(self, property));
  }
  function setListeners(self, property, compute) {
    if (!listenersMap.has(self)) {
      listenersMap.set(self, /* @__PURE__ */ new Map());
    }
    const listeners = listenersMap.get(self);
    if (!listeners.has(property)) {
      listeners.set(property, /* @__PURE__ */ new Set());
    }
    listeners.get(property).add(compute);
    if (!computeMap.has(compute)) {
      computeMap.set(compute, /* @__PURE__ */ new Map());
    }
    const dependencies = computeMap.get(compute);
    if (!dependencies.has(property)) {
      dependencies.set(property, /* @__PURE__ */ new Set());
    }
    dependencies.get(property).add(self);
  }
  function clearListeners(compute) {
    const dependencies = computeMap.get(compute);
    if (!dependencies) {
      return;
    }
    dependencies.forEach((signals2, property) => {
      signals2.forEach((signal3) => {
        const listeners = listenersMap.get(signal3);
        listeners?.get(property)?.delete(compute);
      });
    });
    computeMap.delete(compute);
  }
  var computeStack = [];
  var effectStack = [];
  var signalStack = [];
  var effectMap = /* @__PURE__ */ new WeakMap();
  function assertFunction(fn, name) {
    if (typeof fn !== "function") {
      throw new TypeError(`simplyflow/state: ${name}() expects a function`);
    }
  }
  function assertNotRecursive(fn) {
    if (effectStack.includes(fn)) {
      throw new Error("Recursive update() call", { cause: fn });
    }
  }
  function effectSignal(fn) {
    let connectedSignal = signals.get(fn);
    if (!connectedSignal) {
      connectedSignal = signal({ current: null });
      signals.set(fn, connectedSignal);
    }
    return connectedSignal;
  }
  function setEffectResult(connectedSignal, result) {
    if (result instanceof Promise) {
      result.then((value) => {
        connectedSignal.current = value;
      });
    } else {
      connectedSignal.current = result;
    }
  }
  function runTracked(compute, connectedSignal, fn, effectType, args = [compute, computeStack, signalStack]) {
    if (signalStack.includes(connectedSignal)) {
      throw new Error("Cyclical dependency in update() call", { cause: fn });
    }
    clearListeners(compute);
    compute.effectFunction = fn;
    compute.effectType = effectType;
    computeStack.push(compute);
    signalStack.push(connectedSignal);
    let result;
    try {
      result = fn(...args);
    } finally {
      computeStack.pop();
      signalStack.pop();
      setEffectResult(connectedSignal, result);
    }
  }
  function runListeners(listeners, signal3, context) {
    const currentEffect = computeStack[computeStack.length - 1];
    for (const listener of listeners) {
      if (listener !== currentEffect && listener?.needsUpdate) {
        if (listener.scheduleClock) {
          listener.scheduleClock();
        } else {
          if (signal3 && tracing && tracers.length) {
            callTracers("set", signal3, context, listener);
          }
          listener();
        }
      }
      clearContext(listener);
    }
  }
  function effect(fn) {
    assertFunction(fn, "effect");
    assertNotRecursive(fn);
    effectStack.push(fn);
    const connectedSignal = effectSignal(fn);
    const compute = function computeEffect() {
      runTracked(compute, connectedSignal, fn, effect);
    };
    compute.fn = fn;
    effectMap.set(connectedSignal, compute);
    compute();
    return connectedSignal;
  }
  function destroy(connectedSignal) {
    if (!isSignal(connectedSignal)) {
      throw new TypeError("simplyflow/state: destroy() expects an effect signal");
    }
    const compute = effectMap.get(connectedSignal);
    if (!compute) {
      return;
    }
    compute.destroy?.();
    clearListeners(compute);
    if (compute.fn) {
      signals.delete(compute.fn);
      const index = effectStack.findIndex((fn) => fn === compute.fn);
      if (index !== -1) {
        effectStack.splice(index, 1);
      }
    }
    effectMap.delete(connectedSignal);
  }
  function batch(fn) {
    assertFunction(fn, "batch");
    batchDepth++;
    let result;
    try {
      result = fn();
    } finally {
      const finish = () => {
        batchDepth--;
        if (!batchDepth) {
          runBatchedListeners();
        }
      };
      if (result instanceof Promise) {
        result.then(finish, finish);
      } else {
        finish();
      }
    }
    return result;
  }
  function runBatchedListeners() {
    const listeners = batchedListeners;
    batchedListeners = /* @__PURE__ */ new Set();
    const clocked = /* @__PURE__ */ new Set();
    const ready = /* @__PURE__ */ new Set();
    for (const listener of listeners) {
      if (listener.scheduleClock) {
        clocked.add(listener);
      } else {
        ready.add(listener);
      }
    }
    runListeners(clocked);
    runListeners(ready);
  }
  function throttledEffect(fn, throttleTime) {
    assertFunction(fn, "throttledEffect");
    if (!Number.isFinite(throttleTime) || throttleTime < 0) {
      throw new TypeError("simplyflow/state: throttledEffect() expects throttleTime to be a non-negative number");
    }
    assertNotRecursive(fn);
    effectStack.push(fn);
    const connectedSignal = effectSignal(fn);
    let throttledUntil = 0;
    let hasChange = true;
    let timeout = null;
    const compute = function computeEffect() {
      const now = Date.now();
      if (throttledUntil > now) {
        hasChange = true;
        schedule();
        return;
      }
      runTracked(compute, connectedSignal, fn, throttledEffect);
      hasChange = false;
      throttledUntil = Date.now() + throttleTime;
      schedule();
    };
    function schedule() {
      if (timeout) {
        return;
      }
      const delay = Math.max(0, throttledUntil - Date.now());
      timeout = globalThis.setTimeout(() => {
        timeout = null;
        if (hasChange) {
          compute();
        }
      }, delay);
    }
    compute.fn = fn;
    compute.destroy = () => {
      if (timeout) {
        globalThis.clearTimeout(timeout);
        timeout = null;
      }
      hasChange = false;
    };
    effectMap.set(connectedSignal, compute);
    compute();
    return connectedSignal;
  }
  var clockQueues = /* @__PURE__ */ new WeakMap();
  function readClockTime(clock) {
    return raw(clock).time;
  }
  function getClockQueue(clock) {
    if (!clockQueues.has(clock)) {
      const queue = {
        clock,
        effects: /* @__PURE__ */ new Set(),
        pending: /* @__PURE__ */ new Set(),
        time: readClockTime(clock)
      };
      queue.tick = function tickClockEffects() {
        const time = readClockTime(clock);
        if (time <= queue.time) {
          return;
        }
        queue.time = time;
        const pending = Array.from(queue.pending);
        queue.pending.clear();
        for (const compute of pending) {
          compute.clockPending = false;
          if (queue.effects.has(compute)) {
            compute();
          }
        }
      };
      queue.tick.effectFunction = queue.tick;
      queue.tick.effectType = clockEffect;
      setListeners(clock, "time", queue.tick);
      clockQueues.set(clock, queue);
    }
    return clockQueues.get(clock);
  }
  function detachClockEffect(compute) {
    const queue = compute.clockQueue;
    if (!queue) {
      return;
    }
    queue.pending.delete(compute);
    queue.effects.delete(compute);
    if (!queue.effects.size) {
      clearListeners(queue.tick);
      clockQueues.delete(queue.clock);
    }
  }
  function clockEffect(fn, clock) {
    assertFunction(fn, "clockEffect");
    if (!clock || typeof clock !== "object" || typeof raw(clock).time !== "number") {
      throw new TypeError("simplyflow/state: clockEffect() expects a clock object with a numeric .time property");
    }
    const clockSignal = isSignal(clock) ? clock : signal(raw(clock));
    const connectedSignal = effectSignal(fn);
    const queue = getClockQueue(clockSignal);
    const compute = function computeEffect() {
      clearListeners(compute);
      compute.effectFunction = fn;
      compute.effectType = clockEffect;
      computeStack.push(compute);
      let result;
      try {
        result = fn(compute, computeStack);
      } finally {
        computeStack.pop();
        setEffectResult(connectedSignal, result);
      }
    };
    compute.fn = fn;
    compute.clockQueue = queue;
    compute.skipDependency = (self, property) => self === clockSignal && property === "time";
    compute.scheduleClock = () => {
      if (!compute.clockPending) {
        compute.clockPending = true;
        queue.pending.add(compute);
      }
    };
    compute.destroy = () => detachClockEffect(compute);
    queue.effects.add(compute);
    effectMap.set(connectedSignal, compute);
    compute();
    return connectedSignal;
  }
  function untracked(fn) {
    assertFunction(fn, "untracked");
    const index = computeStack.length - 1;
    const current = computeStack[index];
    computeStack[index] = false;
    try {
      return fn();
    } finally {
      computeStack[index] = current;
    }
  }
  function cloneOptions(options) {
    if (typeof options === "boolean") {
      return { deep: options };
    }
    if (options === void 0) {
      return { deep: true };
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("simplyflow/state: clone() expects options to be a boolean or object");
    }
    return { deep: options.deep !== false };
  }
  function typeName(value) {
    return value?.constructor?.name || Object.prototype.toString.call(value).slice(8, -1);
  }
  function isPlainObject(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function isTypedArray(value) {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
  }
  function isIntegerKey(property) {
    if (typeof property !== "string" || property === "") {
      return false;
    }
    const index = Number(property);
    return Number.isInteger(index) && index >= 0 && String(index) === property;
  }
  function hasToClone(value) {
    return typeof value.toClone === "function";
  }
  function cannotClone(value, path) {
    throw new TypeError(
      `simplyflow/state: clone() cannot clone ${typeName(value)} at ${path}; add a toClone() method for custom objects`
    );
  }
  function cloneDescriptorProperties(source, result, cloneValue, skip = () => false) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (skip(key)) {
        delete descriptors[key];
        continue;
      }
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, "value")) {
        cannotClone(source, String(key));
      }
      descriptor.value = cloneValue(descriptor.value, String(key));
    }
    Object.defineProperties(result, descriptors);
    return result;
  }
  function cloneArrayBuffer(value) {
    return value.slice(0);
  }
  function cloneSharedArrayBuffer(value) {
    const result = new SharedArrayBuffer(value.byteLength);
    new Uint8Array(result).set(new Uint8Array(value));
    return result;
  }
  function cloneErrorObject(value, cloneValue, path) {
    const standardErrors = /* @__PURE__ */ new Set([
      Error,
      EvalError,
      RangeError,
      ReferenceError,
      SyntaxError,
      TypeError,
      URIError,
      typeof AggregateError === "undefined" ? void 0 : AggregateError
    ]);
    if (!standardErrors.has(value.constructor)) {
      cannotClone(value, path);
    }
    const options = Object.hasOwn(value, "cause") ? { cause: cloneValue(value.cause, "cause") } : void 0;
    if (typeof AggregateError !== "undefined" && value instanceof AggregateError) {
      const errors = Array.from(value.errors || [], (error, index) => cloneValue(error, `errors.${index}`));
      return new AggregateError(errors, value.message, options);
    }
    return new value.constructor(value.message, options);
  }
  function clone(value, options) {
    const { deep } = cloneOptions(options);
    const seen = /* @__PURE__ */ new Map();
    function cloneChild(value2, path) {
      return deep ? cloneValue(value2, path) : raw(value2);
    }
    function cloneValue(value2, path = "value") {
      const source = raw(value2);
      if (!isObjectLike(source)) {
        return source;
      }
      if (seen.has(source)) {
        return seen.get(source);
      }
      if (hasToClone(source)) {
        const result = raw(source.toClone());
        if (Object.is(result, source)) {
          throw new TypeError(`simplyflow/state: clone() toClone() returned the original object at ${path}`);
        }
        seen.set(source, result);
        return result;
      }
      if (Array.isArray(source)) {
        const result = new Array(source.length);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "length");
      }
      if (isPlainObject(source)) {
        const result = Object.create(Object.getPrototypeOf(source));
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Map) {
        const result = /* @__PURE__ */ new Map();
        seen.set(source, result);
        source.forEach((mapValue, mapKey) => {
          result.set(cloneChild(mapKey, "map key"), cloneChild(mapValue, "map value"));
        });
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Set) {
        const result = /* @__PURE__ */ new Set();
        seen.set(source, result);
        source.forEach((setValue) => result.add(cloneChild(setValue, "set value")));
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Date) {
        const result = new Date(source.getTime());
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof RegExp) {
        const result = new RegExp(source.source, source.flags);
        result.lastIndex = source.lastIndex;
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "lastIndex");
      }
      if (source instanceof ArrayBuffer) {
        const result = cloneArrayBuffer(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (typeof SharedArrayBuffer !== "undefined" && source instanceof SharedArrayBuffer) {
        const result = cloneSharedArrayBuffer(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof DataView) {
        const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        const result = new DataView(buffer);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (isTypedArray(source)) {
        const result = new source.constructor(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, isIntegerKey);
      }
      if (typeof URL !== "undefined" && source instanceof URL) {
        const result = new URL(source.href);
        seen.set(source, result);
        return result;
      }
      if (typeof URLSearchParams !== "undefined" && source instanceof URLSearchParams) {
        const result = new URLSearchParams(source);
        seen.set(source, result);
        return result;
      }
      if (typeof File !== "undefined" && source instanceof File) {
        const result = new File([source], source.name, {
          type: source.type,
          lastModified: source.lastModified
        });
        seen.set(source, result);
        return result;
      }
      if (typeof Blob !== "undefined" && source instanceof Blob) {
        const result = source.slice(0, source.size, source.type);
        seen.set(source, result);
        return result;
      }
      if (source instanceof Error) {
        const result = cloneErrorObject(source, cloneChild, path);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "message" || key === "cause" || key === "errors" || key === "stack");
      }
      if (typeof Node !== "undefined" && source instanceof Node && typeof source.cloneNode === "function") {
        const result = source.cloneNode(deep);
        seen.set(source, result);
        return result;
      }
      cannotClone(source, path);
    }
    return cloneValue(value);
  }

  // src/bind.transformers.mjs
  function escape_html(context, next) {
    let content = context.value?.innerHTML;
    if (typeof context.value == "string") {
      content = context.value;
      context.value = { innerHTML: content };
    }
    if (content) {
      content = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      context.value.innerHTML = content;
    }
    next(context);
  }
  function fixed_content(context, next) {
    if (typeof context.value == "string") {
      context.value = {};
    } else {
      delete context.value?.innerHTML;
    }
    next(context);
  }

  // src/dom.mjs
  var dom_exports = {};
  __export(dom_exports, {
    signal: () => signal2,
    trackDomField: () => trackDomField,
    trackDomList: () => trackDomList
  });
  var domSignals = /* @__PURE__ */ new WeakMap();
  var observers = /* @__PURE__ */ new WeakMap();
  var domSignalHandler = {
    get: (target, property, receiver) => {
      const value = target?.[property];
      notifyGet(receiver, property);
      if (typeof value === "function") {
        return value.bind(target);
      }
      if (value && typeof value == "object") {
        return signal(value);
      }
      return value;
    },
    set: (target, property, value, receiver) => {
      const current = target[property];
      target[property] = value;
      const now = target[property];
      if (!Object.is(current, now)) {
        notifySet(receiver, makeContext(property, { was: current, now }));
      }
      return true;
    },
    has: (target, property) => {
      const receiver = getSignal(target);
      if (receiver) {
        notifyGet(receiver, property);
      }
      return Reflect.has(target, property);
    },
    ownKeys: (target) => {
      const receiver = getSignal(target);
      if (receiver) {
        notifyGet(receiver, DEP.ITERATE);
      }
      return Reflect.ownKeys(target);
    }
  };
  function signal2(el, options) {
    if (isSignal(el)) {
      return el;
    }
    const existing = getSignal(el);
    if (existing) {
      return existing;
    }
    return createSignal(el, domSignalHandler, (target, proxy) => {
      domListen(target, proxy, options);
    });
  }
  function domListen(el, signal3, options) {
    const defaultOptions = {
      characterData: true,
      subtree: true,
      attributes: true,
      attributesOldValue: true,
      childList: true
    };
    if (!options) {
      options = defaultOptions;
    }
    let oldContentHTML = el.innerHTML;
    let oldContentText = el.innerText;
    if (!observers.has(el)) {
      const observer = new MutationObserver((mutationList, observer2) => {
        const changes = {};
        for (const mutation of mutationList) {
          if (mutation.type === "attributes") {
            changes[mutation.attributeName] = mutation.attributeOldValue;
          } else if (mutation.type === "subtree" || mutation.type === "characterData") {
            if (el.innerHTML != oldContentHTML) {
              changes.innerHTML = oldContentHTML;
              oldContentHTML = el.innerHTML;
            }
            if (el.innerText != oldContentText) {
              changes.innerText = oldContentText;
              oldContentText = el.innerText;
            }
          } else if (mutation.type === "childList") {
            changes.children = {
              //FIXME: overwrites changes in this list path if list is rendered multiple times
              was: Array.from(el.children)
              //FIXME; fill in 'now'
            };
            changes.length = -1;
            if (el.innerHTML != oldContentHTML) {
              changes.innerHTML = oldContentHTML;
              oldContentHTML = el.innerHTML;
            }
            if (el.innerText != oldContentText) {
              changes.innerText = oldContentText;
              oldContentText = el.innerText;
            }
          } else {
            console.log("nothing to do for", el, mutation.type);
          }
        }
        for (const prop in changes) {
          notifySet(signal3, makeContext(prop, { was: changes[prop], now: el[prop] }));
        }
      });
      observer.observe(el, options);
      observers.set(el, observer);
      if (el.matches("input, textarea, select")) {
        let prevValue = el.value;
        el.addEventListener("change", (evt) => {
          notifySet(signal3, makeContext("value", { was: prevValue, now: el.value }));
          prevValue = el.value;
        });
        if (el.matches("input, textarea")) {
          el.addEventListener("input", (evt) => {
            notifySet(signal3, makeContext("value", { was: prevValue, now: el.value }));
            prevValue = el.value;
          });
        }
      }
    }
  }
  function trackDomList(element2) {
    const path = this.getBindingPath(element2);
    if (!path) {
      throw new Error("Could not find binding path for element", { cause: element2 });
    }
    const s = signal2(element2, {
      childList: true
    });
    throttledEffect(() => {
      const children = Array.from(s.children);
      untracked(() => {
        batch(() => {
          let key = 0;
          const currentList = getValueByPath(this.options.root, path);
          const source = currentList.slice();
          for (const item of children) {
            if (item.tagName === "TEMPLATE") {
              continue;
            }
            if (item.dataset.flowKey) {
              if (item.dataset.flowKey != key) {
                setValueByPath(
                  this.options.root,
                  path + "." + key,
                  source[item.dataset.flowKey]
                );
              }
              key++;
            }
          }
          if (currentList.length > key) {
            currentList.length = key;
          }
        });
      });
    }, 50);
    return s;
  }
  function trackDomField(element2, props, valueIsString) {
    if (domSignals.has(element2)) {
      return;
    }
    const path = this.getBindingPath(element2);
    if (!path) {
      throw new Error("Could not find binding path for element", { cause: element2 });
    }
    const s = signal2(element2);
    domSignals.set(element2, s);
    batch(() => {
      throttledEffect(() => {
        let updateValue = s.innerHTML;
        if (!valueIsString) {
          updateValue = getProperties(s, ...props);
        }
        untracked(() => {
          setValueByPath(this.options.root, path, updateValue);
        });
      }, 50);
    });
    return s;
  }

  // src/bind.render.mjs
  function field(context) {
    if (context.templates?.length) {
      fieldByTemplates.call(this, context);
    } else if (Object.hasOwnProperty.call(this.options.renderers, context.element.tagName)) {
      const renderer = this.options.renderers[context.element.tagName];
      if (renderer) {
        renderer.call(this, context);
      }
    } else if (this.options.renderers["*"]) {
      this.options.renderers["*"].call(this, context);
    }
    return context;
  }
  function list(context) {
    if (!Array.isArray(context.value)) {
      context.value = [context.value];
    }
    const length = context.value.length;
    if (!context.templates?.length) {
      console.error("No templates found in", context.element);
    } else {
      arrayByTemplates.call(this, context);
    }
    return context;
  }
  function map(context) {
    if (typeof context.value != "object" || !context.value) {
      console.error("Value is not an object.", context.element, context.path, context.value);
    } else if (!context.templates?.length) {
      console.error("No templates found in", context.element);
    } else {
      objectByTemplates.call(this, context);
    }
    return context;
  }
  function isInt(s) {
    if (parseInt(s) == s) {
      return true;
    }
  }
  function setValueByPath(root, path, value) {
    batch(() => {
      let parts = path.split(".");
      let curr = root;
      let part;
      part = parts.shift();
      let prev = null;
      let prevPart = null;
      let prevCurr = curr;
      while (part && curr) {
        prevCurr = curr;
        part = decodeURIComponent(part);
        if (part == "0" && !Array.isArray(curr)) {
        } else if (part == ":key") {
          throw new Error("setting key not yet supported");
          curr = prevPart;
        } else if (part == ":value") {
        } else if (Array.isArray(curr) && !isInt(part) && typeof curr[part] == "undefined") {
          prev = curr[0];
          curr = curr[0][part];
        } else {
          prev = curr;
          curr = curr[part];
        }
        prevPart = part;
        part = parts.shift();
        if (part && !curr) {
          const intKey = parseInt(part);
          if (intKey >= 0 && part === "" + intKey) {
            prevCurr[prevPart] = [];
          } else {
            prevCurr[prevPart] = {};
          }
          curr = prevCurr[prevPart];
        }
      }
      if (prev && prevPart && prev[prevPart] !== value) {
        if (value && typeof value == "object") {
          curr = prev[prevPart];
          if (!curr) {
            prev[prevPart] = {};
            curr = prev[prevPart];
          }
          for (const prop in value) {
            if (curr[prop] !== value[prop]) {
              curr[prop] = value[prop];
            }
          }
        } else {
          prev[prevPart] = value;
        }
      }
    });
  }
  function arrayByTemplates(context) {
    const attribute = this.options.attribute;
    const attributes = [attribute + "-field", attribute + "-list", attribute + "-map"];
    const attrQuery = "[" + attributes.join("],[") + "]";
    const keyAttribute = attribute + "-key";
    const items = Array.from(context.element.querySelectorAll(":scope > [" + keyAttribute + "]"));
    const usedItems = /* @__PURE__ */ new Set();
    let cursor = 0;
    context.list = context.value;
    for (let index = 0; index < context.value.length; index++) {
      context.index = index;
      const value = context.list[index];
      let item = nextUnusedItem(items, usedItems, cursor);
      if (!item) {
        context.element.appendChild(this.applyTemplate(context));
        continue;
      }
      const newTemplate = this.findTemplate(context.templates, value);
      const currentValueMatches = item[DEP.VALUE] === value;
      let reusableItem = currentValueMatches ? item : findReusableItem(items, usedItems, value, newTemplate, cursor + 1);
      if (reusableItem) {
        if (newTemplate != reusableItem[DEP.TEMPLATE]) {
          context.element.replaceChild(this.applyTemplate(context), reusableItem);
        } else {
          context.element.insertBefore(reusableItem, item);
          updateItemKey(reusableItem, index, context.path, keyAttribute, attributes, attrQuery);
          reusableItem[DEP.VALUE] = value;
        }
        usedItems.add(reusableItem);
        if (reusableItem === item) {
          cursor++;
        }
        continue;
      }
      context.element.insertBefore(this.applyTemplate(context), item);
    }
    for (let item of items) {
      if (!usedItems.has(item)) {
        item.remove();
      }
    }
    if (this.options.twoway) {
      trackDomList.call(this, context.element);
    }
  }
  function nextUnusedItem(items, usedItems, start) {
    while (start < items.length) {
      const item = items[start];
      if (!usedItems.has(item)) {
        return item;
      }
      start++;
    }
  }
  function findReusableItem(items, usedItems, value, template, start) {
    for (let i = start; i < items.length; i++) {
      const item = items[i];
      if (!usedItems.has(item) && item[DEP.VALUE] === value && item[DEP.TEMPLATE] === template) {
        return item;
      }
    }
  }
  function updateItemKey(item, key, path, keyAttribute, attributes, attrQuery) {
    const oldKey = item.getAttribute(keyAttribute);
    const newKey = "" + key;
    if (oldKey === newKey) {
      return;
    }
    item.setAttribute(keyAttribute, newKey);
    const oldPrefix = path + "." + oldKey;
    const newPrefix = path + "." + newKey;
    const bindings = Array.from(item.querySelectorAll(attrQuery));
    if (item.matches(attrQuery)) {
      bindings.unshift(item);
    }
    for (let binding of bindings) {
      for (let attr of attributes) {
        const bindPath = binding.getAttribute(attr);
        if (!bindPath || bindPath.substr(0, 5) === ":root") {
          continue;
        }
        if (bindPath === oldPrefix) {
          binding.setAttribute(attr, newPrefix);
        } else if (bindPath.startsWith(oldPrefix + ".")) {
          binding.setAttribute(attr, newPrefix + bindPath.substr(oldPrefix.length));
        }
      }
    }
  }
  function objectByTemplates(context) {
    const attribute = this.options.attribute;
    const attributes = [attribute + "-field", attribute + "-list", attribute + "-map"];
    const attrQuery = "[" + attributes.join("],[") + "]";
    const keyAttribute = attribute + "-key";
    const items = Array.from(context.element.querySelectorAll(":scope > [" + keyAttribute + "]"));
    const usedItems = /* @__PURE__ */ new Set();
    let cursor = 0;
    context.list = context.value;
    for (let key in context.list) {
      context.index = key;
      const value = context.list[key];
      let item = nextUnusedItem(items, usedItems, cursor);
      if (!item) {
        context.element.appendChild(this.applyTemplate(context));
        continue;
      }
      const newTemplate = this.findTemplate(context.templates, value);
      let reusableItem;
      if (item.getAttribute(keyAttribute) === key) {
        reusableItem = item;
      } else {
        reusableItem = findItemByKey(items, usedItems, key, keyAttribute) || findReusableItem(items, usedItems, value, newTemplate, cursor);
      }
      if (reusableItem) {
        if (newTemplate != reusableItem[DEP.TEMPLATE]) {
          context.element.replaceChild(this.applyTemplate(context), reusableItem);
        } else {
          context.element.insertBefore(reusableItem, item);
          updateItemKey(reusableItem, key, context.path, keyAttribute, attributes, attrQuery);
          reusableItem[DEP.VALUE] = value;
        }
        usedItems.add(reusableItem);
        if (reusableItem === item) {
          cursor++;
        }
        continue;
      }
      context.element.insertBefore(this.applyTemplate(context), item);
    }
    for (let item of items) {
      if (!usedItems.has(item)) {
        item.remove();
      }
    }
  }
  function findItemByKey(items, usedItems, key, keyAttribute) {
    const stringKey = "" + key;
    for (let item of items) {
      if (!usedItems.has(item) && item.getAttribute(keyAttribute) === stringKey) {
        return item;
      }
    }
  }
  function fieldByTemplates(context) {
    const rendered = context.element.querySelector(":scope > :not(template)");
    const template = this.findTemplate(context.templates, context.value);
    context.parent = getParentPath(context.element);
    if (rendered) {
      if (template) {
        if (rendered?.[DEP.TEMPLATE] != template) {
          const clone2 = this.applyTemplate(context);
          context.element.replaceChild(clone2, rendered);
        }
      } else {
        context.element.removeChild(rendered);
      }
    } else if (template) {
      const clone2 = this.applyTemplate(context);
      context.element.appendChild(clone2);
    }
  }
  function getParentPath(el, attribute) {
    const parentEl = el.parentElement?.closest(`[${attribute}-list],[${attribute}-map]`);
    if (!parentEl) {
      return "";
    }
    if (parentEl.hasAttribute(`${attribute}-list`)) {
      return parentEl.getAttribute(`${attribute}-list`) + ".";
    }
    return parentEl.getAttribute(`${attribute}-map`) + ".";
  }
  function input(context) {
    const el = context.element;
    let value = context.value;
    element.call(this, context);
    if (typeof value == "undefined") {
      value = "";
    }
    if (el.type == "checkbox" || el.type == "radio") {
      if (matchValue(el.value, value)) {
        el.checked = true;
      } else {
        el.checked = false;
      }
    } else if (!matchValue(el.value, value)) {
      el.value = "" + value;
    }
  }
  function button(context) {
    element.call(this, context, "value");
  }
  function select(context) {
    const el = context.element;
    let value = context.value;
    if (value === null) {
      value = "";
    }
    if (Array.isArray(value)) {
      for (let option of el.options) {
        option.selected = value.some((selected) => matchValue(option.value, selected));
        if (option.selected) {
          option.setAttribute("selected", true);
        } else {
          option.removeAttribute("selected");
        }
      }
    } else if (typeof value != "object") {
      let option = Array.from(el.options).find((o) => matchValue(o.value, value));
      if (option) {
        option.selected = true;
        option.setAttribute("selected", true);
      }
    } else {
      if (value.options) {
        setSelectOptions(el, value.options);
      }
      if (typeof value.selected !== "undefined") {
        select(Object.assign({}, context, { value: value.selected }));
      }
      setProperties(el, value, "name", "id", "selectedIndex", "className");
    }
  }
  function addOption(select2, option) {
    if (!option) {
      return;
    }
    if (typeof option !== "object") {
      select2.options.add(new Option("" + option));
    } else if (option.text) {
      select2.options.add(new Option(option.text, option.value, option.defaultSelected, option.selected));
    } else if (typeof option.value != "undefined") {
      select2.options.add(new Option("" + option.value, option.value, option.defaultSelected, option.selected));
    }
  }
  function setSelectOptions(select2, options) {
    select2.innerHTML = "";
    if (Array.isArray(options)) {
      for (const option of options) {
        addOption(select2, option);
      }
    } else if (options && typeof options == "object") {
      for (const option in options) {
        addOption(select2, { text: options[option], value: option });
      }
    }
  }
  function anchor(context) {
    element.call(this, context, "target", "href", "name", "newwindow", "nofollow");
    if (this.options.twoway) {
      batch(() => {
        updateProperties.call(this, context, ["target", "href", "name", "newwindow", "nofollow"]);
      });
    }
  }
  function image(context) {
    setProperties(context.element, context.value, "title", "alt", "src", "id");
    if (this.options.twoway) {
      batch(() => {
        updateProperties.call(this, context, ["title", "alt", "src", "id"]);
      });
    }
  }
  function iframe(context) {
    setProperties(context.element, context.value, "title", "src", "id");
    if (this.options.twoway) {
      batch(() => {
        updateProperties.call(this, context, ["title", "src", "id"]);
      });
    }
  }
  function meta(context) {
    setProperties(context.element, context.value, "content", "id");
    if (this.options.twoway) {
      batch(() => {
        updateProperties.call(this, context, ["content", "id"]);
      });
    }
  }
  function element(context, ...extraprops) {
    const el = context.element;
    let value = context.value;
    let valueIsString = false;
    if (typeof value != "undefined" && value !== null) {
      let strValue = "" + value;
      if (typeof value != "object" || strValue.substring(0, 8) != "[object ") {
        value = { innerHTML: value };
        valueIsString = true;
      }
    }
    const props = ["innerHTML", "title", "id", "className"].concat(extraprops);
    setProperties(el, value, ...props);
    if (this.options.twoway) {
      trackDomField.call(this, context.element, props, valueIsString);
    }
  }
  function setProperties(el, data, ...properties) {
    if (!data || typeof data !== "object") {
      return;
    }
    for (const property of properties) {
      if (typeof data[property] === "undefined") {
        continue;
      }
      if (matchValue(el[property], data[property])) {
        continue;
      }
      if (data[property] === null) {
        el[property] = "";
      } else {
        el[property] = "" + data[property];
      }
    }
  }
  function updateProperties(context, properties) {
    trackDomField.call(this, context.element, properties, false);
  }
  function getProperties(el, ...properties) {
    const result = {};
    for (const property of properties) {
      switch (property) {
        default:
          result[property] = el[property];
          break;
      }
    }
    return result;
  }
  function matchValue(a, b) {
    if (a == ":empty" && !b) {
      return true;
    }
    if (b == ":empty" && !a) {
      return true;
    }
    if ("" + a == "" + b) {
      return true;
    }
    return false;
  }

  // src/bind.mjs
  var SimplyBind = class {
    /**
     * @param Object options - a set of options for this instance, options may include:
     *  - root (signal) (required) - the root data object that contains al signals that can be bound
     *  - container (HTMLElement) - the dom element to use as the root for all bindings
     *  - attribute (string) - the prefix for the field, list and map attributes, e.g. 'data-bind'
     *  - transformers (object name:function) - a map of transformer names and functions
     *  - render (object with field, list and map properties)
     */
    constructor(options) {
      this.bindings = /* @__PURE__ */ new Map();
      const defaultTransformers = {
        escape_html,
        fixed_content
      };
      const defaultOptions = {
        container: document.body,
        attribute: "data-flow",
        transformers: defaultTransformers,
        render: {
          field: [field],
          list: [list],
          map: [map]
        },
        renderers: {
          "INPUT": input,
          "TEXTAREA": input,
          "BUTTON": button,
          "SELECT": select,
          "A": anchor,
          "IMG": image,
          "IFRAME": iframe,
          "META": meta,
          "TEMPLATE": null,
          "*": element
        },
        twoway: false
      };
      if (!options?.root) {
        throw new Error("bind needs at least options.root set");
      }
      this.options = Object.assign({}, defaultOptions, options);
      if (options.transformers) {
        this.options.transformers = Object.assign({}, defaultTransformers, options?.transformers);
      }
      const attribute = this.options.attribute;
      const bindAttributes = [attribute + "-field", attribute + "-list", attribute + "-map"];
      const transformAttribute = attribute + "-transform";
      const getBindingAttribute = (el) => {
        const foundAttribute = bindAttributes.find((attr) => el.hasAttribute(attr));
        if (!foundAttribute) {
          console.error("No matching attribute found", el, bindAttributes);
        }
        return foundAttribute;
      };
      const renderElement = (el) => {
        this.bindings.set(el, throttledEffect(() => {
          if (!el.isConnected) {
            untrack(el, this.getBindingPath(el));
            const binding = this.bindings.get(el);
            if (binding) {
              destroy(binding);
              this.bindings.delete(el);
            }
            return;
          }
          let context = {
            templates: el.querySelectorAll(":scope > template"),
            attribute: getBindingAttribute(el)
          };
          context.path = this.getBindingPath(el);
          context.value = getValueByPath(this.options.root, context.path);
          context.element = el;
          track(el, context);
          runTransformers(context);
        }, 50));
      };
      const runTransformers = (context) => {
        let transformers;
        switch (context.attribute) {
          case this.options.attribute + "-field":
            transformers = Array.from(this.options.render.field);
            break;
          case this.options.attribute + "-list":
            transformers = Array.from(this.options.render.list);
            break;
          case this.options.attribute + "-map":
            transformers = Array.from(this.options.render.map);
            break;
          default:
            throw new Error("no valid context attribute specified", context);
            break;
        }
        if (context.element.hasAttribute(transformAttribute)) {
          context.element.getAttribute(transformAttribute).split(" ").filter(Boolean).forEach((t) => {
            if (this.options.transformers[t]) {
              transformers.push(this.options.transformers[t]);
            } else {
              console.warn("No transformer with name " + t + " configured", { cause: context.element });
            }
          });
        }
        let next;
        for (let transformer of transformers) {
          next = /* @__PURE__ */ ((next2, transformer2) => {
            return (context2) => {
              return transformer2.call(this, context2, next2);
            };
          })(next, transformer);
        }
        next(context);
      };
      const applyBindings = (bindings2) => {
        for (let bindingEl of bindings2) {
          if (!this.bindings.get(bindingEl)) {
            renderElement(bindingEl);
          }
        }
      };
      const updateBindings = (changes) => {
        const selector = `[${attribute}-field],[${attribute}-list],[${attribute}-map]`;
        for (const change of changes) {
          if (change.type == "childList" && change.addedNodes) {
            for (let node of change.addedNodes) {
              if (node instanceof HTMLElement) {
                let bindings2 = Array.from(node.querySelectorAll(selector));
                if (node.matches(selector)) {
                  bindings2.unshift(node);
                }
                if (bindings2.length) {
                  applyBindings(bindings2);
                }
              }
            }
          }
        }
      };
      this.observer = new MutationObserver((changes) => {
        updateBindings(changes);
      });
      this.observer.observe(this.options.container, {
        subtree: true,
        childList: true
      });
      const bindings = this.options.container.querySelectorAll(
        ":is([" + this.options.attribute + "-field],[" + this.options.attribute + "-list],[" + this.options.attribute + "-map]):not(template)"
      );
      try {
        if (bindings.length) {
          applyBindings(bindings);
        }
      } catch (error) {
        this.destroy();
        throw error;
      }
    }
    /**
     * Finds the first matching template and creates a new DocumentFragment
     * with the correct data bind attributes in it (prepends the current path)
     * @param Context context
     * @return DocumentFragment
     */
    applyTemplate(context) {
      const path = context.path;
      const parent = context.parent;
      const templates = context.templates;
      const list2 = context.list;
      const index = context.index;
      const value = list2 ? list2[index] : context.value;
      let template = this.findTemplate(templates, value);
      if (!template) {
        let result = new DocumentFragment();
        result.innerHTML = "<!-- no matching template -->";
        return result;
      }
      let clone2 = template.content.cloneNode(true);
      if (!clone2.children?.length) {
        return clone2;
      }
      if (clone2.children.length > 1) {
        throw new Error("template must contain a single root node", { cause: template });
      }
      const attribute = this.options.attribute;
      const attributes = [attribute + "-field", attribute + "-list", attribute + "-map"];
      const bindings = clone2.querySelectorAll(`[${attribute}-field],[${attribute}-list],[${attribute}-map]`);
      for (let binding of bindings) {
        if (binding.tagName == "TEMPLATE") {
          continue;
        }
        const attr = attributes.find((attr2) => binding.hasAttribute(attr2));
        let bind2 = binding.getAttribute(attr);
        bind2 = this.applyLinks(template.links, bind2);
        if (bind2.substring(0, ":root.".length) == ":root.") {
          binding.setAttribute(attr, bind2.substring(":root.".length));
        } else if (bind2 == ":value" && index != null) {
          binding.setAttribute(attr, path + "." + index);
        } else if (index != null) {
          binding.setAttribute(attr, path + "." + index + "." + bind2);
        } else {
          binding.setAttribute(attr, parent + bind2);
        }
      }
      if (typeof index !== "undefined") {
        clone2.children[0].setAttribute(attribute + "-key", index);
      }
      clone2.children[0][DEP.TEMPLATE] = template;
      clone2.children[0][DEP.VALUE] = value;
      return clone2;
    }
    parseLinks(links) {
      let result = {};
      links = links.split(";").map((link) => link.trim());
      for (let link of links) {
        link = link.split("=");
        result[link[0].trim()] = link[1].trim();
      }
      return result;
    }
    applyLinks(links, value) {
      for (let link in links) {
        if (value.startsWith(link + ".")) {
          return links[link] + value.substr(link.length);
        } else if (value == link) {
          return links[link];
        }
      }
      return value;
    }
    /**
     * Returns the path referenced in either the field, list or map attribute
     * @param HTMLElement el
     * @return string The path referenced, or void
     */
    getBindingPath(el) {
      const attributes = [
        this.options.attribute + "-field",
        this.options.attribute + "-list",
        this.options.attribute + "-map"
      ];
      for (let attr of attributes) {
        if (el.hasAttribute(attr)) {
          return el.getAttribute(attr);
        }
      }
    }
    /**
     * Finds the first template from an array of templates that
     * matches the given value. 
     */
    findTemplate(templates, value) {
      const templateMatches = (t) => {
        let path = this.getBindingPath(t);
        let currentItem;
        if (path) {
          if (path.substr(0, 6) == ":root.") {
            currentItem = getValueByPath(this.options.root, path.substring(6));
          } else {
            currentItem = getValueByPath(value, path);
          }
        } else {
          currentItem = value;
        }
        const strItem = "" + currentItem;
        let matches = t.getAttribute(this.options.attribute + "-match");
        if (matches) {
          if (matches === ":empty" && !currentItem) {
            return t;
          } else if (matches === ":notempty" && currentItem) {
            return t;
          }
          if (strItem == matches) {
            return t;
          }
        }
        if (!matches) {
          return t;
        }
      };
      let template = Array.from(templates).find(templateMatches);
      let links = null;
      if (template?.hasAttribute(this.options.attribute + "-link")) {
        links = this.parseLinks(template.getAttribute(this.options.attribute + "-link"));
      }
      let rel = template?.getAttribute("rel");
      if (rel) {
        let replacement = document.querySelector("template#" + rel);
        if (!replacement) {
          throw new Error("Could not find template with id " + rel);
        }
        template = replacement;
      }
      if (template) {
        template.links = links;
      }
      return template;
    }
    destroy() {
      this.bindings.forEach((binding, element2) => {
        untrack(element2, this.getBindingPath(element2));
        destroy(binding);
      });
      this.bindings = /* @__PURE__ */ new Map();
      this.observer.disconnect();
    }
  };
  function bind(options) {
    return new SimplyBind(options);
  }
  var tracking = /* @__PURE__ */ new Map();
  function track(el, context) {
    untrack(el);
    if (!tracking.has(context.path)) {
      tracking.set(context.path, [context]);
    } else {
      tracking.get(context.path).push(context);
    }
  }
  function untrack(el, path) {
    if (path) {
      let list2 = tracking.get(path);
      if (list2) {
        list2 = list2.filter((context) => context.element !== el);
        tracking.set(path, list2);
      }
      return;
    }
    tracking.forEach((list2, trackedPath) => {
      list2 = list2.filter((context) => context.element !== el);
      tracking.set(trackedPath, list2);
    });
  }
  function getValueByPath(root, path) {
    let parts = path.split(".");
    let curr = root;
    let part;
    part = parts.shift();
    let prevPart = null;
    while (part && curr) {
      part = decodeURIComponent(part);
      if (part == "0" && !Array.isArray(curr)) {
      } else if (part == ":key") {
        curr = prevPart;
      } else if (part == ":value") {
      } else if (Array.isArray(curr) && typeof curr[part] == "undefined" && curr[0]) {
        curr = curr[0][part];
      } else {
        curr = curr[part];
      }
      prevPart = part;
      part = parts.shift();
    }
    return curr;
  }

  // src/model.mjs
  var model_exports = {};
  __export(model_exports, {
    columns: () => columns,
    filter: () => filter,
    model: () => model,
    paging: () => paging,
    scroll: () => scroll,
    sort: () => sort
  });
  var SimplyFlowModel = class {
    /**
     * Creates a new datamodel, with a state property that contains
     * all the data passed to this constructor
     * @param state	Object with all the data for this model
     * @throws Error if state is not set
     */
    constructor(state) {
      if (!state) {
        throw new Error("no options set");
      }
      if (state.data == null || typeof state.data[Symbol.iterator] !== "function") {
        console.warn("SimplyFlowModel: options.data is not iterable");
      }
      this.state = signal(state);
      if (!this.state.options) {
        this.state.options = {};
      }
      this.effects = [{ current: this.state.data }];
      this.view = {
        current: this.state.data
      };
    }
    /**
     * Adds an effect to run whenever a signal it depends on
     * changes. this.state is the usual signal.
     * The `fn` function param is not itself an effect, but must return
     * and effect function. `fn` takes one param, which is the data signal.
     * This signal will always have at least a `current` property.
     * The result of the effect function is pushed on to the this.effects
     * list. And the last effect added is set as this.view
     */
    addEffect(fn) {
      if (!fn || typeof fn !== "function") {
        throw new Error("addEffect requires an effect function as its parameter", { cause: fn });
      }
      const dataSignal = this.effects[this.effects.length - 1];
      const connectedSignal = fn.call(this, dataSignal);
      if (!isSignal(connectedSignal)) {
        throw new Error("addEffect function parameter must return a Signal", { cause: fn });
      }
      this.view = connectedSignal;
      this.effects.push(this.view);
    }
  };
  function model(options) {
    return new SimplyFlowModel(options);
  }
  function sort(options = {}) {
    return function(data) {
      this.state.options.sort = Object.assign({
        direction: "asc",
        sortBy: null,
        sortFn: (a, b) => {
          const sort2 = this.state.options.sort;
          const sortBy = sort2.sortBy;
          if (!sort2.sortBy) {
            return 0;
          }
          const direction = sort2.sortDirection || sort2.direction || "asc";
          const larger = direction == "asc" ? 1 : -1;
          const smaller = direction == "asc" ? -1 : 1;
          if (typeof a?.[sortBy] === "undefined") {
            if (typeof b?.[sortBy] === "undefined") {
              return 0;
            }
            return larger;
          }
          if (typeof b?.[sortBy] === "undefined") {
            return smaller;
          }
          if (a[sortBy] < b[sortBy]) {
            return smaller;
          } else if (a[sortBy] > b[sortBy]) {
            return larger;
          } else {
            return 0;
          }
        }
      }, options);
      return throttledEffect(() => {
        const sort2 = this.state.options.sort;
        const direction = sort2?.sortDirection || sort2?.direction;
        if (sort2?.sortBy && direction) {
          const trackedSortFn = sort2.sortFn;
          const sortFn = raw(sort2).sortFn || trackedSortFn;
          return data.current.toSorted((a, b) => sortFn.call(this, a, b));
        }
        return data.current;
      }, 50);
    };
  }
  function paging(options = {}) {
    return function(data) {
      this.state.options.paging = Object.assign({
        page: 1,
        pageSize: 20,
        max: 1
      }, options);
      return throttledEffect(() => {
        return batch(() => {
          const paging2 = this.state.options.paging;
          if (!paging2.pageSize) {
            paging2.pageSize = 20;
          }
          paging2.max = Math.ceil(data.current.length / paging2.pageSize);
          paging2.page = Math.max(1, Math.min(paging2.max, paging2.page));
          const start = (paging2.page - 1) * paging2.pageSize;
          const end = start + paging2.pageSize;
          return data.current.slice(start, end);
        });
      }, 50);
    };
  }
  function filter(options) {
    if (!options?.name || typeof options.name !== "string") {
      throw new Error("filter requires options.name to be a string");
    }
    if (!options.matches || typeof options.matches !== "function") {
      throw new Error("filter requires options.matches to be a function");
    }
    return function(data) {
      if (this.state.options[options.name]) {
        throw new Error("a filter with this name already exists on this model");
      }
      this.state.options[options.name] = options;
      return throttledEffect(() => {
        const filterOptions = this.state.options[options.name];
        if (filterOptions.enabled) {
          const trackedMatches = filterOptions.matches;
          const matches = raw(filterOptions).matches || trackedMatches;
          return data.current.filter((row) => matches.call(this, row));
        }
        return data.current;
      }, 50);
    };
  }
  function columns(options = {}) {
    const columnOptions = options?.columns && typeof options.columns === "object" ? options.columns : options;
    if (!columnOptions || typeof columnOptions !== "object" || Object.keys(columnOptions).length === 0) {
      throw new Error("columns requires options to be an object with at least one property");
    }
    return function(data) {
      this.state.options.columns = columnOptions;
      return throttledEffect(() => {
        return data.current.map((input2) => {
          let result = {};
          for (let key of Object.keys(this.state.options.columns)) {
            if (!this.state.options.columns[key]?.hidden) {
              result[key] = input2[key] ?? null;
            }
          }
          return result;
        });
      }, 50);
    };
  }
  function scroll(options) {
    return function(data) {
      this.state.options.scroll = Object.assign({
        offset: 0,
        rowHeight: 26,
        rowCount: 20,
        itemsPerRow: 1,
        size: data.current.length
      }, options);
      const scrollOptions = this.state.options.scroll;
      const scrollbar = scrollOptions.scrollbar || scrollOptions.container?.querySelector("[data-flow-scrollbar]");
      if (scrollbar) {
        if (scrollOptions.container) {
          scrollOptions.container.addEventListener("scroll", (evt) => {
            scrollOptions.offset = Math.floor(
              scrollOptions.container.scrollTop / (scrollOptions.rowHeight * scrollOptions.itemsPerRow)
            );
          });
        }
        throttledEffect(() => {
          scrollOptions.size = data.current.length * scrollOptions.rowHeight;
          scrollbar.style.height = scrollOptions.size + "px";
        }, 50);
      }
      return throttledEffect(() => {
        if (scrollOptions.container) {
          scrollOptions.rowCount = Math.ceil(
            scrollOptions.container.getBoundingClientRect().height / scrollOptions.rowHeight
          );
        }
        scrollOptions.data = data.current;
        let start = Math.min(scrollOptions.offset, data.current.length - 1);
        let end = start + scrollOptions.rowCount;
        if (end > data.current.length) {
          end = data.current.length;
          start = end - scrollOptions.rowCount;
        }
        return data.current.slice(start, end);
      }, 50);
    };
  }

  // src/render.mjs
  var SimplyRender = class extends HTMLElement {
    constructor() {
      super();
    }
    connectedCallback() {
      let templateId = this.getAttribute("rel");
      let template = document.getElementById(templateId);
      if (template) {
        let content = template.content.cloneNode(true);
        for (const node of content.childNodes) {
          const clone2 = node.cloneNode(true);
          if (clone2.nodeType == document.ELEMENT_NODE) {
            clone2.querySelectorAll("template").forEach(function(t) {
              t.setAttribute("simply-render", "");
            });
            if (this.attributes) {
              for (const attr of this.attributes) {
                if (attr.name != "rel") {
                  clone2.setAttribute(attr.name, attr.value);
                }
              }
            }
          }
          this.parentNode.insertBefore(clone2, this);
        }
        this.parentNode.removeChild(this);
      } else {
        const observe = () => {
          const observer = new MutationObserver(() => {
            template = document.getElementById(templateId);
            if (template) {
              observer.disconnect();
              this.replaceWith(this);
            }
          });
          observer.observe(globalThis.document, {
            subtree: true,
            childList: true
          });
        };
        observe();
      }
    }
  };
  if (!customElements.get("simply-render")) {
    customElements.define("simply-render", SimplyRender);
  }

  // src/flow.mjs
  if (!globalThis.simply) {
    globalThis.simply = {};
  }
  Object.assign(globalThis.simply, {
    bind,
    flow: model_exports,
    state: state_exports,
    dom: dom_exports
  });
  var flow_default = globalThis.simply;
})();
