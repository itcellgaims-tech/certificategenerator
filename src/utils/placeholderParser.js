/**
 * Central placeholder parser shared across the whole app.
 * Pattern: {{variable}}
 */

const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

/** Extract a sorted, deduped list of variable names from a string. */
export function extractVariables(str = '') {
  const seen = new Set()
  const out = []
  for (const m of str.matchAll(PLACEHOLDER_RE)) {
    const name = m[1].trim()
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

/** Replace every {{var}} in the template string with data values. Missing values stay as placeholders. */
export function replaceVariables(str = '', data = {}) {
  return str.replace(PLACEHOLDER_RE, (match, name) => {
    const key = name.trim()
    const value = data[key]
    return value === undefined || value === null ? match : String(value)
  })
}

const VALID_NAME_RE = /^[A-Za-z0-9_]+$/

/** Validate a single variable name for use as a placeholder. Returns an error message or null. */
export function validateVariableName(name) {
  const n = (name || '').trim()
  if (!n) return 'Variable name cannot be empty.'
  if (!VALID_NAME_RE.test(n)) {
    return 'Variable name may only contain letters, numbers and underscores. Use "recipient_name" not "Recipient Name".'
  }
  return null
}

/**
 * Scan a string for malformed placeholders such as:
 *   {recipient_name}, recipient_name}}, {{recipient_name (unclosed)
 * Returns an array of { text, index } problems.
 */
export function findMalformedPlaceholders(str = '') {
  const problems = []
  const tokens = []
  let i = 0
  while (i < str.length) {
    const nextOpen = str.indexOf('{{', i)
    const nextClose = str.indexOf('}}', i)
    if (nextOpen === -1 && nextClose === -1) break
    if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
      tokens.push({ type: 'close', index: nextClose })
      i = nextClose + 2
    } else {
      tokens.push({ type: 'open', index: nextOpen })
      i = nextOpen + 2
    }
  }

  const stack = []
  for (const t of tokens) {
    if (t.type === 'open') {
      stack.push(t)
    } else {
      if (stack.length === 0) {
        problems.push({ text: '}}', index: t.index, message: 'Closing "}}" without an opening "{{"' })
      } else {
        const open = stack.pop()
        const inner = str.slice(open.index + 2, t.index)
        const name = inner.trim()
        if (!name || !VALID_NAME_RE.test(name)) {
          problems.push({ text: inner, index: open.index, message: 'Invalid placeholder content.' })
        }
      }
    }
  }
  for (const open of stack) {
    const rest = str.slice(open.index).split(/\s/)[0]
    problems.push({ text: rest, index: open.index, message: 'Unclosed "{{" placeholder.' })
  }
  return problems
}

/** True when a string contains at least one valid placeholder. */
export function hasPlaceholders(str = '') {
  return PLACEHOLDER_RE.test(str)
}
