import { FONTS } from '../constants/config'

const fontFaces = (() => {
  const faces = []
  for (const font of FONTS) {
    for (const w of font.weights) {
      faces.push({
        family: font.id,
        weight: String(w.weight),
        style: w.value === 'bold' ? 'normal' : 'normal',
        italic: w.value === 'italic' ? 'italic' : 'normal',
      })
    }
    // italic variant per family
    faces.push({ family: font.id, weight: '400', style: 'italic' })
    faces.push({ family: font.id, weight: '700', style: 'italic' })
  }
  return faces
})()

/**
 * Ask the browser to load the certificate fonts so canvas rendering
 * uses them. Resolves when ready (or after a short timeout if the
 * fonts are not present).
 */
export async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const promises = []
  for (const f of fontFaces) {
    try {
      const cssWeight = f.style === 'italic' ? f.weight : f.weight
      const cssStyle = f.style
      promises.push(document.fonts.load(`${cssStyle} ${cssWeight} 64px "${f.family}"`).catch(() => null))
    } catch {
      /* ignore */
    }
  }
  await Promise.race([
    Promise.all(promises),
    new Promise((r) => setTimeout(r, 4000)),
  ])
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
}

export function fontCss(family) {
  const f = FONTS.find((x) => x.id === family)
  return f ? f.css : `'${family}', sans-serif`
}
