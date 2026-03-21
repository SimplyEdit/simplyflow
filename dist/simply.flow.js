(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/state.mjs
  var state_exports = {};
  __export(state_exports, {
    batch: () => batch,
    clockEffect: () => clockEffect,
    destroy: () => destroy,
    effect: () => effect,
    signal: () => signal,
    throttledEffect: () => throttledEffect,
    trace: () => trace,
    untracked: () => untracked
  });
  var iterate = Symbol("iterate");
  if (!Symbol.xRay) {
    Symbol.xRay = Symbol("xRay");
  }
  if (!Symbol.Signal) {
    Symbol.Signal = Symbol("Signal");
  }
  var signalHandler = {
    get: (target, property, receiver) => {
      if (property === Symbol.xRay) {
        return target;
      }
      if (property === Symbol.Signal) {
        return true;
      }
      const value = target?.[property];
      notifyGet(receiver, property);
      if (typeof value === "function") {
        if (Array.isArray(target)) {
          return (...args) => {
            let l = target.length;
            let result = value.apply(receiver, args);
            if (l != target.length) {
              notifySet(receiver, makeContext("length", { was: l, now: target.length }));
            }
            return result;
          };
        } else if (target instanceof Set || target instanceof Map) {
          return (...args) => {
            let s = target.size;
            let result = value.apply(target, args);
            if (s != target.size) {
              notifySet(receiver, makeContext("size", { was: s, now: target.size }));
            }
            if (["set", "add", "clear", "delete"].includes(property)) {
              notifySet(receiver, makeContext({ entries: {}, forEach: {}, has: {}, keys: {}, values: {}, [Symbol.iterator]: {} }));
            }
            return result;
          };
        } else if (target instanceof HTMLElement || target instanceof Number || target instanceof String || target instanceof Boolean) {
          return value.bind(target);
        } else {
          return value.bind(receiver);
        }
      }
      if (value && typeof value == "object") {
        return signal(value);
      }
      return value;
    },
    set: (target, property, value, receiver) => {
      value = value?.[Symbol.xRay] || value;
      let current = target[property];
      if (current !== value) {
        target[property] = value;
        notifySet(receiver, makeContext(property, { was: current, now: value }));
      }
      if (typeof current === "undefined") {
        notifySet(receiver, makeContext(iterate, {}));
      }
      return true;
    },
    has: (target, property) => {
      let receiver = signals.get(target);
      if (receiver) {
        notifyGet(receiver, property);
      }
      return Object.hasOwn(target, property);
    },
    deleteProperty: (target, property) => {
      if (typeof target[property] !== "undefined") {
        let current = target[property];
        delete target[property];
        let receiver = signals.get(target);
        notifySet(receiver, makeContext(property, { delete: true, was: current }));
      }
      return true;
    },
    defineProperty: (target, property, descriptor) => {
      if (typeof target[property] === "undefined") {
        let receiver = signals.get(target);
        notifySet(receiver, makeContext(iterate, {}));
      }
      return Object.defineProperty(target, property, descriptor);
    },
    ownKeys: (target) => {
      let receiver = signals.get(target);
      notifyGet(receiver, iterate);
      return Reflect.ownKeys(target);
    }
  };
  var signals = /* @__PURE__ */ new WeakMap();
  function signal(v) {
    if (v[Symbol.Signal]) {
      let target = v[Symbol.xRay];
      if (!signals.has(target)) {
        signals.set(target, v);
      }
      v = target;
    } else if (!signals.has(v)) {
      signals.set(v, new Proxy(v, signalHandler));
    }
    return signals.get(v);
  }
  function trace(signal2, prop) {
    const listeners = getListeners(signal2, prop);
    return listeners.map((listener) => {
      return {
        effect: listener.effectType,
        fn: listener.effectFunction,
        signal: signals.get(listener.effectFunction)
      };
    });
  }
  var batchedListeners = /* @__PURE__ */ new Set();
  var batchMode = 0;
  function notifySet(self, context = {}) {
    let listeners = [];
    context.forEach((change, property) => {
      let propListeners = getListeners(self, property);
      if (propListeners?.length) {
        for (let listener of propListeners) {
          addContext(listener, makeContext(property, change));
        }
        listeners = listeners.concat(propListeners);
      }
    });
    listeners = new Set(listeners.filter(Boolean));
    if (listeners) {
      if (batchMode) {
        batchedListeners = batchedListeners.union(listeners);
      } else {
        const currentEffect = computeStack[computeStack.length - 1];
        for (let listener of Array.from(listeners)) {
          if (listener != currentEffect && listener?.needsUpdate) {
            listener();
          }
          clearContext(listener);
        }
      }
    }
  }
  function makeContext(property, change) {
    let context = /* @__PURE__ */ new Map();
    if (typeof property === "object") {
      for (let prop in property) {
        context.set(prop, property[prop]);
      }
    } else {
      context.set(property, change);
    }
    return context;
  }
  function addContext(listener, context) {
    if (!listener.context) {
      listener.context = context;
    } else {
      context.forEach((change, property) => {
        listener.context.set(property, change);
      });
    }
    listener.needsUpdate = true;
  }
  function clearContext(listener) {
    delete listener.context;
    delete listener.needsUpdate;
  }
  function notifyGet(self, property) {
    let currentCompute = computeStack[computeStack.length - 1];
    if (currentCompute) {
      setListeners(self, property, currentCompute);
    }
  }
  var listenersMap = /* @__PURE__ */ new WeakMap();
  var computeMap = /* @__PURE__ */ new WeakMap();
  function getListeners(self, property) {
    let listeners = listenersMap.get(self);
    return listeners ? Array.from(listeners.get(property) || []) : [];
  }
  function setListeners(self, property, compute) {
    if (!listenersMap.has(self)) {
      listenersMap.set(self, /* @__PURE__ */ new Map());
    }
    let listeners = listenersMap.get(self);
    if (!listeners.has(property)) {
      listeners.set(property, /* @__PURE__ */ new Set());
    }
    listeners.get(property).add(compute);
    if (!computeMap.has(compute)) {
      computeMap.set(compute, /* @__PURE__ */ new Map());
    }
    let connectedSignals = computeMap.get(compute);
    if (!connectedSignals.has(property)) {
      connectedSignals.set(property, /* @__PURE__ */ new Set());
    }
    connectedSignals.get(property).add(self);
  }
  function clearListeners(compute) {
    let connectedSignals = computeMap.get(compute);
    if (connectedSignals) {
      connectedSignals.forEach((property) => {
        property.forEach((s) => {
          let listeners = listenersMap.get(s);
          if (listeners.has(property)) {
            listeners.get(property).delete(compute);
          }
        });
      });
    }
  }
  var computeStack = [];
  var effectStack = [];
  var effectMap = /* @__PURE__ */ new WeakMap();
  var signalStack = [];
  function effect(fn) {
    if (effectStack.findIndex((f) => fn == f) !== -1) {
      throw new Error("Recursive update() call", { cause: fn });
    }
    effectStack.push(fn);
    let connectedSignal = signals.get(fn);
    if (!connectedSignal) {
      connectedSignal = signal({
        current: null
      });
      signals.set(fn, connectedSignal);
    }
    const computeEffect = function computeEffect2() {
      if (signalStack.findIndex((s) => s == connectedSignal) !== -1) {
        throw new Error("Cyclical dependency in update() call", { cause: fn });
      }
      clearListeners(computeEffect2);
      computeEffect2.effectFunction = fn;
      computeEffect2.effectType = effect;
      computeStack.push(computeEffect2);
      signalStack.push(connectedSignal);
      let result;
      try {
        result = fn(computeEffect2, computeStack, signalStack);
      } finally {
        computeStack.pop();
        signalStack.pop();
        if (result instanceof Promise) {
          result.then((result2) => {
            connectedSignal.current = result2;
          });
        } else {
          connectedSignal.current = result;
        }
      }
    };
    computeEffect.fn = fn;
    effectMap.set(connectedSignal, computeEffect);
    computeEffect();
    return connectedSignal;
  }
  function destroy(connectedSignal) {
    const computeEffect = effectMap.get(connectedSignal)?.deref();
    if (!computeEffect) {
      return;
    }
    clearListeners(computeEffect);
    let fn = computeEffect.fn;
    signals.remove(fn);
    effectMap.delete(connectedSignal);
  }
  function batch(fn) {
    batchMode++;
    let result;
    try {
      result = fn();
    } finally {
      if (result instanceof Promise) {
        result.then(() => {
          batchMode--;
          if (!batchMode) {
            runBatchedListeners();
          }
        });
      } else {
        batchMode--;
        if (!batchMode) {
          runBatchedListeners();
        }
      }
    }
    return result;
  }
  function runBatchedListeners() {
    let copyBatchedListeners = Array.from(batchedListeners);
    batchedListeners = /* @__PURE__ */ new Set();
    const currentEffect = computeStack[computeStack.length - 1];
    for (let listener of copyBatchedListeners) {
      if (listener != currentEffect && listener?.needsUpdate) {
        listener();
      }
      clearContext(listener);
    }
  }
  function throttledEffect(fn, throttleTime) {
    if (effectStack.findIndex((f) => fn == f) !== -1) {
      throw new Error("Recursive update() call", { cause: fn });
    }
    effectStack.push(fn);
    let connectedSignal = signals.get(fn);
    if (!connectedSignal) {
      connectedSignal = signal({
        current: null
      });
      signals.set(fn, connectedSignal);
    }
    let throttled = false;
    let hasChange = true;
    const computeEffect = function computeEffect2() {
      if (signalStack.findIndex((s) => s == connectedSignal) !== -1) {
        throw new Error("Cyclical dependency in update() call", { cause: fn });
      }
      if (throttled && throttled > Date.now()) {
        hasChange = true;
        return;
      }
      clearListeners(computeEffect2);
      computeEffect2.effectFunction = fn;
      computeEffect2.effectType = throttledEffect;
      computeStack.push(computeEffect2);
      signalStack.push(connectedSignal);
      let result;
      try {
        result = fn(computeEffect2, computeStack, signalStack);
      } finally {
        hasChange = false;
        computeStack.pop();
        signalStack.pop();
        if (result instanceof Promise) {
          result.then((result2) => {
            connectedSignal.current = result2;
          });
        } else {
          connectedSignal.current = result;
        }
      }
      throttled = Date.now() + throttleTime;
      globalThis.setTimeout(() => {
        if (hasChange) {
          computeEffect2();
        }
      }, throttleTime);
    };
    computeEffect();
    return connectedSignal;
  }
  function clockEffect(fn, clock) {
    let connectedSignal = signals.get(fn);
    if (!connectedSignal) {
      connectedSignal = signal({
        current: null
      });
      signals.set(fn, connectedSignal);
    }
    let lastTick = -1;
    let hasChanged = true;
    const computeEffect = function computeEffect2() {
      if (lastTick < clock.time) {
        if (hasChanged) {
          clearListeners(computeEffect2);
          computeEffect2.effectFunction = fn;
          computeEffect2.effectType = clockEffect;
          computeStack.push(computeEffect2);
          lastTick = clock.time;
          let result;
          try {
            result = fn(computeEffect2, computeStack);
          } finally {
            computeStack.pop();
            if (result instanceof Promise) {
              result.then((result2) => {
                connectedSignal.current = result2;
              });
            } else {
              connectedSignal.current = result;
            }
            hasChanged = false;
          }
        } else {
          lastTick = clock.time;
        }
      } else {
        hasChanged = true;
      }
    };
    computeEffect();
    return connectedSignal;
  }
  function untracked(fn) {
    const remember = computeStack.slice();
    computeStack = [];
    try {
      return fn();
    } finally {
      computeStack = remember;
    }
  }

  // src/bind.transformers.mjs
  function escape_html(context, next) {
    let content = context.value.innerHTML;
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
      delete context.value.innerHTML;
    }
    next(context);
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
  function arrayByTemplates(context) {
    const attribute = this.options.attribute;
    let items = context.element.querySelectorAll(":scope > [" + attribute + "-key]");
    let lastKey = 0;
    let skipped = 0;
    context.list = context.value;
    for (let item of items) {
      let currentKey = parseInt(item.getAttribute(attribute + "-key"));
      if (currentKey > lastKey) {
        context.index = lastKey;
        context.element.insertBefore(this.applyTemplate(context), item);
      } else if (currentKey < lastKey) {
        item.remove();
      } else {
        let bindings = Array.from(item.querySelectorAll(`[${attribute}]`));
        if (item.matches(`[${attribute}]`)) {
          bindings.unshift(item);
        }
        let needsReplacement = bindings.find((b) => {
          let databind = b.getAttribute(attribute);
          return databind.substr(0, 5) !== ":root" && databind.substr(0, context.path.length) !== context.path;
        });
        if (!needsReplacement) {
          if (item[Symbol.bindTemplate]) {
            let newTemplate = this.findTemplate(context.templates, context.list[lastKey]);
            if (newTemplate != item[Symbol.bindTemplate]) {
              needsReplacement = true;
              if (!newTemplate) {
                skipped++;
              }
            }
          }
        }
        if (needsReplacement) {
          context.index = lastKey;
          context.element.replaceChild(this.applyTemplate(context), item);
        }
      }
      lastKey++;
      if (lastKey >= context.value.length) {
        break;
      }
    }
    items = context.element.querySelectorAll(":scope > [" + attribute + "-key]");
    let length = items.length + skipped;
    if (length > context.value.length) {
      while (length > context.value.length) {
        let child = context.element.querySelectorAll(":scope > :not(template)")?.[length - 1];
        child?.remove();
        length--;
      }
    } else if (length < context.value.length) {
      while (length < context.value.length) {
        context.index = length;
        context.element.appendChild(this.applyTemplate(context));
        length++;
      }
    }
  }
  function objectByTemplates(context) {
    const attribute = this.options.attribute;
    context.list = context.value;
    let items = Array.from(context.element.querySelectorAll(":scope > [" + attribute + "-key]"));
    for (let key in context.list) {
      context.index = key;
      let item = items.shift();
      if (!item) {
        let clone = this.applyTemplate(context);
        context.element.appendChild(clone);
        continue;
      }
      if (item.getAttribute[attribute + "-key"] != key) {
        items.unshift(item);
        let outOfOrderItem = context.element.querySelector(":scope > [" + attribute + '-key="' + key + '"]');
        if (!outOfOrderItem) {
          let clone = this.applyTemplate(context);
          context.element.insertBefore(clone, item);
          continue;
        } else {
          context.element.insertBefore(outOfOrderItem, item);
          item = outOfOrderItem;
          items = items.filter((i) => i != outOfOrderItem);
        }
      }
      let newTemplate = this.findTemplate(context.templates, context.list[context.index]);
      if (newTemplate != item[Symbol.bindTemplate]) {
        let clone = this.applyTemplate(context);
        context.element.replaceChild(clone, item);
      }
    }
    while (items.length) {
      let item = items.shift();
      item.remove();
    }
  }
  function fieldByTemplates(context) {
    const rendered = context.element.querySelector(":scope > :not(template)");
    const template = this.findTemplate(context.templates, context.value);
    context.parent = getParentPath(context.element);
    if (rendered) {
      if (template) {
        if (rendered?.[Symbol.bindTemplate] != template) {
          const clone = this.applyTemplate(context);
          context.element.replaceChild(clone, rendered);
        }
      } else {
        context.element.removeChild(rendered);
      }
    } else if (template) {
      const clone = this.applyTemplate(context);
      context.element.appendChild(clone);
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
    element(context);
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
    element(context);
    setProperties(context.element, context.value, "value");
  }
  function select(context) {
    const el = context.element;
    let value = context.value;
    if (value === null) {
      value = "";
    }
    if (typeof value != "object") {
      if (el.multiple) {
        if (Array.isArray(value)) {
          for (let option of el.options) {
            if (value.indexOf(option.value) === false) {
              option.selected = false;
            } else {
              option.selected = true;
            }
          }
        }
      } else {
        let option = el.options.find((o) => matchValue(o.value, value));
        if (option) {
          option.selected = true;
          option.setAttribute("selected", true);
        }
      }
    } else {
      if (value.options) {
        setSelectOptions(el, value.options);
      }
      if (value.selected) {
        select(Object.asssign({}, context, { value: value.selected }));
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
    element(context);
    setProperties(context.element, context.value, "target", "href", "name", "newwindow", "nofollow");
  }
  function image(context) {
    setProperties(context.element, context.value, "title", "alt", "src", "id");
  }
  function iframe(context) {
    setProperties(context.element, context.value, "title", "src", "id");
  }
  function meta(context) {
    setProperties(context.element, context.value, "content", "id");
  }
  function element(context) {
    const el = context.element;
    let value = context.value;
    if (typeof value == "undefined" || value == null) {
      value = "";
    }
    let strValue = "" + value;
    if (typeof value != "object" || strValue.substring(0, 8) != "[object ") {
      el.innerHTML = strValue;
      return;
    }
    setProperties(el, value, "innerHTML", "title", "id", "className");
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
  if (!Symbol.bindTemplate) {
    Symbol.bindTemplate = Symbol("bindTemplate");
  }
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
          "BUTTON": button,
          "SELECT": select,
          "A": anchor,
          "IMG": image,
          "IFRAME": iframe,
          "META": meta,
          "TEMPLATE": null,
          "*": element
        }
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
            destroy(this.bindings.get(el));
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
      if (bindings.length) {
        applyBindings(bindings);
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
      let clone = template.content.cloneNode(true);
      if (!clone.children?.length) {
        return clone;
      }
      if (clone.children.length > 1) {
        throw new Error("template must contain a single root node", { cause: template });
      }
      const attribute = this.options.attribute;
      const attributes = [attribute + "-field", attribute + "-list", attribute + "-map"];
      const bindings = clone.querySelectorAll(`[${attribute}-field],[${attribute}-list],[${attribute}-map]`);
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
        clone.children[0].setAttribute(attribute + "-key", index);
      }
      clone.children[0][Symbol.bindTemplate] = template;
      return clone;
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
            currentItem = getValueByPath(this.options.root, path);
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
        if (!matches && currentItem !== null && currentItem !== void 0) {
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
      this.bindings.forEach((binding) => {
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
    if (!tracking.has(context.path)) {
      tracking.set(context.path, [context]);
    } else {
      tracking.get(context.path).push(context);
    }
  }
  function untrack(el, path) {
    let list2 = tracking.get(path);
    if (list2) {
      list2 = list2.filter((context) => context.element == el);
      tracking.set(path, list2);
    }
  }
  function getValueByPath(root, path) {
    let parts = path.split(".");
    let curr = root;
    let part;
    part = parts.shift();
    while (part && curr) {
      part = decodeURIComponent(part);
      if (part == "0" && !Array.isArray(curr)) {
      } else if (Array.isArray(curr) && typeof curr[part] == "undefined") {
        curr = curr[0][part];
      } else {
        curr = curr[part];
      }
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
      this.view = this.state.data;
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
      if (!connectedSignal || !connectedSignal[Symbol.Signal]) {
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
          const larger = sort2.direction == "asc" ? 1 : -1;
          const smaller = sort2.direction == "asc" ? -1 : 1;
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
        if (sort2?.sortBy && sort2?.direction) {
          return data.current.toSorted(sort2?.sortFn);
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
          paging2.max = Math.ceil(this.state.data.length / paging2.pageSize);
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
        if (this.state.options[options.name].enabled) {
          return data.current.filter(this.state.options[options.name].matches.bind(this));
        }
        return data.current;
      }, 50);
    };
  }
  function columns(options = {}) {
    if (!options || typeof options !== "object" || Object.keys(options).length === 0) {
      throw new Error("columns requires options to be an object with at least one property");
    }
    return function(data) {
      this.state.options.columns = options;
      return throttledEffect(() => {
        return data.current.map((input2) => {
          let result = {};
          for (let key of Object.keys(this.state.options.columns)) {
            if (!this.state.options.columns[key]?.hidden) {
              result[key] = input2[key];
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
          const clone = node.cloneNode(true);
          if (clone.nodeType == document.ELEMENT_NODE) {
            clone.querySelectorAll("template").forEach(function(t) {
              t.setAttribute("simply-render", "");
            });
            if (this.attributes) {
              for (const attr of this.attributes) {
                if (attr.name != "rel") {
                  clone.setAttribute(attr.name, attr.value);
                }
              }
            }
          }
          this.parentNode.insertBefore(clone, this);
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
    state: state_exports
  });
  var flow_default = globalThis.simply;
})();
