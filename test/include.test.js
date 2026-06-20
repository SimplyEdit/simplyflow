import { include } from '../src/include.mjs'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  include.cacheBuster = null
})

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  include.cacheBuster = null
})

describe('include API', () => {
  it('imports stylesheet nodes and HTML before the include link', () => {
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/components/card.html'
    document.body.append(link)

    include.html(`
      <link rel="stylesheet" href="style.css">
      <style>.card { display: block; }</style>
      <section id="card">Loaded</section>
    `, link)

    expect(document.head.querySelector('link[rel="stylesheet"]').href).toBe('https://example.com/components/style.css')
    expect(document.head.querySelector('style').textContent).toContain('.card')
    expect(document.body.firstElementChild.id).toBe('card')
    expect(document.body.lastElementChild).toBe(link)
  })

  it('adds a cache-buster while rebasing script URLs', async () => {
    include.cacheBuster = 'test-cache'
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/app/page.html'
    document.body.append(link)

    include.html(`<script src="tool.js"></script><section>Loaded</section>`, link)
    await wait(20)
    const clone = document.body.querySelector('script')

    expect(clone.src).toBe('https://example.com/app/tool.js?cb=test-cache')
    expect(document.body.textContent).toContain('Loaded')
    include.cacheBuster = null
  })
})

