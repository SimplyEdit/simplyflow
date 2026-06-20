import { jest } from '@jest/globals'
import { actions } from '../src/action.mjs'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('action API', () => {
  it('binds actions to the app object', () => {
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

  it('returns the input unchanged when no app is supplied', () => {
    const config = { actions: { noop() {} } }
    expect(actions(config)).toBe(config)
  })
})

