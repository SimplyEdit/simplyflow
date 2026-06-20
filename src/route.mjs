import { closest } from './suggest.mjs'
export function routes(options)
{
    return new SimplyRoute(options)
}

export class SimplyRoute
{
    constructor(options={})
    {
        this.options = options
        this.baseURL = options.baseURL || '/'
        this.app = options.app || {}
        this.addMissingSlash = !!options.addMissingSlash
        this.matchExact = !!options.matchExact
        this.hijackLinks = !!options.hijackLinks
        this.clear()
        if (options.routes) {
            this.load(options.routes)
        }
        if (globalThis.simply) { // backwards compatibility feature
            globalThis.simply.route = this
        }
    }

    load(routes)
    {
        parseRoutes(routes, this.routeInfo, this.matchExact)
    }

    clear()
    {
        this.routeInfo = []
        this.listeners = {
            match: {},
            call: {},
            goto: {},
            finish: {}
        }
    }

    match(path, options)
    {
        let args = {
            path,
            options
        }
        args = this.runListeners('match',args)
        path = args.path ? args.path : path;

        let matches;
        let searchParams;
        if (!path) {
            const currentPath = document.location.pathname + document.location.hash
            if (this.has(currentPath)) {
                path = currentPath
            } else {
                path = document.location.pathname
            }
            searchParams = new URLSearchParams(document.location.search)
        } else {
            searchParams = searchParamsForPath(path)
        }
        path = getPath(routePath(path), this.baseURL);
        for ( let route of this.routeInfo) {
            matches = route.match.exec(path)
            if (this.addMissingSlash && !matches?.length) {
                if (path && path[path.length-1]!='/') {
                    matches = route.match.exec(path+'/')
                    if (matches) {
                        path+='/'
                        history.replaceState({}, '', getURL(path, this.baseURL))
                    }
                }
            }
            if (matches && matches.length) {
                let params = {};
                route.params.forEach((key, i) => {
                    if (key=='*') {
                        key = 'remainder'
                    }
                    params[key] = matches[i+1]
                })
                Object.assign(params, options)
                args.route = route
                args.params = params
                args = this.runListeners('call', args)
                params = args.params ? args.params : params
                args.searchParams = searchParams
                args.result = callRouteAction(this.app, route, params, searchParams)
                this.runListeners('finish', args)
                return args.result
            }
        }
        return false
    }

    runListeners(action, params)
    {
        if (!this.listeners[action] || !Object.keys(this.listeners[action])) {
            return
        }
        Object.keys(this.listeners[action]).forEach((route) => {
            var routeRe = getRegexpFromRoute(route);
            if (routeRe.exec(params.path)) {
                var result;
                for (let callback of this.listeners[action][route]) {
                    result = callback.call(this.app, params)
                    if (result) {
                        params = result
                    }
                }
            }
        })
        return params
    }

    handleEvents()
    {
        globalThis.addEventListener('popstate', () => {
            this.match()
        })
        this.app.container.addEventListener('click', (evt) => {
            if (evt.ctrlKey) {
                return;
            }
            if (evt.which != 1) {
                return; // not a 'left' mouse click
            }
            var link = evt.target;
            while (link && link.tagName!='A') {
                link = link.parentElement;
            }
            if (link 
                && link.pathname 
                && link.hostname==globalThis.location.hostname 
                && !link.link
                && !link.dataset.simplyCommand
            ) {
                let check = [
                    { match: link.hash, goto: link.hash },
                    { match: link.pathname + link.hash, goto: link.pathname + link.search + link.hash },
                    { match: link.pathname, goto: link.pathname + link.search }
                ]
                let target
                do {
                    target = check.shift()
                    target.match = getPath(target.match, this.baseURL);
                } while(check.length && !this.has(target.match))
                if ( this.has(target.match) ) {
                    let params = this.runListeners('goto', { path: target.goto});
                    if (params.path) {
                        const followLink = this.goto(params.path)
                        if (!followLink || (this.options.hijackLinks && followLink!==false)) {
                            // now cancel the browser navigation, since a route handler was found
                            evt.preventDefault();
                            return false;
                        }
                    }
                }
            }
        })
    }

    goto(path)
    {
        history.pushState({},'',getURL(path, this.baseURL))
        return this.match(path)
    }

    has(path)
    {
        path = getPath(routePath(path), this.baseURL)
        for (let route of this.routeInfo) {
            var matches = route.match.exec(path)
            if (matches && matches.length) {
                return true
            }
        }
        return false
    }

    addListener(action, route, callback)
    {
        if (['goto','match','call','finish'].indexOf(action)==-1) {
            throw new TypeError(`simplyflow/route: unknown listener type "${action}"`)
        }
        if (!this.listeners[action][route]) {
            this.listeners[action][route] = []
        }
        this.listeners[action][route].push(callback)
    }

