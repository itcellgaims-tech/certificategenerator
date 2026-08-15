import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CanvasEditor from '../components/template-editor/Canvas'
import Toolbar from '../components/template-editor/Toolbar'
import PropertiesPanel from '../components/template-editor/PropertiesPanel'
import AddFieldModal from '../components/template-editor/AddFieldModal'
import Modal from '../components/common/Modal'
import TemplateThumb from '../components/common/TemplateThumb'
import { templateService } from '../services/templateService'
import { assetService } from '../services/assetService'
import { useToast } from '../context/ToastContext'
import { DEFAULT_TEMPLATE_CANVAS } from '../constants/config'
import { sampleDataForTemplate } from '../utils/sampleData'
import { validateTemplate } from '../utils/validation'
import { fileToDataUrl } from '../utils/fileUtils'
import { DESIGN_KEYS, DESIGN_NAMES, emptyDesign, getDesign } from '../utils/templateDesigns'

export default function TemplateEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logos, setLogos] = useState([])
  const [signatures, setSignatures] = useState([])
  const [selected, setSelected] = useState(null)
  const [elements, setElements] = useState([])
  const [addMode, setAddMode] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeDesign, setActiveDesign] = useState('volunteer')

  const canvasRef = useRef(null)
  const activeDesignRef = useRef('volunteer')

  const assetMap = useMemo(() => {
    const map = {}
    for (const a of [...logos, ...signatures]) map[a.id] = a
    return map
  }, [logos, signatures])

  const load = async () => {
    if (id) {
      const t = await templateService.get(id)
      if (!t) {
        toast.error('Template not found.')
        navigate('/templates')
        return
      }
      setTemplate(t)
    } else {
      setTemplate({
        id: null,
        name: 'Untitled Template',
        type: 'Certificate',
        canvas: { ...DEFAULT_TEMPLATE_CANVAS },
        background: null,
        backgroundFit: 'stretch',
        elements: [],
        designs: {
          organizer: emptyDesign(),
          volunteer: emptyDesign(),
        },
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    assetService.list('logo').then(setLogos)
    assetService.list('signature').then(setSignatures)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const refreshElements = () => {
    const els = canvasRef.current ? canvasRef.current.getSerialized() : []
    setElements(els)
  }

  const handleTemplateChange = (next) => {
    const key = activeDesignRef.current
    setTemplate({
      ...next,
      designs: {
        ...(next.designs || {}),
        [key]: {
          elements: next.elements || [],
          background: next.background || null,
          backgroundFit: next.backgroundFit || 'stretch',
        },
      },
    })
    refreshElements()
  }

  const handleSelectionChange = (el) => {
    setSelected(el)
    refreshElements()
  }

  const switchDesign = (key) => {
    if (key === activeDesign || !template) return
    canvasRef.current?.flushNow()
    activeDesignRef.current = key
    setActiveDesign(key)
  }

  const designTemplate = useMemo(() => {
    if (!template) return null
    const d = getDesign(template, activeDesign)
    return {
      ...template,
      elements: d.elements,
      background: d.background,
      backgroundFit: d.backgroundFit,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, activeDesign])

  const save = async () => {
    setSaving(true)
    try {
      const serialized = canvasRef.current ? canvasRef.current.getSerialized() : designTemplate?.elements || []
      const background = canvasRef.current ? canvasRef.current.getBackground() : designTemplate?.background || null
      const design = { elements: serialized, background, backgroundFit: template.backgroundFit || 'stretch' }
      const next = {
        ...template,
        elements: serialized,
        background,
        backgroundFit: template.backgroundFit || 'stretch',
        designs: { ...(template.designs || {}), [activeDesign]: design },
      }
      const validation = validateTemplate(next, assetMap)
      if (!validation.ok) {
        validation.errors.forEach((e) => toast.error(e))
        setSaving(false)
        return
      }
      const saved = await templateService.save(next)
      toast.success('Template saved.')
      if (!template.id) navigate(`/templates/${saved.id}`, { replace: true })
      else setTemplate(saved)
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const removeTemplate = async () => {
    if (!template?.id) {
      navigate('/templates')
      return
    }
    if (!window.confirm(`Delete template "${template.name}"?`)) return
    await templateService.remove(template.id)
    toast.success('Template deleted.')
    navigate('/templates')
  }

  const onBackgroundFile = async (file) => {
    const dataUrl = await fileToDataUrl(file)
    await canvasRef.current?.setBackground(dataUrl)
    toast.success('Background set.')
  }

  const onSubmitAddField = (payload) => {
    const c = canvasRef.current
    if (!c) return
    if (addMode === 'variable') {
      c.addVariable(payload)
    } else if (addMode === 'paragraph') {
      c.addParagraph(payload)
    } else {
      c.addStaticText(payload)
    }
    refreshElements()
  }

  const openPreview = () => {
    setPreviewOpen(true)
  }

  const templateForPreview = useMemo(() => {
    if (!template) return null
    const d = getDesign(template, activeDesign)
    return {
      ...template,
      elements: canvasRef.current ? canvasRef.current.getSerialized() : d.elements,
      background: canvasRef.current ? canvasRef.current.getBackground() : d.background,
      backgroundFit: template.backgroundFit || 'stretch',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, previewOpen, activeDesign])

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="editor">
      <div className="editor-toolbar-top">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/templates')}>← Back</button>
        <input
          className="input"
          style={{ width: 260 }}
          value={template.name}
          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
          placeholder="Template name"
        />
        <input
          className="input"
          style={{ width: 150 }}
          value={template.type}
          onChange={(e) => setTemplate({ ...template, type: e.target.value })}
          placeholder="Type"
          list="cert-types"
        />
        <datalist id="cert-types">
          <option value="Organiser" />
          <option value="Volunteer" />
          <option value="Participation" />
          <option value="Appreciation" />
        </datalist>
        <div className="design-tabs">
          {DESIGN_KEYS.map((key) => (
            <button
              key={key}
              className={`design-tab ${activeDesign === key ? 'active' : ''}`}
              onClick={() => switchDesign(key)}
            >
              {DESIGN_NAMES[key]}
            </button>
          ))}
        </div>
        <span className="muted small">{template.canvas?.width} × {template.canvas?.height}</span>
        <span className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={openPreview}>Preview</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : null} Save Template
        </button>
      </div>

      <div className="editor-body">
        <Toolbar
          template={designTemplate}
          logos={logos}
          signatures={signatures}
          elements={elements}
          selectedId={selected?.id}
          onSelectElement={(elId) => canvasRef.current?.selectById(elId)}
          onDeleteElement={(elId) => {
            canvasRef.current?.selectById(elId)
            canvasRef.current?.deleteSelected()
          }}
          onAddVariable={() => setAddMode('variable')}
          onAddParagraph={() => setAddMode('paragraph')}
          onAddStaticText={() => setAddMode('text')}
          onAddImage={(assetId) => canvasRef.current?.addImage(assetId)}
          onBackgroundFile={onBackgroundFile}
          onRemoveBackground={() => canvasRef.current?.removeBackground()}
          onFitChange={(fit) => {
            setTemplate((t) => ({ ...t, backgroundFit: fit }))
            canvasRef.current?.updateBackgroundFit(fit)
          }}
        />

        {designTemplate && (
          <CanvasEditor
            ref={canvasRef}
            template={designTemplate}
            designKey={activeDesign}
            assets={[...logos, ...signatures]}
            onTemplateChange={handleTemplateChange}
            onSelectionChange={handleSelectionChange}
            onError={(err) => toast.error(err.message)}
          />
        )}

        <PropertiesPanel
          element={selected}
          assets={[...logos, ...signatures]}
          onUpdate={(patch) => canvasRef.current?.updateSelected(patch)}
          onDelete={() => canvasRef.current?.deleteSelected()}
          onDuplicate={() => canvasRef.current?.duplicateSelected()}
          onBringForward={() => canvasRef.current?.bringForward()}
          onSendBackward={() => canvasRef.current?.sendBackward()}
        />
      </div>

      {addMode && (
        <AddFieldModal
          mode={addMode}
          onClose={() => setAddMode(null)}
          onSubmit={onSubmitAddField}
        />
      )}

      {previewOpen && templateForPreview && (
        <Modal
          title={`Preview — ${templateForPreview.name} (${DESIGN_NAMES[activeDesign]})`}
          size="xl"
          onClose={() => setPreviewOpen(false)}
          footer={
            <>
              <span className="muted small">Rendered with sample data</span>
              <button className="btn btn-primary" onClick={() => setPreviewOpen(false)}>Close</button>
            </>
          }
        >
          <div className="cert-preview-viewport">
            <TemplateThumb
              template={templateForPreview}
              designKey={activeDesign}
              data={sampleDataForTemplate(templateForPreview)}
              className="cert-preview-frame"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
