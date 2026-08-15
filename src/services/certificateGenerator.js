import { StaticCanvas, Textbox, Text, Image, util } from 'fabric'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { replaceVariables } from '../utils/placeholderParser'
import { slugifyName } from '../utils/fileUtils'
import { loadFonts } from './fontLoader'
import { resolveDesignKey, templateForDesign } from '../utils/templateDesigns'

const DPI = 300
const JPEG_BULK_THRESHOLD = 120

export const toFabricCharSpacing = (px, fontSize) => Math.round(((px || 0) / (fontSize || 1)) * 1000)
export const fromFabricCharSpacing = (cs, fontSize) => +(((cs || 0) / 1000) * (fontSize || 1)).toFixed(2)

function loadImageElement(src) {
  return util.loadImage(src).then((img) => new Image(img))
}

export function computeBackgroundScale({ imgW, imgH, canvasW, canvasH, fit = 'stretch' }) {
  if (fit === 'stretch') {
    return { scaleX: canvasW / imgW, scaleY: canvasH / imgH, left: 0, top: 0 }
  }
  if (fit === 'fit') {
    const s = Math.min(canvasW / imgW, canvasH / imgH)
    return { scaleX: s, scaleY: s, left: (canvasW - imgW * s) / 2, top: (canvasH - imgH * s) / 2 }
  }
  // cover
  const s = Math.max(canvasW / imgW, canvasH / imgH)
  return { scaleX: s, scaleY: s, left: (canvasW - imgW * s) / 2, top: (canvasH - imgH * s) / 2 }
}

function textStyle(el) {
  return {
    left: el.x,
    top: el.y,
    angle: el.angle || 0,
    opacity: el.opacity ?? 1,
    fontFamily: el.fontFamily || 'Garet',
    fontSize: el.fontSize || 30,
    fontWeight: el.fontWeight || 'normal',
    fontStyle: el.fontStyle || 'normal',
    textAlign: el.textAlign || 'left',
    lineHeight: el.lineHeight || 1.2,
    charSpacing: toFabricCharSpacing(el.letterSpacing, el.fontSize || 30),
    fill: el.fill || '#000000',
    originX: el.originX || 'left',
    originY: el.originY || 'top',
  }
}

/**
 * Render one certificate to a data URL at full template resolution.
 * @param {{ template, data, assetProvider }} - assetProvider resolves assetId -> { dataUrl }
 */
export async function renderCertificate({ template, data, assetProvider, mime = 'image/png', quality = 0.95 }) {
  const { width, height } = template.canvas
  const canvasEl = document.createElement('canvas')
  canvasEl.width = width
  canvasEl.height = height
  const canvas = new StaticCanvas(canvasEl, {
    width,
    height,
    enableRetinaScaling: false,
  })

  const objects = []

  if (template.background) {
    const bg = await loadImageElement(template.background)
    const s = computeBackgroundScale({
      imgW: bg.width,
      imgH: bg.height,
      canvasW: width,
      canvasH: height,
      fit: template.backgroundFit || 'stretch',
    })
    bg.set({ scaleX: s.scaleX, scaleY: s.scaleY, left: s.left, top: s.top, originX: 'left', originY: 'top' })
    objects.push(bg)
  }

  for (const el of template.elements || []) {
    if (el.type === 'image') {
      const asset = assetProvider ? await assetProvider(el.assetId) : null
      if (!asset || !asset.dataUrl) continue
      const img = await loadImageElement(asset.dataUrl)
      img.set({
        left: el.x,
        top: el.y,
        angle: el.angle || 0,
        opacity: el.opacity ?? 1,
        originX: el.originX || 'left',
        originY: el.originY || 'top',
      })
      img.scaleX = el.width / img.width
      img.scaleY = el.height / img.height
      objects.push(img)
    } else if (el.type === 'text' || el.type === 'paragraph') {
      const content = replaceVariables(el.content, data)
      const style = textStyle(el)
      if (el.type === 'paragraph') {
        objects.push(new Textbox(content, { ...style, width: el.width }))
      } else {
        objects.push(new Text(content, style))
      }
    }
  }

  objects.forEach((o) => canvas.add(o))
  canvas.renderAll()

  const dataUrl = canvasEl.toDataURL(mime, quality)
  try {
    canvas.dispose()
  } catch {
    /* ignore */
  }
  return { dataUrl, width, height }
}

/** Convert a rendered data URL to PDF bytes. */
export async function dataUrlToPdf({ dataUrl, width, height }) {
  const pdf = await PDFDocument.create()
  const pageWidth = (width * 72) / DPI
  const pageHeight = (height * 72) / DPI
  const page = pdf.addPage([pageWidth, pageHeight])

  if (dataUrl.startsWith('data:image/jpeg')) {
    const img = await pdf.embedJpg(dataUrl)
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  } else {
    const img = await pdf.embedPng(dataUrl)
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  }
  return pdf.save()
}

/** Generate one certificate fully (PNG + PDF bytes). */
export async function generateCertificate({ template, data, assetProvider, defaultDesignKey }) {
  const tpl = templateForDesign(template, resolveDesignKey(data?.certificate_type, defaultDesignKey))
  const useJpeg = false
  const mime = useJpeg ? 'image/jpeg' : 'image/png'
  const rendered = await renderCertificate({ template: tpl, data, assetProvider, mime })
  const pdfBytes = await dataUrlToPdf(rendered)
  return { ...rendered, pdfBytes }
}

/**
 * Generate a full batch with progress reporting.
 * Each row's `certificate_type` selects the design to use (organizer/volunteer);
 * rows without one fall back to `defaultDesignKey`.
 * @returns {Array<{ key, label, pdfBytes, dataUrl }>}
 */
export async function generateBatch({
  template,
  rows,
  common,
  defaultDesignKey,
  assetProvider,
  onProgress,
  shouldAbort = () => false,
}) {
  await loadFonts()
  const total = rows.length
  const useJpeg = total > JPEG_BULK_THRESHOLD
  const mime = useJpeg ? 'image/jpeg' : 'image/png'
  const quality = useJpeg ? 0.95 : 1

  const results = []
  for (let i = 0; i < total; i++) {
    if (shouldAbort()) break
    const row = rows[i] || {}
    const data = { ...(common || {}), ...row }
    const tpl = templateForDesign(template, resolveDesignKey(row.certificate_type, defaultDesignKey))
    const rendered = await renderCertificate({ template: tpl, data, assetProvider, mime, quality })
    const pdfBytes = await dataUrlToPdf(rendered)
    const label = String(row.recipient_name || row.name || '').trim()
    results.push({
      key: `${slugifyName(label)}_${i + 1}`,
      label: label || `Certificate ${i + 1}`,
      pdfBytes,
      dataUrl: rendered.dataUrl,
    })
    onProgress && onProgress({ done: i + 1, total })
    // yield to the UI thread between certificates
    await new Promise((r) => setTimeout(r, 0))
  }
  return results
}

export async function buildZip(results, zipName = 'Certificates.zip') {
  const zip = new JSZip()
  for (const r of results) {
    zip.file(`${r.key}.pdf`, r.pdfBytes)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return blob
}

/** Merge all certificate PDFs into a single PDF (one certificate per page). */
export async function mergePdfs(results) {
  const merged = await PDFDocument.create()
  for (const r of results || []) {
    const src = await PDFDocument.load(r.pdfBytes, { ignoreEncryption: true })
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const p of pages) merged.addPage(p)
  }
  return merged.save()
}

export { DPI }
