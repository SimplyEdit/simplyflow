import { jest } from '@jest/globals'
import { model, sort, paging, filter, columns, scroll } from '../src/model.mjs'
import { effect, signal } from '../src/state.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

describe("model", () => {
  // Missing test for when provided modal data object does not contain expected property: 'data'
  // see: https://github.com/SimplyEdit/simplyflow/blob/main/docs/model.md#setting-the-model-up

  it("contains view.current after initiation", () => {
    // Given - a bit of test data
    const modelConfig = { data: [] };

    // When - the model is created with the testdata
    const testModel = model(modelConfig);

    // Then - expect to have a view with property current
    expect(testModel.view).toHaveProperty("current");
  });

  it("renders with an effect attached", () => {
    // Given - test data and an effect that just passes through the data as is
    function createPassThroughEffect(data) {
      const defaultEffect = effect(() => {
        return data.current.slice();
      });

      return defaultEffect;
    }
    const modelConfig = { data: [] };
    const testModel = model(modelConfig);

    // When - the effect is added
    testModel.addEffect(createPassThroughEffect);

    // Then - the testdata stays intact inside view.current
    expect(testModel.view).toHaveProperty("current");
    expect(testModel.view.current).toStrictEqual([])
  });
});

describe('model API contract coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('requires options and warns when data is not iterable', () => {
    expect(() => model()).toThrow('no options set')

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const m = model({ data: { id: 1 } })

    expect(m.state.data).toEqual({ id: 1 })
    expect(m.state.options).toEqual({})
    expect(warn).toHaveBeenCalledWith('SimplyFlowModel: options.data is not iterable')
  })

  it('keeps provided options and rejects invalid addEffect calls', () => {
    const m = model({ data: [], options: { custom: true } })

    expect(m.state.options.custom).toBe(true)
    expect(() => m.addEffect()).toThrow('addEffect requires an effect function as its parameter')
    expect(() => m.addEffect(() => []))
      .toThrow('addEffect function parameter must return a Signal')
  })

  it('passes the previous view signal into each custom effect', () => {
    const m = model({ data: [1, 2] })

    m.addEffect(function double(data) {
      expect(this).toBe(m)
      return effect(() => data.current.map(value => value * 2))
    })
    m.addEffect(function sum(data) {
      return effect(() => data.current.reduce((total, value) => total + value, 0))
    })

    expect(m.effects).toHaveLength(3)
    expect(m.view.current).toBe(6)
  })

  it('sorts ascending, descending, preserves original order without sortBy, and supports custom sort functions', async () => {
    const rows = [
      { id: 'b', score: 2 },
      { id: 'missing' },
      { id: 'a', score: 1 },
      { id: 'c', score: 2 }
    ]
    const m = model({ data: rows })

    m.addEffect(sort({ sortBy: 'score' }))
    expect(m.view.current.map(row => row.id)).toEqual(['a', 'b', 'c', 'missing'])

    m.state.options.sort.direction = 'desc'
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual(['missing', 'b', 'c', 'a'])

    m.state.options.sort.sortBy = null
    await wait()
    expect(m.view.current).toBe(m.effects[0].current)
    expect(m.view.current.map(row => row.id)).toEqual(['b', 'missing', 'a', 'c'])

    m.state.options.sort.sortBy = 'score'
    m.state.options.sort.sortFn = (a, b) => String(a.id).localeCompare(String(b.id))
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual(['a', 'b', 'c', 'missing'])
  })

  it('filters only when enabled and binds the predicate to the model', async () => {
    const m = model({
      data: [
        { id: 1, group: 'a' },
        { id: 2, group: 'b' },
        { id: 3, group: 'a' }
      ]
    })

    m.addEffect(filter({
      name: 'groupFilter',
      enabled: false,
      expectedGroup: 'a',
      matches(row) {
        return row.group === this.state.options.groupFilter.expectedGroup
      }
    }))

    expect(m.view.current.map(row => row.id)).toEqual([1, 2, 3])

    m.state.options.groupFilter.enabled = true
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual([1, 3])

    m.state.options.groupFilter.expectedGroup = 'b'
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual([2])
  })

  it('reacts when an enabled filter predicate is replaced', async () => {
    const m = model({
      data: [
        { id: 1, score: 1 },
        { id: 2, score: 2 },
        { id: 3, score: 3 }
      ]
    })

    m.addEffect(filter({
      name: 'scoreFilter',
      enabled: true,
      threshold: 2,
      matches(row) {
        return row.score >= this.state.options.scoreFilter.threshold
      }
    }))

    expect(m.view.current.map(row => row.id)).toEqual([2, 3])

    m.state.options.scoreFilter.matches = function matchesBelowThreshold(row) {
      return row.score < this.state.options.scoreFilter.threshold
    }
    await wait()

    expect(m.view.current.map(row => row.id)).toEqual([1])

    m.state.options.scoreFilter.threshold = 3
    await wait()

    expect(m.view.current.map(row => row.id)).toEqual([1, 2])
  })

  it('rejects invalid and duplicate filters', () => {
    expect(() => filter()).toThrow('filter requires options.name to be a string')
    expect(() => filter({ name: 1, matches: () => true })).toThrow('filter requires options.name to be a string')
    expect(() => filter({ name: 'ok' })).toThrow('filter requires options.matches to be a function')

    const m = model({ data: [] })
    const activeFilter = filter({ name: 'same', matches: () => true })
    m.addEffect(activeFilter)

    expect(() => m.addEffect(filter({ name: 'same', matches: () => true })))
      .toThrow('a filter with this name already exists on this model')
  })

  it('pages data from the previous effect and keeps paging state bounded', async () => {
    const m = model({
      data: [
        { id: 1, keep: true },
        { id: 2, keep: false },
        { id: 3, keep: true },
        { id: 4, keep: true },
        { id: 5, keep: false }
      ]
    })

    m.addEffect(filter({ name: 'kept', enabled: true, matches: row => row.keep }))
    m.addEffect(paging({ pageSize: 2, page: 99 }))

    await wait()
    expect(m.state.options.paging.max).toBe(2)
    expect(m.state.options.paging.page).toBe(2)
    expect(m.view.current.map(row => row.id)).toEqual([4])

    m.state.options.paging.pageSize = 0
    m.state.options.paging.page = -5
    await wait()
    expect(m.state.options.paging.pageSize).toBe(20)
    expect(m.state.options.paging.page).toBe(1)
    expect(m.view.current.map(row => row.id)).toEqual([1, 3, 4])
  })

  it('projects columns, fills missing values with null, and reacts to hidden changes', async () => {
    const m = model({
      data: [
        { id: 1, name: 'Ada', internal: 'x' },
        { id: 2, internal: 'y' }
      ]
    })

    m.addEffect(columns({
      id: {},
      name: {},
      internal: { hidden: true },
      missing: {}
    }))

    expect(m.view.current).toEqual([
      { id: 1, name: 'Ada', missing: null },
      { id: 2, name: null, missing: null }
    ])

    m.state.options.columns.internal.hidden = false
    m.state.options.columns.name.hidden = true
    await wait()

    expect(m.view.current).toEqual([
      { id: 1, internal: 'x', missing: null },
      { id: 2, internal: 'y', missing: null }
    ])
  })

  it('rejects invalid column configurations', () => {
    expect(() => columns()).toThrow('columns requires options to be an object with at least one property')
    expect(() => columns(null)).toThrow('columns requires options to be an object with at least one property')
    expect(() => columns({})).toThrow('columns requires options to be an object with at least one property')
  })

  it('renders a virtual-scroll slice, updates offset from scroll position, and sizes the scrollbar', async () => {
    const container = document.createElement('div')
    const scrollbar = document.createElement('div')
    scrollbar.setAttribute('data-flow-scrollbar', '')
    container.appendChild(scrollbar)
    document.body.appendChild(container)
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 52 })
    })

    const m = model({ data: [1, 2, 3, 4, 5] })
    m.addEffect(scroll({ container, rowHeight: 26, itemsPerRow: 1 }))

    expect(m.state.options.scroll.rowCount).toBe(2)
    expect(m.view.current).toEqual([1, 2])
    expect(scrollbar.style.height).toBe('130px')

    container.scrollTop = 52
    container.dispatchEvent(new Event('scroll'))
    await wait()

    expect(m.state.options.scroll.offset).toBe(2)
    expect(m.view.current).toEqual([3, 4])

    container.scrollTop = 999
    container.dispatchEvent(new Event('scroll'))
    await wait()

    expect(m.view.current).toEqual([4, 5])

    m.state.data.push(6)
    await wait()
    expect(scrollbar.style.height).toBe('156px')
  })

  it('can use an explicit scrollbar without a scroll container', () => {
    const scrollbar = document.createElement('div')
    const m = model({ data: [1, 2, 3] })

    m.addEffect(scroll({ scrollbar, rowCount: 2, rowHeight: 10 }))

    expect(m.view.current).toEqual([1, 2])
    expect(scrollbar.style.height).toBe('30px')
  })
})

