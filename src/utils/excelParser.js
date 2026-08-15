import * as XLSX from 'xlsx'
import { normalizeKey } from './fileUtils'

/** Strip UTF-8 BOM and CR chars, return rows as arrays of strings. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  const src = String(text).replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x !== '') || row.length > 1) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    if (row.some((x) => x !== '') || row.length > 1) rows.push(row)
  }
  return rows.filter((r) => r.length > 0)
}

function parseXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (json.length === 0) return { headers: [], rows: [] }
  return {
    headers: json[0].map((h) => String(h)),
    rows: json.slice(1).map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v)))),
  }
}

/**
 * Parse an uploaded file (.csv / .xlsx / .xls).
 * Returns { hasHeader, columns: [{raw, key}], records: [{ [key]: value }] }
 */
export async function parseFile(file) {
  const name = (file.name || '').toLowerCase()
  let matrix
  if (name.endsWith('.csv')) {
    matrix = parseCsv(await file.text())
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const parsed = parseXlsx(await file.arrayBuffer())
    matrix = parsed.headers.length ? [parsed.headers, ...parsed.rows] : []
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx or .xls file.')
  }

  if (matrix.length === 0) {
    return { columns: [], records: [], rawRows: 0 }
  }

  const rawHeaders = matrix[0]
  const hasHeader = rawHeaders.some((h) => h && h.trim() !== '')

  const columns = rawHeaders.map((raw, idx) => ({
    idx,
    raw: String(raw || ''),
    key: normalizeKey(String(raw || '')),
  }))

  let records = matrix.slice(1).map((r) => {
    const rec = {}
    columns.forEach((c) => {
      rec[c.key] = (r[c.idx] ?? '').trim()
    })
    return rec
  })

  // A single unnamed column becomes the recipient name.
  if (!hasHeader && columns.length === 1 && !columns[0].key) {
    columns[0].key = 'recipient_name'
    records = records.map((r, i) => ({ recipient_name: r[''] ?? '' }))
  }

  return {
    columns,
    records: records.filter((r) => Object.values(r).some((v) => String(v).trim() !== '')),
    rawRows: matrix.length - 1,
    hasHeader,
  }
}
