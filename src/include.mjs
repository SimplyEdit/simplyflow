function throttle( callbackFunction, intervalTime ) {
    let eventId = 0
    return () => {
        const myArguments = arguments
        if ( eventId ) {
            return
        } else {
            eventId = globalThis.setTimeout( () => {
                callbackFunction.apply(this, myArguments)
                eventId = 0
            }, intervalTime )
        }
    }
}

const runWhenIdle = (() => {
    if (globalThis.requestIdleCallback) {
        return (callback) => {
            globalThis.requestIdleCallback(callback, {timeout: 500})
        }
    }
    return globalThis.requestAnimationFrame
})()

function rebaseHref(relative, base) {
    let url = new URL(relative, base)
    if (include.cacheBuster) {
        url.searchParams.set('cb',include.cacheBuster)
    }
    return url.href
}

let observer
let head = globalThis.document.querySelector('head')
let scriptLocations = []

function cloneScript(script, base) {
    const clone = globalThis.document.createElement('script')
    for (const attr of script.attributes) {
        clone.setAttribute(attr.name, attr.value)
    }
    clone.removeAttribute('data-simply-location')

    if (clone.hasAttribute('src')) {
        clone.src = rebaseHref(clone.getAttribute('src'), base)
    } else {
        clone.textContent = script.textContent
    }
    return clone
}

function insertScript(script, placeholder) {
    placeholder.parentNode.insertBefore(script, placeholder)
    placeholder.parentNode.removeChild(placeholder)
}

function shouldWaitForScript(script) {
    // Async scripts are explicitly independent. Every other external script from
    // an include is treated as ordered, including scripts that used `defer`;
    // dynamically inserted `defer` scripts do not reliably model parser defer.
    return script.hasAttribute('src') && !script.hasAttribute('async')
}

function insertAndWaitForScript(script, placeholder) {
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

export const include = {
    cacheBuster: null,
    scripts: async (scripts, base) => {
        const arr = scripts.slice()
        for (const script of arr) {
            const clone = cloneScript(script, base)
            const node = scriptLocations[script.dataset.simplyLocation]
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
    },
    html: (html, link) => {
        let fragment = globalThis.document.createRange().createContextualFragment(html)
        const stylesheets = fragment.querySelectorAll('link[rel="stylesheet"],style')
        // add all stylesheets to head
        for (let stylesheet of stylesheets) {
            const href = stylesheet.getAttribute('href')
            if (href) {
                stylesheet.href = rebaseHref(href, link.href)
            }
            head.appendChild(stylesheet)
        }
        // remove the scripts from the fragment, as they will not run in the
        // order in which they are defined
        let scriptsFragment = globalThis.document.createDocumentFragment()
        const scripts = fragment.querySelectorAll('script')
        if (scripts.length) {
            for (let script of scripts) {
                let placeholder = globalThis.document.createComment(script.src || 'inline script')
                script.parentNode.insertBefore(placeholder, script)
                script.dataset.simplyLocation = scriptLocations.length
                scriptLocations.push(placeholder)
                scriptsFragment.appendChild(script)
            }
            globalThis.setTimeout(function() {
                include.scripts(Array.from(scriptsFragment.children), link ? link.href : globalThis.location.href )
            }, 10)
        }
        // add the remainder before the include link
        link.parentNode.insertBefore(fragment, link ? link : null)

    }
}

let included = {}
const includeLinks = async (links) => {
    // mark them as in progress, so handleChanges doesn't find them again
    let remainingLinks = [].reduce.call(links, (remainder, link) => {
        if (link.rel=='simply-include-once' && included[link.href]) {
            link.parentNode.removeChild(link)
        } else {
            included[link.href]=true
            link.rel = 'simply-include-loading'
            remainder.push(link)
        }
        return remainder
    }, [])

    for (let link of remainingLinks) {
        if (!link.href) {
            return
        }
        // fetch the html
        const response = await fetch(link.href)
        if (!response.ok) {
            console.log('simply-include: failed to load '+link.href);
            continue
        }
        console.log('simply-include: loaded '+link.href);
        const html = await response.text()
        // if succesfull import the html
        include.html(html, link)
        // remove the include link
        link.parentNode.removeChild(link)
    }
}

const handleChanges = throttle(() => {
    runWhenIdle(() => {
        var links = globalThis.document.querySelectorAll('link[rel="simply-include"],link[rel="simply-include-once"]')
        if (links.length) {
            includeLinks(links)
        }
    })
})

const observe = () => {
    observer = new MutationObserver(handleChanges)
    observer.observe(globalThis.document, {
        subtree: true,
        childList: true,
    })
}

observe()
handleChanges() // check if there are include links in the dom already
