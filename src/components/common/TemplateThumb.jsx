import { useEffect, useMemo, useRef, useState } from 'react'
import { renderCertificate } from '../../services/certificateGenerator'
import { assetService } from '../../services/assetService'
import { sampleDataForTemplate } from '../../utils/sampleData'
import { getDesign, templateForDesign } from '../../utils/templateDesigns'

/**
 * Renders a small preview image of a template using sample data.
 * Falls back to the plain background / placeholder when rendering fails.
 * Without a `designKey` it renders the first non-empty design
 * (volunteer preferred, otherwise organizer).
 */
export default function TemplateThumb({ template, data, className = '', style, designKey }) {
  const [img, setImg] = useState(null)
  const [failed, setFailed] = useState(false)
  const cancelled = useRef(false)

  const resolved = useMemo(() => {
    if (!template) return template
    let key = designKey
    if (!key) {
      key = getDesign(template, 'volunteer').elements?.length ? 'volunteer' : 'organizer'
    }
    return templateForDesign(template, key)
  }, [template, designKey])

  useEffect(() => {
    cancelled.current = false
    setImg(null)
    setFailed(false)
    let alive = true
    const run = async () => {
      try {
        const assetMap = await assetService.toMap()
        if (!alive) return
        const provider = (id) => assetMap[id] || null
        const { dataUrl } = await renderCertificate({
          template: resolved,
          data: data || sampleDataForTemplate(resolved),
          assetProvider: provider,
        })
        if (alive) {
          setImg(dataUrl)
          setFailed(false)
        }
      } catch {
        if (alive) setFailed(true)
      }
    }
    run()
    return () => {
      alive = false
      cancelled.current = true
    }
  }, [resolved, data])

  if (img) {
    return <img src={img} alt={template.name} className={className} style={style} />
  }
  if (failed) {
    return (
      <div className={`placeholder-thumb ${className}`} style={style}>
        Preview unavailable
      </div>
    )
  }
  return (
    <div className="placeholder-thumb" style={style}>
      <span className="spinner" />
    </div>
  )
}
