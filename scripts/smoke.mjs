import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const DL_DIR = join(tmpdir(), 'certgen-downloads')

const errors = []
const step = (msg) => console.log(`\n[SMOKE] ${msg}`)

async function waitFor(page, fn, timeout = 15000, label = 'condition') {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await page.evaluate(fn)) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Timed out waiting for: ${label}`)
}

async function clickNav(page, label) {
  const ok = await page.evaluate((l) => {
    const a = [...document.querySelectorAll('a')].find((el) => el.textContent.includes(l))
    if (a) {
      a.click()
      return true
    }
    return false
  }, label)
  if (!ok) throw new Error(`Could not find nav link "${label}"`)
}

async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button')]
    const el = els.find((e) => e.textContent.trim() === t)
    if (el) {
      el.click()
      return true
    }
    return false
  }, text)
  if (!ok) throw new Error(`Could not find button "${text}"`)
}

async function setTextarea(page, value) {
  return page.evaluate((v) => {
    const el = document.querySelector('.modal .textarea')
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, value)
}

async function setFieldInput(page, fieldText, value) {
  const ok = await page.evaluate(
    (t, v) => {
      const field = [...document.querySelectorAll('.field')].find((f) => f.textContent.includes(t))
      const el = field && field.querySelector('input')
      if (!el) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    fieldText,
    value,
  )
  if (!ok) throw new Error(`Could not find field input for "${fieldText}"`)
}

async function main() {
  rmSync(DL_DIR, { recursive: true, force: true })
  mkdirSync(DL_DIR, { recursive: true })
  writeFileSync(
    join(tmpdir(), 'recipients.csv'),
    'recipient_name,certificate_type,role\nRahul Sharma,Volunteer,Member\nPriya Patil,Volunteer,Member\nSushmit Morey,Organiser,Lead\n',
  )

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page._client().send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
  })

  step('1. Load app')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitFor(page, () => document.body.innerText.includes('Dashboard'))
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('certgen-db')
      req.onsuccess = () => {
        const db = req.result
        const txs = [...db.objectStoreNames]
        if (txs.length === 0) return resolve()
        const tx = db.transaction(txs, 'readwrite')
        txs.forEach((s) => tx.objectStore(s).clear())
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
  await waitFor(page, () => document.body.innerText.includes('Dashboard'))

  step('2. Templates -> load examples')
  await clickNav(page, 'Templates')
  await waitFor(page, () => document.body.innerText.includes('Create Template'))
  await clickText(page, 'Load Example Templates')
  await waitFor(page, () => document.body.innerText.includes('Volunteer & Organiser Certificate'), 20000)

  step('3. Open template editor')
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.template-card')]
    const v = cards.find((c) => c.textContent.includes('Volunteer & Organiser Certificate'))
    v.click()
  })
  await waitFor(page, () => !!document.querySelector('.editor-center canvas'))
  console.log('   canvas present')

  step('3b. Design tabs switch Volunteer <-> Organiser')
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.design-tab')].map((t) => t.textContent.trim())
    if (tabs.join(',') !== 'Organiser,Volunteer') throw new Error('design tabs missing: ' + tabs.join(','))
  })
  await clickText(page, 'Organiser')
  await new Promise((r) => setTimeout(r, 600))
  await clickText(page, 'Volunteer')
  await new Promise((r) => setTimeout(r, 600))
  console.log('   design tabs switched')

  step('4. Add a paragraph field')
  await clickText(page, '＋ Paragraph')
  await waitFor(page, () => document.body.innerText.includes('Add Paragraph'))
  await setTextarea(
    page,
    'This certificate is proudly presented to {{recipient_name}} for serving as a Volunteer during {{event_name}} at {{college_name}} on {{date}}.',
  )
  await clickText(page, 'Add')
  await waitFor(page, () => document.body.innerText.includes('recipient_name'))

  step('5. Save template')
  await clickText(page, 'Save Template')
  await waitFor(page, () => document.body.innerText.includes('Template saved'), 20000)

  step('6. Mass Producer')
  await clickNav(page, 'Mass Producer')
  await waitFor(page, () => document.body.innerText.includes('Select the certificate template'))
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.template-card')]
    const v = cards.find((c) => c.textContent.includes('Volunteer & Organiser Certificate'))
    v.click()
  })
  await waitFor(page, () => document.body.innerText.includes('Common Event Details'))

  step('7. Fill common details')
  for (const [v, value] of [
    ['college_name', 'GMC Alibag'],
    ['event_name', 'Know Sugar, No Diabetes'],
    ['date', '14 June 2026'],
    ['state', 'Maharashtra'],
  ]) {
    await setFieldInput(page, '{{' + v + '}}', value)
  }
  await clickText(page, 'Next →')

  step('8. Upload recipients CSV')
  await waitFor(page, () => document.body.innerText.includes('Recipient Data'))
  const input = await page.$('#recipient-file-input')
  await input.uploadFile(join(tmpdir(), 'recipients.csv'))
  await waitFor(page, () => document.body.innerText.includes('Loaded 3 recipients'), 20000)

  step('8b. Toggle Organiser checkbox for row 1')
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.cell-check input[type="checkbox"]')]
    if (boxes.length < 1) throw new Error('no Organiser? checkboxes found')
    boxes[0].click()
  })
  await new Promise((r) => setTimeout(r, 300))
  console.log('   checkbox toggled')

  await clickText(page, 'Validate Data →')

  step('9. Validate')
  await waitFor(page, () => document.body.innerText.includes('Data Validation'))
  await waitFor(page, () => document.body.innerText.includes('All 3 records are ready'), 10000)
  await clickText(page, 'Preview Certificates →')

  step('10. Preview')
  await waitFor(page, () => document.querySelectorAll('.cert-preview-img').length === 3, 30000)

  step('11. Generate')
  await clickText(page, 'Generate 3 Certificates ⚙')
  await waitFor(page, () => document.body.innerText.includes('generated successfully'), 120000)

  step('12. Download ZIP')
  await clickText(page, '⬇ Download All (ZIP)')
  await new Promise((r) => setTimeout(r, 6000))
  const files = readdirSync(DL_DIR)
  console.log('   downloaded files:', files)

  step('12b. Download all as one college-named PDF')
  await clickText(page, '⬇ Download All (PDF)')
  await new Promise((r) => setTimeout(r, 8000))
  const filesPdf = readdirSync(DL_DIR)
  console.log('   downloaded files:', filesPdf)
  if (!filesPdf.includes('GMC_Alibag.pdf')) {
    throw new Error('college-named merged PDF not found. Got: ' + filesPdf.join(', '))
  }

  step('13. History page')
  await clickNav(page, 'Generated Certificates')
  await waitFor(page, () => document.body.innerText.includes('Know Sugar, No Diabetes'), 15000)

  await browser.close()

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  if (realErrors.length) {
    console.error('\nBrowser console/page errors:')
    realErrors.slice(0, 20).forEach((e) => console.error('  ' + e))
    process.exit(1)
  }
  if (files.length === 0 || !files.some((f) => f.endsWith('.zip'))) {
    console.error('ZIP download not detected')
    process.exit(1)
  }
  console.log('\n[SMOKE] ALL CHECKS PASSED')
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err.message)
  errors.forEach((e) => console.error('  ' + e))
  process.exit(1)
})
