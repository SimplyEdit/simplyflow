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
  it('waits for blocking external scripts before inserting following scripts', async () => {
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/app/page.html'
    document.body.append(link)

    include.html(`
      <script src="one.js"></script>
      <script>window.afterOne = true</script>
      <script src="two.js"></script>
      <section>Loaded</section>
    `, link)

    await wait(20)
    let scripts = Array.from(document.body.querySelectorAll('script'))
    expect(scripts.map(script => script.src)).toEqual(['https://example.com/app/one.js'])

    scripts[0].dispatchEvent(new Event('load'))
    await wait(0)

    scripts = Array.from(document.body.querySelectorAll('script'))
    expect(scripts).toHaveLength(3)
    expect(scripts[0].src).toBe('https://example.com/app/one.js')
    expect(scripts[1].textContent).toContain('window.afterOne = true')
    expect(scripts[2].src).toBe('https://example.com/app/two.js')
  })

  it('does not let async scripts block following scripts', async () => {
    const link = document.createElement('link')
    link.rel = 'test-include'
    link.href = 'https://example.com/app/page.html'
    document.body.append(link)

    include.html(`
      <script async src="optional.js"></script>
      <script>window.afterAsync = true</script>
      <section>Loaded</section>
    `, link)

    await wait(20)
    const scripts = Array.from(document.body.querySelectorAll('script'))
    expect(scripts).toHaveLength(2)
    expect(scripts[0].src).toBe('https://example.com/app/optional.js')
    expect(scripts[0].hasAttribute('async')).toBe(true)
    expect(scripts[1].textContent).toContain('window.afterAsync = true')
  })

})

