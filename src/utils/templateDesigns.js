/**
 * Every template can hold two certificate designs:
 *   organizer — the "Organiser" certificate layout
 *   volunteer — the "Volunteer" certificate layout
 *
 * A design is { elements, background, backgroundFit }.
 * Legacy templates (created before designs existed) store their layout in
 * top-level `elements/background/backgroundFit`; these helpers migrate and
 * normalize that data so the rest of the app can always read designs.
 */

export const DESIGN_KEYS = ['organizer', 'volunteer']
export const DESIGN_NAMES = { organizer: 'Organiser', volunteer: 'Volunteer' }
export const CERTIFICATE_TYPE_LABELS = ['Volunteer', 'Organiser']
export const DEFAULT_DESIGN_KEY = 'volunteer'

export function emptyDesign() {
  return { elements: [], background: null, backgroundFit: 'stretch' }
}

/**
 * Ensure a template always has `designs.organizer` and `designs.volunteer`.
 * Legacy templates have their top-level layout seeded into the design that
 * matches their `type` (Organiser -> organizer, anything else -> volunteer).
 */
export function normalizeTemplateDesigns(template) {
  if (!template) return template
  const hadDesigns = !!template.designs
  const designs = { ...(template.designs || {}) }
  if (!hadDesigns) {
    const target = String(template.type || '').toLowerCase() === 'organiser' ? 'organizer' : DEFAULT_DESIGN_KEY
    for (const key of DESIGN_KEYS) {
      designs[key] =
        key === target
          ? {
              elements: template.elements || [],
              background: template.background || null,
              backgroundFit: template.backgroundFit || 'stretch',
            }
          : emptyDesign()
    }
  } else {
    for (const key of DESIGN_KEYS) {
      if (!designs[key]) designs[key] = emptyDesign()
    }
  }
  return { ...template, designs }
}

/** Return a single design (falls back to legacy top-level fields). */
export function getDesign(template, key) {
  if (!template) return emptyDesign()
  const d = template.designs?.[key]
  if (d) return d
  return {
    elements: template.elements || [],
    background: template.background || null,
    backgroundFit: template.backgroundFit || 'stretch',
  }
}

/** Build a renderable template whose top-level fields come from one design. */
export function templateForDesign(template, key) {
  if (!template) return template
  const d = getDesign(template, key)
  return {
    ...template,
    elements: d.elements || [],
    background: d.background || null,
    backgroundFit: d.backgroundFit || 'stretch',
  }
}

/** Normalize a certificate_type value to 'Volunteer' | 'Organiser' | ''. */
export function normalizeCertificateType(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'organiser' || raw === 'organizer' || raw === 'org') return 'Organiser'
  if (raw === 'volunteer' || raw === 'vol') return 'Volunteer'
  return ''
}

/** Map a certificate_type value to a design key, using `fallback` when blank/invalid. */
export function resolveDesignKey(value, fallback = DEFAULT_DESIGN_KEY) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'organiser' || v === 'organizer' || v === 'org') return 'organizer'
  if (v === 'volunteer' || v === 'vol') return 'volunteer'
  return DESIGN_KEYS.includes(fallback) ? fallback : DEFAULT_DESIGN_KEY
}

/** Concatenate every text-bearing element across all designs (plus legacy). */
export function allDesignElements(template) {
  const out = []
  if (!template) return out
  const { designs } = template
  if (designs) {
    for (const key of DESIGN_KEYS) {
      const d = designs[key]
      if (d && Array.isArray(d.elements)) out.push(...d.elements)
    }
  } else {
    out.push(...(template.elements || []))
  }
  return out
}

/** Map of design key -> true when that design has at least one element. */
export function designStatus(template) {
  const t = normalizeTemplateDesigns(template)
  const status = {}
  for (const key of DESIGN_KEYS) {
    status[key] = (getDesign(t, key).elements || []).length > 0
  }
  return status
}
