import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()) })

  await page.goto(`${BASE}/#/templates/new`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))
  await page.waitForSelector('.editor-center canvas', { timeout: 15000 })

  const report = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
    }
    const comp = (sel) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).height : null
    }
    const editor = r('.editor')
    const body = r('.editor-body')
    return {
      root: r('#root'),
      appShell: r('.app-shell'),
      mainArea: r('.main-area'),
      mainAreaH: comp('.main-area'),
      editor, editorHeight: editor ? comp('.editor') : null,
      toolbar: r('.editor-toolbar-top'),
      body,
      bodyHeight: body ? comp('.editor-body') : null,
      sidebar: r('.editor-sidebar'),
      center: r('.editor-center'),
      props: r('.editor-props'),
      canvasHost: r('.editor-canvas-host'),
      canvas: (() => { const c = document.querySelector('.editor-center canvas'); return c ? { w: c.width, h: c.height, cssW: getComputedStyle(c).width, cssH: getComputedStyle(c).height } : null })(),
    }
  })
  console.log(JSON.stringify(report, null, 1))
  await browser.close()
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
