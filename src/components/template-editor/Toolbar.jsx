import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { extractVariables, findMalformedPlaceholders } from '../../utils/placeholderParser'
import { collectTemplateVariables } from '../../utils/validation'

export default function Toolbar({
  template,
  logos = [],
  signatures = [],
  elements = [],
  selectedId = null,
  onSelectElement,
  onDeleteElement,
  onAddVariable,
  onAddParagraph,
  onAddStaticText,
  onAddImage,
  onBackgroundFile,
  onRemoveBackground,
  onFitChange,
}) {
  const bgInputRef = useRef(null)
  const variables = collectTemplateVariables(template)
  const malformed = findMalformedPlaceholders((template?.elements || []).map((e) => e.content || '').join(' '))

  const renderAssetList = (list, emptyText) => {
    if (list.length === 0) {
      return (
        <div className="muted small mb-8">
          {emptyText}{' '}
          <Link to="/assets">Add assets</Link>
        </div>
      )
    }
    return list.map((a) => (
      <div key={a.id} className="asset-pill" title="Click to add to canvas" onClick={() => onAddImage(a.id)}>
        <img src={a.dataUrl} alt={a.name} />
        <span className="name">{a.name}</span>
        <span className="type-tag">click to add</span>
      </div>
    ))
  }

  return (
    <div className="editor-sidebar">
      <div className="side-card">
        <h4>Background</h4>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onBackgroundFile(f)
            e.target.value = ''
          }}
        />
        <button className="btn btn-secondary btn-sm mb-8" onClick={() => bgInputRef.current?.click()} style={{ width: '100%' }}>
          {template?.background ? 'Replace Background' : 'Upload Background'}
        </button>
        <div className="prop-row mb-8" style={{ marginBottom: 8 }}>
          <label>Position</label>
          <select
            className="input"
            value={template?.backgroundFit || 'stretch'}
            onChange={(e) => onFitChange(e.target.value)}
          >
            <option value="stretch">Fill (stretch)</option>
            <option value="fit">Fit (contain)</option>
            <option value="cover">Cover (crop)</option>
          </select>
        </div>
        {template?.background && (
          <button className="btn btn-danger-ghost btn-sm" onClick={onRemoveBackground} style={{ width: '100%' }}>
            Remove Background
          </button>
        )}
      </div>

      <div className="side-card">
        <h4>Assets — Logos</h4>
        {renderAssetList(logos, 'No logos yet.')}
      </div>

      <div className="side-card">
        <h4>Assets — Signatures</h4>
        {renderAssetList(signatures, 'No signatures yet.')}
      </div>

      <div className="side-card">
        <h4>Add Field</h4>
        <div className="flex" style={{ flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={onAddVariable}>＋ Variable</button>
          <button className="btn btn-secondary btn-sm" onClick={onAddParagraph}>＋ Paragraph</button>
          <button className="btn btn-secondary btn-sm" onClick={onAddStaticText}>＋ Static Text</button>
        </div>
      </div>

      <div className="side-card">
        <h4>Elements</h4>
        {elements.length === 0 ? (
          <div className="muted small">No elements yet. Add a field to begin.</div>
        ) : (
          elements.map((el, i) => (
            <div
              key={el.id}
              className={`asset-pill ${selectedId === el.id ? 'selected' : ''}`}
              onClick={() => onSelectElement(el.id)}
              style={selectedId === el.id ? { borderColor: 'var(--primary)', background: 'var(--primary-light)' } : undefined}
            >
              <span className="name">
                {el.type === 'image' ? '🖼 ' : el.type === 'paragraph' ? '¶ ' : 'T '}
                {el.name || el.content || `Element ${i + 1}`}
              </span>
              <button
                className="icon-btn danger"
                style={{ width: 22, height: 22, fontSize: 11 }}
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteElement(el.id)
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="side-card">
        <h4>Template Variables</h4>
        {variables.length === 0 ? (
          <div className="muted small">No variables yet.</div>
        ) : (
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {variables.map((v) => (
              <span key={v} className="variable-chip">{'\{\{'+v+'\}\}'}</span>
            ))}
          </div>
        )}
        {malformed.length > 0 && (
          <div className="alert alert-error" style={{ padding: '8px 10px', marginTop: 8 }}>
            <div className="small" style={{ fontWeight: 600 }}>Malformed placeholders detected:</div>
            {malformed.slice(0, 3).map((m, i) => (
              <div key={i} className="small mono">{m.text}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
