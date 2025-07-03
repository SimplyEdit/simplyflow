import {signal} from '../src/state.mjs'
import {bind} from '../src/bind.mjs'

describe('bind can', () => {
  it('render simple list', (done) => {
    const source = `
  <ul data-bind-list="menu">
    <template>
<li><a data-bind-field="item"></a></li></template></ul>`
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
        }
      ]
    })
    document.body.innerHTML = source
      const databind = bind({
        container: document.body,
        root: data
      })
      const rendered = `
  <ul data-bind-list="menu">
    <template>
<li><a data-bind-field="item"></a></li></template>
<li data-bind-key="0"><a data-bind-field="menu.0.item" href="#item1">item 1</a></li>
<li data-bind-key="1"><a data-bind-field="menu.1.item" href="#item2">item 2</a></li></ul>`
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
    const source = `<div data-bind-field="foo">
        <template data-bind-match="1">
          <div data-bind-field="bar"></div>
        </template>
      </div>`
    document.body.innerHTML = source
    const databind = bind({
      container: document.body,
      root: data
    })
    const rendered = `<div data-bind-field=\"foo\">
        <template data-bind-match=\"1\">
          <div data-bind-field=\"bar\"></div>
        </template>
      
          <div data-bind-field=\":root.bar\">bar</div>
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
})

