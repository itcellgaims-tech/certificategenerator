import { extractVariables, findMalformedPlaceholders, validateVariableName } from './placeholderParser'
import { COMMON_VARS, RECIPIENT_VAR } from '../constants/config'
import {
  DESIGN_NAMES,
  DEFAULT_DESIGN_KEY,
  allDesignElements,
  getDesign,
  normalizeCertificateType,
  resolveDesignKey,
} from './templateDesigns'

/** Collect all variables used anywhere in a template (across every design). */
export function collectTemplateVariables(template) {
  const vars = new Set()
  for (const el of allDesignElements(template)) {
    if (el.type === 'text' || el.type === 'paragraph') {
      extractVariables(el.content).forEach((v) => vars.add(v))
    }
  }
  return [...vars]
}

/** Scan a template for malformed placeholders. Returns array of { elementId, text, message }. */
export function findTemplatePlaceholderErrors(template) {
  const problems = []
  for (const el of allDesignElements(template)) {
    if (el.type !== 'text' && el.type !== 'paragraph') continue
    for (const p of findMalformedPlaceholders(el.content)) {
      problems.push({ elementId: el.id, text: p.text, message: p.message })
    }
  }
  return problems
}

/**
 * Validate a template before use in the generator.
 * Returns { ok, errors: string[] }
 * - malformed placeholders
 * - variables with invalid names
 * - image elements referencing missing assets (assets passed as a map of id -> asset or null)
 */
export function validateTemplate(template, assetMap = {}) {
  const errors = []
  if (!template) return { ok: false, errors: ['Template not found.'] }
  if (!template.canvas || !template.canvas.width || !template.canvas.height) {
    errors.push('Template has invalid canvas dimensions.')
  }
  for (const el of allDesignElements(template)) {
    if (el.type === 'text' || el.type === 'paragraph') {
      for (const p of findMalformedPlaceholders(el.content)) {
        errors.push(`Element "${el.content.slice(0, 40)}…" contains invalid placeholder: ${p.text}`)
      }
      for (const v of extractVariables(el.content)) {
        const err = validateVariableName(v)
        if (err) errors.push(`Variable "${v}" is invalid. ${err}`)
      }
    }
    if (el.type === 'image') {
      const asset = assetMap[el.assetId]
      if (!asset) {
        errors.push(`An image element references a missing asset. Please restore it before generating.`)
      }
    }
  }
  if (errors.length) {
    errors.push('Cannot generate certificates until the template is fixed.')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Classify a template's variables:
 *  - commonVars: shared event-level fields (college_name, event_name, date, state, committee_name) present in template
 *  - recipientVar: recipient_name
 *  - perRowVars: anything else that varies per recipient
 */
export function classifyVariables(template) {
  const all = collectTemplateVariables(template)
  const commonVars = all.filter((v) => COMMON_VARS.includes(v))
  const recipientVar = all.includes(RECIPIENT_VAR) ? RECIPIENT_VAR : null
  const perRowVars = all.filter((v) => v !== RECIPIENT_VAR && !COMMON_VARS.includes(v))
  return { all, commonVars, recipientVar, perRowVars }
}

/**
 * Validate the combined data for a batch.
 * @returns { errors: [{row:number, missing:string[]}], warnings: [], total, validCount, invalidCount }
 */
export function validateData({ rows, common, template, requireUnique = false, defaultDesignKey = DEFAULT_DESIGN_KEY }) {
  const { all, commonVars } = classifyVariables(template)
  const errors = []
  const warnings = []

  for (const cv of commonVars) {
    if (!String(common?.[cv] ?? '').trim()) {
      errors.push({ row: 0, missing: [`${cv} (common event detail)`] })
    }
  }

  const seen = new Map()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const missing = []
    if (all.includes(RECIPIENT_VAR)) {
      if (!String(row[RECIPIENT_VAR] ?? '').trim()) missing.push(RECIPIENT_VAR)
    }
    for (const v of all) {
      if (v === RECIPIENT_VAR || COMMON_VARS.includes(v)) continue
      if (row[v] === undefined || !String(row[v] ?? '').trim()) missing.push(v)
    }

    const typeVal = row.certificate_type
    if (typeVal && !normalizeCertificateType(typeVal)) {
      missing.push('certificate_type (must be Volunteer or Organiser)')
    } else {
      const key = resolveDesignKey(typeVal, defaultDesignKey)
      if (!getDesign(template, key).elements?.length) {
        warnings.push({ row: i + 1, message: `"${DESIGN_NAMES[key]}" certificate design is empty — the certificate will be blank.` })
      }
    }

    if (Object.values(row).every((v) => String(v).trim() === '')) {
      warnings.push({ row: i + 1, message: 'Empty row' })
    }
    if (requireUnique) {
      const name = String(row[RECIPIENT_VAR] ?? '').trim().toLowerCase()
      if (name) {
        if (seen.has(name)) warnings.push({ row: i + 1, message: `Duplicate recipient name: ${row[RECIPIENT_VAR]}` })
        else seen.set(name, true)
      }
    }
    if (missing.length) errors.push({ row: i + 1, missing })
  }

  const total = rows.length
  const invalidRows = new Set(errors.filter((e) => e.row > 0).map((e) => e.row))
  const validCount = total - invalidRows.size
  const invalidCount = errors.filter((e) => e.row > 0).length

  return { errors, warnings, total, validCount, invalidCount }
}
