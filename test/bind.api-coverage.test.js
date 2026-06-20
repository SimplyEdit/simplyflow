import { jest } from '@jest/globals'
import { signal } from '../src/state.mjs'
import { bind, trace } from '../src/bind.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

describe('bind API contract coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('requires a root signal option', () => {
    expect(() => bind()).toThrow('bind needs at least options.root set')
    expect(() => bind({})).toThrow('bind needs at least options.root set')
  })

  it('supports a custom attribute prefix and bindings added after initialization', async () => {
    document.body.innerHTML = '<main id="app"></main>'
    const container = document.getElementById('app')
    const data = signal({ title: 'Hello', later: 'Later' })
    const databind = bind({ container, root: data, attribute: 'data-bind' })

    try {
      const heading = document.createElement('h1')
      heading.setAttribute('data-bind-field', 'title')
      container.appendChild(heading)

      await wait()
      expect(heading.innerHTML).toBe('Hello')

      data.title = 'Changed'
      await wait()
      expect(heading.innerHTML).toBe('Changed')
    } finally {
      databind.destroy()
    }
  })

  it('warns for unknown transformers and still renders with the normal field renderer', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    document.body.innerHTML = '<div data-flow-field="title" data-flow-transform="does_not_exist"></div>'
    const data = signal({ title: 'Visible' })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelector('div').innerHTML).toBe('Visible')
      expect(warn).toHaveBeenCalledWith(
        'No transformer with name does_not_exist configured',
        expect.objectContaining({ cause: document.querySelector('div') })
      )
    } finally {
      databind.destroy()
    }
  })

  it('runs the built-in escape_html and fixed_content transformers by name', async () => {
    document.body.innerHTML = `
      <div id="escaped" data-flow-field="html" data-flow-transform="escape_html"></div>
      <div id="fixed" data-flow-field="html" data-flow-transform="fixed_content">Keep me</div>
    `
    const data = signal({ html: '<strong>A&B</strong>' })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.getElementById('escaped').innerHTML).toBe('&lt;strong&gt;A&amp;B&lt;/strong&gt;')
      expect(document.getElementById('fixed').innerHTML).toBe('Keep me')
    } finally {
      databind.destroy()
    }
  })

  it('removes a disconnected binding when the source changes later', async () => {
    document.body.innerHTML = '<section><p data-flow-field="message"></p></section>'
    const data = signal({ message: 'hello' })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const paragraph = document.querySelector('p')
      expect(paragraph.innerHTML).toBe('hello')
      paragraph.remove()

      data.message = 'goodbye'
      await wait()
      expect(document.querySelector('p')).toBeNull()
      expect(trace('message').every(context => context.element !== paragraph)).toBe(true)
    } finally {
      databind.destroy()
    }
  })

  it('renders :key, :value, :value subpaths and :root bindings inside list templates', async () => {
    document.body.innerHTML = `<ul data-flow-list="items">
      <template>
        <li>
          <span class="key" data-flow-field=":key"></span>
          <span class="whole" data-flow-field=":value"></span>
          <span class="name" data-flow-field=":value.name"></span>
          <span class="root" data-flow-field=":root.title"></span>
        </li>
      </template>
    </ul>`
    const first = { name: 'Ada', toString: () => 'Ada object' }
    const data = signal({ title: 'People', items: [first] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const item = document.querySelector('li')
      expect(item.getAttribute('data-flow-key')).toBe('0')
      expect(item.querySelector('.key').innerHTML).toBe('0')
      expect(item.querySelector('.whole').innerHTML).toBe('Ada object')
      expect(item.querySelector('.name').innerHTML).toBe('Ada')
      expect(item.querySelector('.root').innerHTML).toBe('People')
    } finally {
      databind.destroy()
    }
  })

  it('supports empty, not-empty and path based template matching', async () => {
    document.body.innerHTML = `<ol data-flow-list="rows">
      <template data-flow-field="visible" data-flow-match=":empty"><li class="hidden">hidden</li></template>
      <template data-flow-field="visible" data-flow-match=":notempty"><li class="visible"><span data-flow-field="name"></span></li></template>
    </ol>`
    const data = signal({ rows: [ { visible: false, name: 'Ignore' }, { visible: true, name: 'Show' } ] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelectorAll('li')).toHaveLength(2)
      expect(document.querySelector('.hidden').innerHTML).toBe('hidden')
      expect(document.querySelector('.visible span').innerHTML).toBe('Show')
    } finally {
      databind.destroy()
    }
  })

  it('uses an external rel template and data-flow-link mappings', async () => {
    document.body.innerHTML = `
      <template id="card-template">
        <article><h2 data-flow-field="title"></h2><span data-flow-field="label"></span></article>
      </template>
      <div data-flow-field="selection">
        <template rel="card-template" data-flow-link="title=:root.catalog.title; label=:root.selection.label"></template>
      </div>
    `
    const data = signal({ catalog: { title: 'Global title' }, selection: { label: 'Local label' } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelector('article h2').innerHTML).toBe('Global title')
      expect(document.querySelector('article span').innerHTML).toBe('Local label')
    } finally {
      databind.destroy()
    }
  })

  it('throws when a rel template cannot be found', () => {
    document.body.innerHTML = '<div data-flow-field="value"><template rel="missing-template"></template></div>'
    const data = signal({ value: true })

    expect(() => bind({ container: document.body, root: data })).toThrow('Could not find template with id missing-template')
  })

  it('does not render an item when no template matches that value', async () => {
    document.body.innerHTML = `<ul data-flow-list="items">
      <template data-flow-match="show"><li>show</li></template>
    </ul>`
    const data = signal({ items: ['hide'] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelector('li')).toBeNull()
    } finally {
      databind.destroy()
    }
  })

  it('allows a template with only text content', async () => {
    document.body.innerHTML = '<div data-flow-field="mode"><template data-flow-match="text">plain text</template></div>'
    const data = signal({ mode: 'text' })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelector('div').textContent).toContain('plain text')
    } finally {
      databind.destroy()
    }
  })

  it('rejects templates with more than one root element', () => {
    document.body.innerHTML = '<div data-flow-field="mode"><template><b>one</b><i>two</i></template></div>'
    const data = signal({ mode: 'anything' })

    expect(() => bind({ container: document.body, root: data })).toThrow('template must contain a single root node')
  })

  it('switches and removes field template output when the matching template changes', async () => {
    document.body.innerHTML = `<div data-flow-field="mode">
      <template data-flow-match="a"><p class="a">A</p></template>
      <template data-flow-match="b"><p class="b">B</p></template>
    </div>`
    const data = signal({ mode: 'a' })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const first = document.querySelector('p')
      expect(first.className).toBe('a')

      data.mode = 'b'
      await wait()
      const second = document.querySelector('p')
      expect(second).not.toBe(first)
      expect(second.className).toBe('b')

      data.mode = 'c'
      await wait()
      expect(document.querySelector('p')).toBeNull()
    } finally {
      databind.destroy()
    }
  })

  it('reports invalid list and map declarations without throwing', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    document.body.innerHTML = `
      <ul data-flow-list="items"></ul>
      <div data-flow-map="missing"></div>
      <section data-flow-map="record"></section>
    `
    const data = signal({ items: ['x'], missing: null, record: { a: 1 } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(error).toHaveBeenCalledWith('No templates found in', document.querySelector('ul'))
      expect(error).toHaveBeenCalledWith('Value is not an object.', document.querySelector('div'), 'missing', null)
      expect(error).toHaveBeenCalledWith('No templates found in', document.querySelector('section'))
    } finally {
      databind.destroy()
    }
  })

  it('updates list DOM by inserting, reusing, moving and removing items', async () => {
    document.body.innerHTML = `<ul data-flow-list="items">
      <template><li><span data-flow-field="name"></span></li></template>
    </ul>`
    const first = { name: 'First' }
    const second = { name: 'Second' }
    const inserted = { name: 'Inserted' }
    const data = signal({ items: [first, second] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const firstNode = document.querySelector('[data-flow-key="0"]')
      const secondNode = document.querySelector('[data-flow-key="1"]')

      data.items.unshift(inserted)
      await wait()
      expect(document.querySelector('[data-flow-key="1"]')).toBe(firstNode)
      expect(firstNode.querySelector('span').getAttribute('data-flow-field')).toBe('items.1.name')
      expect(document.querySelector('[data-flow-key="2"]')).toBe(secondNode)

      data.items.splice(1, 1)
      await wait()
      expect(firstNode.isConnected).toBe(false)
      expect(document.querySelector('[data-flow-key="1"]')).toBe(secondNode)
      expect(secondNode.querySelector('span').getAttribute('data-flow-field')).toBe('items.1.name')
    } finally {
      databind.destroy()
    }
  })

  it('replaces a list item when the same value matches a different template', async () => {
    document.body.innerHTML = `<ul data-flow-list="items">
      <template data-flow-field="kind" data-flow-match="a"><li class="a"><span data-flow-field="name"></span></li></template>
      <template data-flow-field="kind" data-flow-match="b"><li class="b"><span data-flow-field="name"></span></li></template>
    </ul>`
    const item = { kind: 'a', name: 'One' }
    const data = signal({ items: [item] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const firstNode = document.querySelector('li')
      expect(firstNode.className).toBe('a')

      data.items[0].kind = 'b'
      await wait()
      const secondNode = document.querySelector('li')
      expect(secondNode).not.toBe(firstNode)
      expect(secondNode.className).toBe('b')
      expect(secondNode.querySelector('span').innerHTML).toBe('One')
    } finally {
      databind.destroy()
    }
  })

  it('updates map DOM by inserting, moving, reusing, replacing and removing items', async () => {
    document.body.innerHTML = `<div data-flow-map="people">
      <template data-flow-field="kind" data-flow-match="person"><p class="person"><span data-flow-field="name"></span></p></template>
      <template data-flow-field="kind" data-flow-match="team"><p class="team"><span data-flow-field="name"></span></p></template>
    </div>`
    const ada = { kind: 'person', name: 'Ada' }
    const grace = { kind: 'person', name: 'Grace' }
    const linus = { kind: 'person', name: 'Linus' }
    const data = signal({ people: { ada, grace } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const adaNode = document.querySelector('[data-flow-key="ada"]')
      const graceNode = document.querySelector('[data-flow-key="grace"]')

      data.people = { linus, grace, ada }
      await wait()
      expect(document.querySelector('[data-flow-key="linus"] span').innerHTML).toBe('Linus')
      expect(document.querySelector('[data-flow-key="grace"]')).toBe(graceNode)
      expect(document.querySelector('[data-flow-key="ada"]')).toBe(adaNode)
      expect(Array.from(document.querySelectorAll('p')).map(node => node.getAttribute('data-flow-key'))).toEqual(['linus', 'grace', 'ada'])

      data.people.grace.kind = 'team'
      await wait()
      const newGraceNode = document.querySelector('[data-flow-key="grace"]')
      expect(newGraceNode).not.toBe(graceNode)
      expect(newGraceNode.className).toBe('team')

      data.people = { grace }
      await wait()
      expect(adaNode.isConnected).toBe(false)
      expect(document.querySelectorAll('p')).toHaveLength(1)
      expect(document.querySelector('p span').innerHTML).toBe('Grace')
    } finally {
      databind.destroy()
    }
  })

  it('renders inputs, textareas, buttons, select values, media elements and generic custom elements', async () => {
    document.body.innerHTML = `
      <input id="text" data-flow-field="text">
      <input id="emptyText" data-flow-field="missing">
      <input id="check" type="checkbox" value="yes" data-flow-field="checkedValue">
      <input id="radio" type="radio" value="b" data-flow-field="choice">
      <textarea id="textarea" data-flow-field="text"></textarea>
      <button id="button" data-flow-field="button"></button>
      <select id="select" data-flow-field="choice"><option value="a">A</option><option value="b">B</option></select>
      <select id="multi" multiple data-flow-field="choices"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
      <select id="configured" data-flow-field="configured"></select>
      <img id="image" data-flow-field="image">
      <iframe id="frame" data-flow-field="frame"></iframe>
      <meta id="meta" data-flow-field="meta">
      <custom-card id="custom" data-flow-field="custom"></custom-card>
    `
    const data = signal({
      text: 'hello',
      checkedValue: 'yes',
      choice: 'b',
      choices: ['a', 'c'],
      button: { value: 'run' },
      configured: {
        id: 'configured-id',
        className: 'configured-class',
        options: [null, { value: 'x' }, { text: 'Why', value: 'y' }],
        selected: 'y'
      },
      image: { title: 'Image title', alt: 'Alt text', src: 'photo.png', id: 'rendered-image' },
      frame: { title: 'Frame title', src: 'frame.html', id: 'rendered-frame' },
      meta: { content: 'description', id: 'rendered-meta' },
      custom: { innerHTML: 'custom body', title: 'custom title', id: 'rendered-custom', className: 'custom-class' }
    })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.getElementById('text').value).toBe('hello')
      expect(document.getElementById('emptyText').value).toBe('')
      expect(document.getElementById('check').checked).toBe(true)
      expect(document.getElementById('radio').checked).toBe(true)
      expect(document.getElementById('textarea').value).toBe('hello')
      expect(document.getElementById('button').value).toBe('run')
      expect(document.getElementById('button').innerHTML).toBe('')
      expect(document.getElementById('select').selectedIndex).toBe(1)
      expect(Array.from(document.getElementById('multi').options).map(option => option.selected)).toEqual([true, false, true])
      expect(Array.from(document.getElementById('configured-id').options).map(option => option.value)).toEqual(['x', 'y'])
      expect(document.getElementById('configured-id').value).toBe('y')
      expect(document.getElementById('configured-id').className).toBe('configured-class')
      expect(document.getElementById('rendered-image').getAttribute('src')).toBe('photo.png')
      expect(document.getElementById('rendered-image').alt).toBe('Alt text')
      expect(document.getElementById('rendered-frame').getAttribute('src')).toBe('frame.html')
      expect(document.getElementById('rendered-meta').getAttribute('content')).toBe('description')
      expect(document.getElementById('rendered-custom').innerHTML).toBe('custom body')
      expect(document.getElementById('rendered-custom').title).toBe('custom title')
    } finally {
      databind.destroy()
    }
  })

  it('keeps an element property empty when bound object properties are null', async () => {
    document.body.innerHTML = '<div data-flow-field="box" title="old"></div>'
    const data = signal({ box: { title: null, innerHTML: null } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const box = document.querySelector('div')
      expect(box.title).toBe('')
      expect(box.innerHTML).toBe('')
    } finally {
      databind.destroy()
    }
  })

  it('updates a string field from DOM changes when two-way binding is enabled', async () => {
    document.body.innerHTML = '<div data-flow-field="message"></div>'
    const data = signal({ message: 'start' })
    const databind = bind({ container: document.body, root: data, twoway: true })

    try {
      await wait()
      const box = document.querySelector('div')
      box.innerHTML = 'edited'
      await wait()
      expect(data.message).toBe('edited')
    } finally {
      databind.destroy()
    }
  })


  it('does not rewrite binding attributes inside nested template declarations', async () => {
    document.body.innerHTML = `<div data-flow-list="rows">
      <template>
        <section>
          <template data-flow-field="future.name"><span>future</span></template>
          <span data-flow-field="name"></span>
        </section>
      </template>
    </div>`
    const data = signal({ rows: [{ name: 'Rendered' }] })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      const nestedTemplate = document.querySelector('section template')
      expect(nestedTemplate.getAttribute('data-flow-field')).toBe('future.name')
      expect(document.querySelector('section > span').getAttribute('data-flow-field')).toBe('rows.0.name')
      expect(document.querySelector('section > span').innerHTML).toBe('Rendered')
    } finally {
      databind.destroy()
    }
  })

  it('supports prefix data-flow-link mappings and :root template match paths', async () => {
    document.body.innerHTML = `
      <template id="linked-person"><article><span data-flow-field="person.name"></span></article></template>
      <div data-flow-field="selection">
        <template rel="linked-person" data-flow-link="person=:root.selection"></template>
      </div>
      <div id="root-match" data-flow-field="selection">
        <template data-flow-field=":root.showSelection" data-flow-match="true"><p>shown</p></template>
      </div>
    `
    const data = signal({ showSelection: true, selection: { name: 'Linked Ada' } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.querySelector('article span').getAttribute('data-flow-field')).toBe('selection.name')
      expect(document.querySelector('article span').innerHTML).toBe('Linked Ada')
      expect(document.querySelector('#root-match p').innerHTML).toBe('shown')
    } finally {
      databind.destroy()
    }
  })

  it('updates object fields, missing nested paths and array shorthand paths through two-way binding', async () => {
    document.body.innerHTML = `
      <div id="box" data-flow-field="box"></div>
      <div id="created" data-flow-field="form.items.0.name"></div>
      <div id="arrayName" data-flow-field="people.name"></div>
    `
    const data = signal({
      box: { innerHTML: 'body', title: 'old title' },
      people: [{ name: 'Original' }]
    })
    const databind = bind({ container: document.body, root: data, twoway: true })

    try {
      await wait()
      const box = document.getElementById('box')
      box.title = 'new title'
      box.dispatchEvent(new Event('change'))
      await wait()
      expect(data.box.title).toBe('new title')

      const created = document.getElementById('created')
      created.innerHTML = 'Created name'
      await wait()
      expect(data.form.items[0].name.innerHTML).toBe('Created name')

      const arrayName = document.getElementById('arrayName')
      arrayName.innerHTML = 'Updated array shorthand'
      await wait()
      expect(data.people[0].name).toBe('Updated array shorthand')
    } finally {
      databind.destroy()
    }
  })

  it('rejects two-way writes to :key pseudo paths', () => {
    document.body.innerHTML = '<div data-flow-field="items.0.:key"></div>'
    const data = signal({ items: [{ name: 'first' }] })

    expect(() => bind({ container: document.body, root: data, twoway: true })).toThrow('setting key not yet supported')
  })

  it('updates the source array when a two-way list is reordered in the DOM', async () => {
    document.body.innerHTML = `<ul data-flow-list="items">
      <template><li data-flow-field=":value"></li></template>
    </ul>`
    const data = signal({ items: ['a', 'b', 'c'] })
    const databind = bind({ container: document.body, root: data, twoway: true })

    try {
      await wait()
      const list = document.querySelector('ul')
      const renderedItems = Array.from(list.querySelectorAll('li'))
      list.insertBefore(renderedItems[2], renderedItems[0])
      await wait()
      expect(Array.from(data.items)).toEqual(['c', 'a', 'b'])
    } finally {
      databind.destroy()
    }
  })

  it('supports two-way object-property tracking for anchors, images, iframes and meta elements', async () => {
    document.body.innerHTML = `
      <a id="link" data-flow-field="link"></a>
      <img id="photo" data-flow-field="photo">
      <iframe id="inline" data-flow-field="inline"></iframe>
      <meta id="description" data-flow-field="description">
    `
    const data = signal({
      link: { innerHTML: 'Home', href: '#home', target: '_self' },
      photo: { alt: 'old alt', src: 'old.png' },
      inline: { title: 'old frame', src: 'old.html' },
      description: { content: 'old content' }
    })
    const databind = bind({ container: document.body, root: data, twoway: true })

    try {
      await wait()
      document.getElementById('link').target = '_blank'
      document.getElementById('photo').alt = 'new alt'
      document.getElementById('inline').title = 'new frame'
      document.getElementById('description').content = 'new content'
      await wait()
      expect(data.link.target).toBe('_blank')
      expect(data.photo.alt).toBe('new alt')
      expect(data.inline.title).toBe('new frame')
      expect(data.description.content).toBe('new content')
    } finally {
      databind.destroy()
    }
  })

  it('renders unchecked checkboxes, null select values and object fixed content', async () => {
    document.body.innerHTML = `
      <input id="unchecked" type="checkbox" value="yes" data-flow-field="checkedValue">
      <select id="emptySelect" data-flow-field="emptyChoice"><option value=":empty">Empty</option><option value="x">X</option></select>
      <div id="fixedObject" data-flow-field="content" data-flow-transform="fixed_content">Stable</div>
    `
    const data = signal({ checkedValue: 'no', emptyChoice: null, content: { innerHTML: 'replace me', title: 'title remains allowed' } })
    const databind = bind({ container: document.body, root: data })

    try {
      await wait()
      expect(document.getElementById('unchecked').checked).toBe(false)
      expect(document.getElementById('emptySelect').value).toBe(':empty')
      expect(document.getElementById('fixedObject').innerHTML).toBe('Stable')
      expect(document.getElementById('fixedObject').title).toBe('title remains allowed')
    } finally {
      databind.destroy()
    }
  })

})

describe('bind API oversight fixes', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('destroy stops field effects and removes public trace entries', async () => {
    document.body.innerHTML = '<h1 data-flow-field="title"></h1>'
    const data = signal({ title: 'Before' })
    const databind = bind({ container: document.body, root: data })

    await wait()
    const heading = document.querySelector('h1')
    expect(heading.innerHTML).toBe('Before')
    expect(trace('title')).toHaveLength(1)

    data.title = 'After one update'
    await wait()
    expect(heading.innerHTML).toBe('After one update')
    expect(trace('title')).toHaveLength(1)

    databind.destroy()
    expect(trace('title')).toEqual([])

    data.title = 'After destroy'
    await wait()
    expect(heading.innerHTML).toBe('After one update')
  })
})
