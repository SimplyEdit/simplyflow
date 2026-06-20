import { routes, SimplyRoute } from '../src/route.mjs'

beforeEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
})

afterEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
})

describe('route API', () => {
  it('matches parameterized, wildcard and exact routes', () => {
    const calls = []
    const router = routes({
      app: { name: 'app' },
      matchExact: true,
      routes: {
        '/users/:id': function(params) {
          calls.push({ thisValue: this, params })
          return 'user'
        },
        '/files/:*': params => params.remainder
      }
    })

    expect(router.match('/users/42')).toBe('user')
    expect(calls[0].thisValue.name).toBe('app')
    expect(calls[0].params).toEqual({ id: '42' })
    expect(router.match('/users/42/extra')).toBe(false)
    expect(router.match('/files/a/b/c')).toBe('a/b/c')
  })

  it('supports base URLs, init(), has(), clear() and load()', () => {
    const router = new SimplyRoute({ baseURL: '/app/' })
    router.load({
      '/dashboard': () => 'dashboard'
    })

    expect(router.has('/app/dashboard')).toBe(true)
    expect(router.match('/app/dashboard')).toBe('dashboard')

    router.init({ baseURL: '/new/' })
    router.clear()
    router.load({ '/home': () => 'home' })
    expect(router.match('/new/home')).toBe('home')
    expect(router.has('/app/dashboard')).toBe(false)
  })

  it('runs route listeners and allows them to alter path and params', () => {
    const router = new SimplyRoute({
      routes: {
        '/new/:id': params => params.id
      }
    })
    const events = []
    const matchListener = args => {
      events.push('match')
      return { ...args, path: '/new/123' }
    }
    const callListener = args => {
      events.push('call')
      return { ...args, params: { id: '456' } }
    }
    const finishListener = args => {
      events.push(['finish', args.result])
    }

    router.addListener('match', '/old/:id', matchListener)
    router.addListener('call', '/new/:id', callListener)
    router.addListener('finish', '/new/:id', finishListener)

    expect(router.match('/old/ignored')).toBe('456')
    expect(events).toEqual(['match', 'call', ['finish', '456']])

    router.removeListener('match', '/old/:id', matchListener)
    expect(router.match('/old/ignored')).toBe(false)
  })

  it('adds a missing slash and updates history when configured', () => {
    const router = new SimplyRoute({
      addMissingSlash: true,
      routes: {
        '/docs/': () => 'docs'
      }
    })

    expect(router.match('/docs')).toBe('docs')
    expect(location.pathname).toBe('/docs/')
  })

  it('navigates with goto() and can hijack matching same-origin links', () => {
    document.body.innerHTML = `<div id="app"><a href="/page/7">Page</a></div>`
    const container = document.getElementById('app')
    const seen = []
    const router = routes({
      app: { container },
      hijackLinks: true,
      routes: {
        '/page/:id': params => {
          seen.push(params.id)
          return undefined
        }
      }
    })

    router.handleEvents()
    expect(router.goto('/page/3')).toBeUndefined()
    expect(location.pathname).toBe('/page/3')

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    Object.defineProperty(evt, 'which', { value: 1 })
    container.querySelector('a').dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    expect(seen).toEqual(['3', '7'])
  })

  it('throws for unknown listener actions and supports the legacy routes(app, options) call shape', () => {
    const router = routes({}, { routes: { '/': () => 'root' } })
    expect(router.match('/')).toBe('root')
    expect(() => router.addListener('unknown', '/', () => {})).toThrow('simplyflow/route: unknown listener type "unknown"')
    expect(() => router.removeListener('unknown', '/', () => {})).toThrow('simplyflow/route: unknown listener type "unknown"')
  })
})

