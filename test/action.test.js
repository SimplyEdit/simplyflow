import { jest } from '@jest/globals'
import { actions } from '../src/action.mjs'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('action API', () => {
  it('binds actions to the app object', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const testApp = { data: { count: 0 } }
    const api = actions({
      app: testApp,
      actions: {
        increment(amount) {
          this.data.count += amount
          return this.data.count
        }
      }
    })

    expect(api.increment(2)).toBe(2)
    expect(testApp.data.count).toBe(2)
    expect(api.missing).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('simplyflow/action: unknown action "missing"')
  })

  it('routes synchronous and asynchronous action errors to onError', async () => {
    const errors = []
    const testApp = {
      onError(error, action) {
        errors.push({ error, action })
        return 'handled'
      }
    }
    const api = actions({
      app: testApp,
      actions: {
        throwsNow() {
          throw new Error('sync failure')
        },
        async throwsLater() {
          throw new Error('async failure')
        }
      }
    })

    expect(api.throwsNow()).toBe('handled')
    await expect(api.throwsLater()).resolves.toBe('handled')
    expect(errors.map(entry => entry.error.message)).toEqual(['sync failure', 'async failure'])
    expect(errors[0].action.name).toBe('bound throwsNow')
  })

  it('warns once for unknown actions and suggests close action names', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const api = actions({
      app: {},
      actions: {
        save() {}
      }
    })

    expect(api.svae).toBeUndefined()
    expect(api.svae).toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('simplyflow/action: unknown action "svae". Did you mean "save"?')
  })

  it('warns once for unknown action names without a useful suggestion', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const api = actions({
      app: {},
      actions: {
        save() {}
      }
    })

    expect(api.loadRemoteContacts).toBeUndefined()
    expect(api.loadRemoteContacts).toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('simplyflow/action: unknown action "loadRemoteContacts"')
  })


  it('returns the input unchanged when no app is supplied', () => {
    const config = { actions: { noop() {} } }
    expect(actions(config)).toBe(config)
  })
})

