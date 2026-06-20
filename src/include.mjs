function throttle(callbackFunction, intervalTime)
{
    let eventId = 0
    return function throttledCallback(...params) {
        if (eventId) {
            return
        }
        eventId = globalThis.setTimeout(() => {
            eventId = 0
            callbackFunction.apply(this, params)
        }, intervalTime)
    }
}

const runWhenIdle = (() => {
    if (globalThis.requestIdleCallback) {
        return (callback) => {
            globalThis.requestIdleCallback(callback, {timeout: 500})
        }
    }
    return globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0))
})()

function rebaseHref(relative, base, cacheBuster)
{
    const url = new URL(relative, base)
    if (cacheBuster) {
        url.searchParams.set('cb', cacheBuster)
    }
    return url.href
}

function cloneScript(script, base, cacheBuster)
{
    const clone = globalThis.document.createElement('script')
    for (const attr of script.attributes) {
        clone.setAttribute(attr.name, attr.value)
    }
    clone.removeAttribute('data-simply-location')

    if (clone.hasAttribute('src')) {
        clone.src = rebaseHref(clone.getAttribute('src'), base, cacheBuster)
    } else {
        clone.textContent = script.textContent
    }
    return clone
}

function insertScript(script, placeholder)
{
    placeholder.parentNode.insertBefore(script, placeholder)
    placeholder.parentNode.removeChild(placeholder)
}

function shouldWaitForScript(script)
{
    // Async scripts are explicitly independent. Every other external script from
    // an include is treated as ordered, including scripts that used `defer`;
    // dynamically inserted `defer` scripts do not reliably model parser defer.
    return script.hasAttribute('src') && !script.hasAttribute('async')
}

function insertAndWaitForScript(script, placeholder)
{
    return new Promise((resolve) => {
        const done = () => {
            script.removeEventListener('load', done)
            script.removeEventListener('error', done)
            resolve()
        }
        script.addEventListener('load', done)
        script.addEventListener('error', done)
        insertScript(script, placeholder)
    })
}

function findIncludeLinks(container)
{
    const selector = 'link[rel="simply-include"],link[rel="simply-include-once"]'
    const links = Array.from(container.querySelectorAll(selector))
    if (container.matches?.(selector)) {
        links.unshift(container)
    }
    return links
}

class SimplyIncludes
{
    constructor(options={})
    {
        this.container = options.container || globalThis.document
        this.cacheBuster = options.cacheBuster ?? defaultCacheBuster
        this.included = Object.create(null)
        this.scriptLocations = []
        this.destroyed = false
        this.handleChanges = throttle(() => {
            runWhenIdle(() => {
                if (!this.destroyed) {
                    this.includeLinks(findIncludeLinks(this.container))
                }
            })
        }, 10)
        if (options.observe !== false) {
            this.observer = new MutationObserver(this.handleChanges)
            this.observer.observe(this.container, {
                subtree: true,
                childList: true,
            })
            this.handleChanges()
        }
    }

    async scripts(scripts, base)
    {
        const arr = scripts.slice()
        for (const script of arr) {
            if (this.destroyed) {
                return
            }
            const clone = cloneScript(script, base, this.cacheBuster)
            const node = this.scriptLocations[script.dataset.simplyLocation]
            if (!node?.parentNode) {
                continue
            }

            // Included scripts should behave like normal document-order scripts by default:
            // each blocking external script must finish loading and running before the next
            // script from the include is inserted. Dynamically inserted scripts are async by
            // default, so async=false and waiting for load are both needed here.
            const waitForLoad = shouldWaitForScript(clone)
            if (waitForLoad) {
                clone.async = false // important: set the property, not the boolean attribute
                await insertAndWaitForScript(clone, node)
            } else {
                insertScript(clone, node)
            }
        }
    }

    html(html, link)
    {
        const fragment = globalThis.document.createRange().createContextualFragment(html)
        const stylesheets = fragment.querySelectorAll('link[rel="stylesheet"],style')
        for (const stylesheet of stylesheets) {
            const href = stylesheet.getAttribute('href')
            if (href) {
                stylesheet.href = rebaseHref(href, link.href, this.cacheBuster)
            }
            globalThis.document.head.appendChild(stylesheet)
        }

        // Scripts imported through a fragment do not execute reliably in document order.
        // Placeholders preserve their positions while scripts are reinserted sequentially.
        const scriptsFragment = globalThis.document.createDocumentFragment()
        const scripts = fragment.querySelectorAll('script')
        if (scripts.length) {
            for (const script of scripts) {
                const placeholder = globalThis.document.createComment(script.src || 'inline script')
                script.parentNode.insertBefore(placeholder, script)
                script.dataset.simplyLocation = this.scriptLocations.length
                this.scriptLocations.push(placeholder)
                scriptsFragment.appendChild(script)
            }
            globalThis.setTimeout(() => {
                this.scripts(Array.from(scriptsFragment.children), link ? link.href : globalThis.location.href)
            }, 10)
        }

        link.parentNode.insertBefore(fragment, link)
    }

    async includeLinks(links)
    {
        const remainingLinks = links.reduce((remainder, link) => {
            if (link.rel === 'simply-include-once' && this.included[link.href]) {
                link.parentNode.removeChild(link)
            } else {
                this.included[link.href] = true
                link.rel = 'simply-include-loading'
                remainder.push(link)
            }
            return remainder
        }, [])

        for (const link of remainingLinks) {
            if (this.destroyed || !link.href) {
                continue
            }
            try {
                const response = await fetch(link.href)
                if (!response.ok) {
                    console.warn(`simplyflow/include: failed to load "${link.href}" (${response.status})`)
                    link.rel = 'simply-include-error'
                    continue
                }
                const html = await response.text()
                if (this.destroyed || !link.parentNode) {
                    continue
                }
                this.html(html, link)
                link.parentNode?.removeChild(link)
            } catch (error) {
                console.warn(`simplyflow/include: failed to load "${link.href}"`, { cause: error })
                link.rel = 'simply-include-error'
            }
        }
    }

    destroy()
    {
        this.destroyed = true
        this.observer?.disconnect()
        this.observer = undefined
    }
}

export function includes(options={})
{
    return new SimplyIncludes(options)
}

let defaultCacheBuster = null
const defaultInclude = () => new SimplyIncludes({
    container: globalThis.document,
    cacheBuster: defaultCacheBuster,
    observe: false
})

export const include = {
    get cacheBuster() {
        return defaultCacheBuster
    },
    set cacheBuster(value) {
        defaultCacheBuster = value
    },
    scripts: (scripts, base) => defaultInclude().scripts(scripts, base),
    html: (html, link) => defaultInclude().html(html, link),
    links: (links) => defaultInclude().includeLinks(Array.from(links))
}
