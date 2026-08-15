import puppeteer from 'puppeteer-core'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const W = 3508
const H = 2480

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function makePng(w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const rows = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4)
    rows[off] = 0
    for (let x = 0; x < w; x++) {
      const p = off + 1 + x * 4
      rows[p] = 0x2b
      rows[p + 1] = 0x6c
      rows[p + 2] = 0x8a
      rows[p + 3] = 255
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const pngPath = join(tmpdir(), 'bg-test.png')
writeFileSync(pngPath, makePng(W, H))
console.log('test png bytes:', (makePng(W, H)).length)

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()) })

  await page.goto(`${BASE}/#/templates/new`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))
  await page.waitForSelector('.editor-center canvas', { timeout: 15000 })

  const before = await page.evaluate(() => {
    const c = document.querySelector('.editor-center canvas')
    const host = c.parentElement
    return {
      canvasW: c.width, canvasH: c.height,
      cssW: getComputedStyle(c).width, cssH: getComputedStyle(c).height,
      hostRect: host.getBoundingClientRect().toJSON(),
      centerRect: document.querySelector('.editor-center').getBoundingClientRect().toJSON(),
    }
  })
  console.log('BEFORE upload:', JSON.stringify(before, null, 1))

  const input = await page.$('input[type=file][accept*="image"]')
  await input.uploadFile(pngPath)
  await new Promise((r) => setTimeout(r, 3000))

  const after = await page.evaluate(() => {
    const c = window.__certCanvas ? window.__certCanvas.lowerCanvasEl : document.querySelector('.editor-center canvas')
    const host = c.parentElement
    const ctx = c.getContext('2d')
    const img = ctx.getImageData(0, 0, c.width, c.height)
    let nonWhite = 0, total = img.data.length / 4
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2]
      if (!(r > 240 && g > 240 && b > 240)) nonWhite++
    }
    return {
      canvasW: c.width, canvasH: c.height,
      cssW: getComputedStyle(c).width, cssH: getComputedStyle(c).height,
      hostRect: host.getBoundingClientRect().toJSON(),
      backgroundImageSet: window.__certBg ? window.__certBg() : 'no-hook',
      objCount: window.__certObjCount ? window.__certObjCount() : -1,
      nonWhitePct: +((nonWhite / total) * 100).toFixed(2),
    }
  })
  console.log('AFTER upload:', JSON.stringify(after, null, 1))

  const extra = await page.evaluate(async () => {
    const c = window.__certCanvas
    if (!c) return { error: 'no canvas' }
    const lower = c.lowerCanvasEl
    const ctx = lower.getContext('2d')
    const out = {}
    // sanity: direct draw
    ctx.fillStyle = 'rgb(255,0,0)'
    ctx.fillRect(0, 0, 50, 50)
    const p0 = ctx.getImageData(25, 25, 1, 1).data
    out.directDrawRed = [p0[0], p0[1], p0[2]]
    ctx.clearRect(0, 0, lower.width, lower.height)

    // render with identity viewport
    c.setViewportTransform([1, 0, 0, 1, 0, 0])
    c.renderAll()
    let img = ctx.getImageData(0, 0, lower.width, lower.height)
    let nonWhite = 0
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2]
      if (!(r > 240 && g > 240 && b > 240)) nonWhite++
    }
    out.identityVptNonWhitePct = +((nonWhite / (img.data.length / 4)) * 100).toFixed(2)

    // add bg as a regular object instead
    const bgObj = c.backgroundImage
    const FImage = bgObj.constructor
    const obj = new FImage(bgObj._element, { left: 0, top: 0, scaleX: 0.2, scaleY: 0.2, originX: 'left', originY: 'top' })
    c.add(obj)
    c.renderAll()
    img = ctx.getImageData(0, 0, lower.width, lower.height)
    nonWhite = 0
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2]
      if (!(r > 240 && g > 240 && b > 240)) nonWhite++
    }
    out.asObjectNonWhitePct = +((nonWhite / (img.data.length / 4)) * 100).toFixed(2)
    out.objW = obj.width
    out.objH = obj.height
    out.objScale = obj.scaleX
    c.remove(obj)

    // test: disable skipOffscreen culling
    c.skipOffscreen = false
    c.setViewportTransform([0.1653, 0, 0, 0.1653, 0, 0])
    c.renderAll()
    img = ctx.getImageData(0, 0, lower.width, lower.height)
    nonWhite = 0
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2]
      if (!(r > 240 && g > 240 && b > 240)) nonWhite++
    }
    out.skipOffscreenOffPct = +((nonWhite / (img.data.length / 4)) * 100).toFixed(2)
    c.skipOffscreen = true

    // instrument drawImage
    const calls = []
    const origDI = ctx.drawImage.bind(ctx)
    ctx.drawImage = function (...args) {
      calls.push({
        src: (args[0] && args[0].tagName) || '?',
        sx: args[1], sy: args[2], sw: args[3], sh: args[4],
        dx: Math.round(args[5]), dy: Math.round(args[6]), dw: Math.round(args[7]), dh: Math.round(args[8]),
        transform: (() => { const t = ctx.getTransform(); return [t.a, t.b, t.c, t.d, t.e, t.f].map((n) => Math.round(n * 1000) / 1000) })(),
        alpha: ctx.globalAlpha,
        op: ctx.globalCompositeOperation,
      })
      return origDI(...args)
    }
    c.renderAll()
    ctx.drawImage = origDI
    out.drawImageCalls = calls.slice(0, 3)
    out.drawImageCallCount = calls.length
    // sample a pixel right after the draw
    const sample = ctx.getImageData(0, 0, 1, 1).data
    out.pixelAt00 = Array.from(sample)

    // verify the raw image element actually decodes and draws
    const imgEl = bgObj._element
    let decodeOk = null
    try {
      await imgEl.decode()
      decodeOk = true
    } catch (e) {
      decodeOk = 'decode-error: ' + e.message
    }
    const scratch = document.createElement('canvas')
    scratch.width = 100
    scratch.height = 100
    const sctx = scratch.getContext('2d')
    try {
      sctx.drawImage(imgEl, 0, 0, 100, 100)
      out.drawImageDirect = Array.from(sctx.getImageData(50, 50, 1, 1).data)
    } catch (e) {
      out.drawImageDirect = 'drawImage-threw: ' + e.message
    }
    out.decodeOk = decodeOk

    // restore vpt
    c.setViewportTransform([0.1653, 0, 0, 0.1653, 0, 0])
    c.renderAll()
    return out
  })
  console.log('EXTRA:', JSON.stringify(extra, null, 1))

  await page.screenshot({ path: join(tmpdir(), 'editor-shot.png') })
  await browser.close()
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
