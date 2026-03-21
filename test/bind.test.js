import {signal} from '../src/state.mjs'
import {bind} from '../src/bind.mjs'

describe('bind can', () => {
  it('render simple list', (done) => {
    const source = `
  <ul data-flow-list="menu">
    <template>
<li><a data-flow-field="item"></a></li></template></ul>`
    const data = signal({
      menu: [
        {
          item: {
            innerHTML: 'item 1',
            href:"#item1"
          }
        },
        {
          item: {
            innerHTML: 'item 2',
            href:"#item2"
          }
        },
        { item: "foo" },
        { item: 1 },
        { item: true },
        { item: false },
        { item: 0 }
      ]
    })
    document.body.innerHTML = source
      const databind = bind({
        container: document.body,
        root: data
      })
      const rendered = `
  <ul data-flow-list="menu">
    <template>
<li><a data-flow-field="item"></a></li></template>
<li data-flow-key="0"><a data-flow-field="menu.0.item" href="#item1">item 1</a></li>
<li data-flow-key="1"><a data-flow-field="menu.1.item" href="#item2">item 2</a></li>
<li data-flow-key="2"><a data-flow-field="menu.2.item">foo</a></li>
<li data-flow-key="3"><a data-flow-field="menu.3.item">1</a></li>
<li data-flow-key="4"><a data-flow-field="menu.4.item">true</a></li>
<li data-flow-key="5"><a data-flow-field="menu.5.item">false</a></li>
<li data-flow-key="6"><a data-flow-field="menu.6.item">0</a></li></ul>`
      setTimeout(() => {
        try {
          expect(document.body.innerHTML).toBe(rendered)
          done()
        } catch(error) {
          done(error)
        } finally {
          databind.destroy()
        }
      }, 10)
  })
  it('render matching templates', (done) => {
    const data = signal({
      foo: 1,
      bar: 'bar'
    })
    const source = `<div data-flow-field="foo">
        <template data-flow-match="1">
          <div data-flow-field="bar"></div>
        </template>
      </div>`
    document.body.innerHTML = source
    const databind = bind({
      container: document.body,
      root: data
    })
    const rendered = `<div data-flow-field=\"foo\">
        <template data-flow-match=\"1\">
          <div data-flow-field=\"bar\"></div>
        </template>
      
          <div data-flow-field=\"bar\">bar</div>
        </div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML.trim()).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 100)
  })
  it('render string to generic div', (done) => {
    const source = `<div data-flow-field="foo"></div`
    document.body.innerHTML = source

    const data = signal({
      foo: "string"
    })
    const databind = bind({
      container: document.body,
      root: data
    })

    const rendered = `<div data-flow-field="foo">string</div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })
  it('render object to generic div', (done) => {
    const source = `<div data-flow-field="foo"></div>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        innerHTML: 'innerHTML',
        id: 'bar',
        className: 'foobar',
        title: 'title'
      }
    })
    const databind = bind({
      container: document.body,
      root: data
    })

    const rendered = `<div data-flow-field="foo" title="title" id="bar" class="foobar">innerHTML</div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })
  it('render object to anchor', (done) => {
    const source = `<a data-flow-field="foo"></a>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        innerHTML: 'innerHTML',
        id: 'bar',
        className: 'foobar',
        title: 'title',
        href: '#somewhere',
        target: '_blank',
        name: 'baz'
      }
    })
    const databind = bind({
      container: document.body,
      root: data
    })

    const rendered = `<a data-flow-field="foo" title="title" id="bar" class="foobar" target="_blank" href="#somewhere" name="baz">innerHTML</a>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })
  it('render object to select', (done) => {
    const source = `<select data-flow-field="foo"></select>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        id: 'bar',
        className: 'foobar',
        options: [
          'foo', 'bar'
        ]
      }
    })
    const databind = bind({
      container: document.body,
      root: data
    })

    const rendered = `<select data-flow-field="foo" id="bar" class="foobar"><option>foo</option><option>bar</option></select>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })
  it('render object to select with key-value options', (done) => {
    const source = `<select data-flow-field="foo"></select>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        id: 'bar',
        className: 'foobar',
        options: {
          foo: 'Foo Foo',
          bar: 'Bar Bar'
        }
      }
    })
    const databind = bind({
      container: document.body,
      root: data
    })

    const rendered = `<select data-flow-field="foo" id="bar" class="foobar"><option value="foo">Foo Foo</option><option value="bar">Bar Bar</option></select>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })

  it('transform data', (done) => {
    const source = `<div data-flow-field="foo" data-flow-transform="setDataFoo"></div>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        innerHTML: 'foobar'
      }
    })
    const databind = bind({
      container: document.body,
      root: data,
      transformers: {
        setDataFoo: function(context, next) {
          context.element.dataset.foo = context.value.innerHTML
          next(context)
        }
      }
    })

    const rendered = `<div data-flow-field="foo" data-flow-transform="setDataFoo" data-foo="foobar">foobar</div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })

  it('render value as list', (done) => {
    const source = `<div data-flow-list="foo">
<template>
  <span data-flow-field="name"></span>
</template>
</div>`
    document.body.innerHTML = source

    const data = signal({
      foo: {
        name: 'foobar'
      }
    })
    const databind = bind({
      container: document.body,
      root: data
    })
    const rendered = `<div data-flow-list="foo">
<template>
  <span data-flow-field="name"></span>
</template>

  <span data-flow-field="foo.0.name" data-flow-key="0">foobar</span>
</div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })

  it('render array as field', (done) => {
    const source = `<div data-flow-field="foo.name"></div>`
    document.body.innerHTML = source

    const data = signal({
      foo: [{
        name: 'foobar'
      }]
    })
    const databind = bind({
      container: document.body,
      root: data
    })
    const rendered = `<div data-flow-field="foo.name">foobar</div>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      } finally {
        databind.destroy()
      }
    }, 10)
  })
})

