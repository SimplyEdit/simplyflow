import { closest } from './suggest.mjs'

const BEHAVIOR_SELECTOR = '[data-simply-behavior]'

class SimplyBehaviors
{
    constructor(options = {})
    {
        this.app = options.app
        this.container = options.container || document.body
        this.behaviors = options.behaviors || {}
        this.active = new Set()
        this.cleanups = new WeakMap()
        this.unknown = new Set()

        this.observer = new MutationObserver((changes) => this.handleChanges(changes))
        this.observer.observe(this.container, {
            subtree: true,
            childList: true
        })

        for (const node of behaviorNodes(this.container)) {
            this.start(node)
        }
    }

    start(node)
    {
        if (this.active.has(node)) {
            return
        }

        const name = node?.dataset?.simplyBehavior
        const behavior = this.behaviors[name]
        if (!name || typeof behavior !== 'function') {
            this.warnUnknown(name, node)
            return
        }

        this.active.add(node)
        const cleanup = behavior.call(this.app || node, node)
        if (typeof cleanup === 'function') {
            this.cleanups.set(node, cleanup)
        } else if (typeof cleanup !== 'undefined') {
            console.warn('simplyflow/behavior: behavior may only return a cleanup function', { cause: cleanup })
        }
    }

    stop(node)
    {
        if (!this.active.has(node)) {
            return
        }
        this.active.delete(node)

        const cleanup = this.cleanups.get(node)
        this.cleanups.delete(node)
        if (cleanup) {
            cleanup.call(this.app || node, node)
        }
    }

    handleChanges(changes)
    {
        const added = []
        for (const change of changes) {
            if (change.type !== 'childList') {
                continue
            }
            for (const node of change.removedNodes) {
                for (const behaviorNode of behaviorNodes(node)) {
                    this.stop(behaviorNode)
                }
            }
            for (const node of change.addedNodes) {
                added.push(...behaviorNodes(node))
            }
        }
        for (const node of added) {
            this.start(node)
        }
    }

    warnUnknown(name, node)
    {
        if (!name || this.unknown.has(name)) {
            return
        }
        this.unknown.add(name)

        const suggestion = closest(name, Object.keys(this.behaviors))
        const suffix = suggestion ? `. Did you mean "${suggestion}"?` : ''
        console.warn(`simplyflow/behavior: unknown behavior "${name}"${suffix}`, { cause: node })
    }

    destroy()
    {
        this.observer.disconnect()
        for (const node of Array.from(this.active)) {
            this.stop(node)
        }
    }
}

export function behaviors(options = {})
{
    return new SimplyBehaviors(options)
}

function behaviorNodes(root)
{
    if (!root?.querySelectorAll) {
        return []
    }

    const nodes = Array.from(root.querySelectorAll(BEHAVIOR_SELECTOR))
    if (root.matches?.(BEHAVIOR_SELECTOR)) {
        nodes.unshift(root)
    }
    return nodes
}