    removeListener(action, route, callback)
    {
        if (['goto','match','call','finish'].indexOf(action)==-1) {
            throw new TypeError(`simplyflow/route: unknown listener type "${action}"`)
        }
        if (!this.listeners[action][route]) {
            return
        }
        this.listeners[action][route] = this.listeners[action][route].filter((listener) => {
            return listener != callback
        })
    }

    init(options)
    {
        if (options.baseURL) {
            this.baseURL = options.baseURL
        }
    }
}

function callRouteAction(app, route, params, searchParams)
{
    if (typeof route.action === 'function') {
        return route.action.call(app, params, searchParams)
    }

    if (typeof route.action === 'string') {
        const action = app.actions?.[route.action]
        if (typeof action === 'function') {
            return action.call(app, routeActionParams(route, params, searchParams))
        }
        throw unknownRouteActionError(route, app.actions)
    }

    throw new TypeError(`simplyflow/route: route "${route.path}" must use a function or action name`)
}

const warnedRouteQueryConflicts = new Set()

function routeActionParams(route, params, searchParams)
{
    const query = queryParams(searchParams)
    for (const key of Object.keys(query)) {
        if (Object.hasOwn(params, key)) {
            warnRouteQueryConflict(route, key)
        }
    }
    // Query parameters are user-editable, while route params come from the
    // developer-defined route pattern. Route params therefore win on conflicts.
    return Object.assign(query, params)
}

function queryParams(searchParams)
{
    const params = {}
    for (const [key, value] of searchParams.entries()) {
        if (!Object.hasOwn(params, key)) {
            params[key] = value
        } else if (Array.isArray(params[key])) {
            params[key].push(value)
        } else {
            params[key] = [params[key], value]
        }
    }
    return params
}

function warnRouteQueryConflict(route, key)
{
    const warningKey = `${route.path}\0${key}`
    if (warnedRouteQueryConflicts.has(warningKey)) {
        return
    }
    warnedRouteQueryConflicts.add(warningKey)
    console.warn(`simplyflow/route: query parameter "${key}" was ignored because route "${route.path}" already provides a route parameter with that name.`)
}

function unknownRouteActionError(route, actions)
{
    const suggestion = closest(route.action, Object.keys(actions || {}))
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : ''
    return new TypeError(`simplyflow/route: route "${route.path}" uses unknown action "${route.action}".${hint}`)
}

function searchParamsForPath(path)
{
    const index = typeof path === 'string' ? path.indexOf('?') : -1
    if (index === -1) {
        return new URLSearchParams()
    }
    const hashIndex = path.indexOf('#', index)
    const search = hashIndex === -1 ? path.substring(index) : path.substring(index, hashIndex)
    return new URLSearchParams(search)
}

function routePath(path)
{
    const index = typeof path === 'string' ? path.indexOf('?') : -1
    if (index === -1) {
        return path
    }
    const hashIndex = path.indexOf('#', index)
    if (hashIndex === -1) {
        return path.substring(0, index)
    }
    return path.substring(0, index) + path.substring(hashIndex)
}

function getPath(path, baseURL='/')
{
    if (path.substring(0,baseURL.length)==baseURL
        ||
        ( baseURL[baseURL.length-1]=='/' 
            && path.length==(baseURL.length-1)
            && path == baseURL.substring(0,path.length)
        )
    ) {
        path = path.substring(baseURL.length)
    }
    if (path[0]!='/') {
        path = '/'+path
    }
    return path
}

function getURL(path, baseURL)
{
    path = getPath(path, baseURL)
    if (baseURL[baseURL.length-1]==='/' && path[0]==='/') {
        path = path.substring(1)
    }
    if (path[0]=='#') {
        return path
    }
    return baseURL + path
}

function getRegexpFromRoute(route, exact=false)
{
    if (route[0]!='#') {
        route = '^'+route
    }
    if (exact) {
        return new RegExp(route.replace(/:\w+/g, '([^/]+)').replace(/:\*/, '(.*)')+'(\\?|$)')
    }
    return new RegExp(route.replace(/:\w+/g, '([^/]+)').replace(/:\*/, '(.*)'))
}

function parseRoutes(routes, routeInfo, exact=false)
{
    const paths = Object.keys(routes)
    const matchParams = /:(\w+|\*)/g
    for (let path of paths) {
        let matches = []
        let params  = []
        do {
            matches = matchParams.exec(path)
            if (matches) {
                params.push(matches[1])
            }
        } while(matches)
        routeInfo.push({
            path,
            match:  getRegexpFromRoute(path, exact),
            params: params,
            action: routes[path]
        })
    }
    return routeInfo
}