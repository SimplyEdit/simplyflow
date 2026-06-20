import path from '../src/path.mjs'

describe('path API', () => {
  it('handles empty, non-string and falsy path values', () => {
    const data = { count: 0, enabled: false, text: '', nested: { value: 1 } }

    expect(path.get(data, '')).toBe(data)
    expect(path.get(data, data.nested)).toBe(data.nested)
    expect(path.get(data, 'count')).toBe(0)
    expect(path.get(data, 'enabled')).toBe(false)
    expect(path.get(data, 'text')).toBe('')
    expect(path.get(data, 'missing')).toBeNull()
  })


  it('throws a clear error when setting through a missing parent path', () => {
    expect(() => path.set({}, 'person.name', 'Ada')).toThrow(
      'simplyflow/path: cannot set "person.name" because its parent path does not exist'
    )
  })

  it('pushes, pops, finds parents and sets nested values', () => {
    const data = { person: { name: 'Ada' } }

    expect(path.push('person', 'name')).toBe('person.name')
    expect(path.pop('person.name')).toBe('name')
    expect(path.parent('person.name.first')).toBe('person.name')
    expect(path.parents(data, 'person.name.first')).toEqual(['', 'person', 'person.name'])

    path.set(data, 'person.name', 'Grace')
    expect(data.person.name).toBe('Grace')
  })
})


describe('path API', () => {
  it('gets and sets dotted paths', () => {
    const data = { person: { name: 'Ada' } }
    expect(path.get(data, 'person.name')).toBe('Ada')
    path.set(data, 'person.name', 'Grace')
    expect(data.person.name).toBe('Grace')
  })
})
