import '../src/render.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

describe('simply-render custom element API', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('replaces itself with the referenced template content and copies non-rel attributes', async () => {
    document.body.innerHTML = `
      <template id="card"><article><template id="nested"></template><span>Card</span></article></template>
    `
    const render = document.createElement('simply-render')
    render.setAttribute('rel', 'card')
    render.setAttribute('data-kind', 'profile')
    document.body.appendChild(render)
    await wait(0)

    expect(document.querySelector('simply-render')).toBeNull()
    const article = document.querySelector('article')
    expect(article.dataset.kind).toBe('profile')
    expect(article.querySelector('span').textContent).toBe('Card')
    expect(article.querySelector('template').hasAttribute('simply-render')).toBe(true)
  })

  it('renders when the referenced template is added after the custom element', async () => {
    const render = document.createElement('simply-render')
    render.setAttribute('rel', 'late-card')
    document.body.appendChild(render)

    const template = document.createElement('template')
    template.id = 'late-card'
    template.innerHTML = '<section>Late</section>'
    document.body.appendChild(template)
    await wait()

    expect(document.querySelector('simply-render')).toBeNull()
    expect(document.querySelector('section').textContent).toBe('Late')
  })
})

