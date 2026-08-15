import { useEffect, useRef, useState } from 'react'
import Modal from '../components/common/Modal'
import { assetService } from '../services/assetService'
import { useToast } from '../context/ToastContext'
import { fileToDataUrl } from '../utils/fileUtils'
import { formatDate } from '../utils/fileUtils'

const TABS = [
  { id: 'logo', label: 'Logos' },
  { id: 'signature', label: 'Signatures' },
]

export default function Assets() {
  const [tab, setTab] = useState('logo')
  const [items, setItems] = useState([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState({ name: '', file: null })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const toast = useToast()

  const load = async () => {
    const list = await assetService.list(tab)
    setItems(list)
  }

  useEffect(() => {
    load()
  }, [tab])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setForm((f) => ({ ...f, file, name: f.name || file.name.replace(/\.[^.]+$/, '') }))
    }
  }

  const upload = async () => {
    if (!form.file) {
      toast.error('Please choose an image file.')
      return
    }
    if (!form.name.trim()) {
      toast.error('Please name the asset.')
      return
    }
    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(form.file)
      await assetService.save({ name: form.name.trim(), type: tab, dataUrl })
      toast.success('Asset uploaded.')
      setUploadOpen(false)
      setForm({ name: '', file: null })
      load()
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.name}"? Templates referencing it will show a warning during generation.`)) return
    await assetService.remove(a.id)
    toast.success('Asset deleted.')
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assets</h1>
          <p className="page-subtitle">Logos and signatures that can be reused across templates.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', file: null }); setUploadOpen(true) }}>
          ＋ Upload {tab === 'logo' ? 'Logo' : 'Signature'}
        </button>
      </div>

      <div className="flex mb-16">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({t.id === 'logo' ? items.filter((x) => x.type === 'logo').length : items.length})
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="big">{tab === 'logo' ? '❏' : '✎'}</div>
          <p>No {tab === 'logo' ? 'logos' : 'signatures'} yet.</p>
          <p className="small">
            Upload a {tab === 'logo' ? 'logo' : 'signature'} to reuse it in any template. Transparent PNG works best for{' '}
            {tab === 'logo' ? 'logos' : 'signatures'}.
          </p>
        </div>
      ) : (
        <div className="grid grid-3">
          {items.map((a) => (
            <div key={a.id} className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={a.dataUrl}
                  alt={a.name}
                  style={{ width: 64, height: 64, objectFit: 'contain', background: '#f1f5f9', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div className="muted small">{a.type}</div>
                  <div className="muted small">Added {formatDate(a.createdAt)}</div>
                </div>
                <button className="icon-btn danger" title="Delete" onClick={() => remove(a)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <Modal
          title={`Upload ${tab === 'logo' ? 'Logo' : 'Signature'}`}
          size="sm"
          onClose={() => setUploadOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={upload} disabled={uploading || !form.file}>
                {uploading ? <span className="spinner" /> : null} Upload
              </button>
            </>
          }
        >
          <div className="field">
            <label>Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. President Signature"
              autoFocus
            />
          </div>
          <div className="field mb-0">
            <label>Image File *</label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile} />
            {form.file && (
              <div className="upload-file-row">
                <img
                  src={URL.createObjectURL(form.file)}
                  alt="preview"
                  style={{ width: 44, height: 44, objectFit: 'contain', background: '#f1f5f9', borderRadius: 6 }}
                />
                <div className="small">{form.file.name}</div>
              </div>
            )}
            <p className="tooltip-msg">
              {tab === 'signature'
                ? 'Use a transparent PNG so the signature blends into the certificate.'
                : 'PNG with transparency is recommended for logos.'}
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
