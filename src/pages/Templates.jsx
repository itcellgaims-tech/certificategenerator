import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/common/Modal'
import TemplateThumb from '../components/common/TemplateThumb'
import { templateService } from '../services/templateService'
import { seedExampleTemplates } from '../services/seedService'
import { useToast } from '../context/ToastContext'
import { DEFAULT_TEMPLATE_CANVAS, DEFAULT_DIMS_LABEL } from '../constants/config'
import { formatDate } from '../utils/fileUtils'
import { DESIGN_KEYS, DESIGN_NAMES, designStatus } from '../utils/templateDesigns'

const TYPE_SUGGESTIONS = ['Organiser', 'Volunteer', 'Participation', 'Appreciation', 'Speaker', 'Coordinator']

export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: '' })
  const [seeding, setSeeding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const list = await templateService.list()
    setTemplates(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm({ name: '', type: 'Volunteer' })
    setCreateOpen(true)
  }

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter a template name.')
      return
    }
    const template = await templateService.save({
      id: null,
      name: form.name.trim(),
      type: form.type.trim() || 'Certificate',
      canvas: { ...DEFAULT_TEMPLATE_CANVAS },
      background: null,
      backgroundFit: 'stretch',
      elements: [],
    })
    toast.success('Template created.')
    navigate(`/templates/${template.id}`)
  }

  const duplicate = async (t) => {
    await templateService.duplicate(t.id)
    toast.success('Template duplicated.')
    load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await templateService.remove(deleteTarget.id)
    toast.success('Template deleted.')
    setDeleteTarget(null)
    load()
  }

  const seed = async () => {
    setSeeding(true)
    await seedExampleTemplates()
    toast.success('Example Volunteer & Organiser template created.')
    setSeeding(false)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Create and manage certificate templates.</p>
        </div>
        <div className="flex">
          <button className="btn btn-secondary" onClick={seed} disabled={seeding}>
            {seeding ? <span className="spinner" /> : null} Load Example Templates
          </button>
          <button className="btn btn-primary" onClick={openCreate}>＋ Create Template</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <span className="spinner" />
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <div className="big">🗒️</div>
          <p>No templates yet.</p>
          <p className="small">
            Create a template, or load the example Volunteer / Organiser templates to get started.
          </p>
          <div className="flex" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={openCreate}>＋ Create Template</button>
            <button className="btn btn-secondary" onClick={seed} disabled={seeding}>
              {seeding ? <span className="spinner" /> : null} Load Examples
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          {templates.map((t) => (
            <div key={t.id} className="card template-card" onClick={() => navigate(`/templates/${t.id}`)}>
              <div className="template-thumb">
                <TemplateThumb template={t} />
              </div>
              <div className="template-card-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" title="Duplicate" onClick={() => duplicate(t)}>⧉</button>
                <button className="icon-btn danger" title="Delete" onClick={() => setDeleteTarget(t)}>🗑</button>
              </div>
              <div className="template-card-body">
                <h3 className="template-card-title">{t.name}</h3>
                <div className="template-card-meta">
                  <span className="badge badge-teal">{t.type || 'Certificate'}</span>
                  {(() => {
                    const status = designStatus(t)
                    return DESIGN_KEYS.filter((k) => status[k]).map((k) => (
                      <span key={k} className="badge badge-teal">{DESIGN_NAMES[k]}</span>
                    ))
                  })()}
                  <span>{t.canvas?.width} × {t.canvas?.height}</span>
                  <span>· {t.elements?.length || 0} elements</span>
                </div>
                <div className="muted small mt-8">Updated {formatDate(t.updatedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal
          title="Create Template"
          size="sm"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create}>Create</button>
            </>
          }
        >
          <div className="field">
            <label>Template Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Volunteer Certificate — GAIMS"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Certificate Type</label>
            <input
              className="input"
              list="cert-types"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="e.g. Volunteer, Organiser…"
            />
            <datalist id="cert-types">
              {TYPE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="field mb-0">
            <label>Certificate Dimensions</label>
            <input className="input" value={DEFAULT_DIMS_LABEL} disabled />
            <p className="tooltip-msg">Dimensions are fixed for the editor. Changeable later by the canvas size.</p>
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title="Delete Template"
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </>
          }
        >
          <p>
            Delete template <strong>"{deleteTarget.name}"</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
