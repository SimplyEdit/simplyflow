import { jest } from '@jest/globals'
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


  it('supports route shorthand that calls an app action with named parameters', () => {
    const calls = []
    const app = {
      label: 'app',
      actions: {
        showContact(params) {
          calls.push({ thisValue: this, params })
          return `${params.id}:${params.tab}:${params.tag.join(',')}`
        }
      }
    }

    const router = routes({
      app,
      routes: {
        '/contacts/:id': 'showContact'
      }
    })

    expect(router.match('/contacts/42?tab=notes&tag=one&tag=two')).toBe('42:notes:one,two')
    expect(calls).toEqual([
      {
        thisValue: app,
        params: {
          id: '42',
          tab: 'notes',
          tag: ['one', 'two']
        }
      }
    ])
  })



  it('keeps search params separate from the path used for route matching', () => {
    history.replaceState({}, '', '/contacts/42?tab=notes#details')
    const calls = []
    const app = {
      actions: {
        showContact(params) {
          calls.push(params)
          return `${params.id}:${params.tab}`
        }
      }
    }

    const router = routes({
      app,
      routes: {
        '/contacts/:id#details': 'showContact'
      }
    })

    expect(router.match()).toBe('42:notes')
    expect(calls).toEqual([{ id: '42', tab: 'notes' }])
  })

  it('does not use the current document search params for explicit route paths without a search string', () => {
    history.replaceState({}, '', '/current?tab=notes')
    const calls = []
    const app = {
      actions: {
        showContact(params) {
          calls.push(params)
          return params.tab || 'no-tab'
        }
      }
    }

    const router = routes({
      app,
      routes: {
        '/contacts/:id': 'showContact'
      }
    })

    expect(router.match('/contacts/42')).toBe('no-tab')
    expect(calls).toEqual([{ id: '42' }])
  })

  it('lets route params win over query params for action shorthand and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const calls = []
    const app = {
      actions: {
        showContact(params) {
          calls.push(params)
          return params.id
        }
      }
    }

    const router = routes({
      app,
      routes: {
        '/contacts/:id': 'showContact'
      }
    })

    expect(router.match('/contacts/42?id=999&tab=notes')).toBe('42')
    expect(router.match('/contacts/43?id=999')).toBe('43')

    expect(calls).toEqual([
      { id: '42', tab: 'notes' },
      { id: '43' }
    ])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('simplyflow/route: query parameter "id" was ignored because route "/contacts/:id" already provides a route parameter with that name.')
    warn.mockRestore()
  })

  it('throws a helpful error when a route shorthand names an unknown action', () => {
    const router = routes({
      app: {
        actions: {
          showContact() {}
        }
      },
      routes: {
        '/contacts/:id': 'showConact'
      }
    })

    expect(() => router.match('/contacts/42')).toThrow('simplyflow/route: route "/contacts/:id" uses unknown action "showConact". Did you mean "showContact"?')
  })

  it('throws for unknown listener actions', () => {
    const router = routes({ routes: { '/': () => 'root' } })
    expect(() => router.addListener('unknown', '/', () => {})).toThrow('simplyflow/route: unknown listener type "unknown"')
    expect(() => router.removeListener('unknown', '/', () => {})).toThrow('simplyflow/route: unknown listener type "unknown"')
  })
})