describe('model API oversight fixes', () => {
  it('honors the documented sortDirection option and tracks later sortDirection changes', async () => {
    const m = model({
      data: [
        { id: 1, score: 10 },
        { id: 2, score: 30 },
        { id: 3, score: 20 }
      ]
    })

    m.addEffect(sort({ sortBy: 'score', sortDirection: 'desc' }))
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual([2, 3, 1])

    m.state.options.sort.sortDirection = 'asc'
    await wait()
    expect(m.view.current.map(row => row.id)).toEqual([1, 3, 2])
  })

  it('calls custom sort functions with the model as this and reacts when sortFn is replaced', async () => {
    const m = model({
      data: [
        { id: 1, score: 10 },
        { id: 2, score: 30 },
        { id: 3, score: 20 }
      ]
    })

    m.addEffect(sort({
      sortBy: 'score',
      sortDirection: 'asc',
      sortFn(a, b) {
        return a[this.state.options.sort.sortBy] - b[this.state.options.sort.sortBy]
      }
    }))

    await wait()
    expect(m.view.current.map(row => row.id)).toEqual([1, 3, 2])

    m.state.options.sort.sortFn = function descending(a, b) {
      return b[this.state.options.sort.sortBy] - a[this.state.options.sort.sortBy]
    }
    await wait()

    expect(m.view.current.map(row => row.id)).toEqual([2, 3, 1])
  })

  it('accepts the documented columns({ columns: ... }) option shape', async () => {
    const m = model({
      data: [
        { id: 1, name: 'Ada', internal: 'x' }
      ]
    })

    m.addEffect(columns({
      columns: {
        id: {},
        name: {},
        internal: { hidden: true }
      }
    }))

    await wait()

    expect(m.view.current).toEqual([
      { id: 1, name: 'Ada' }
    ])
  })
})
