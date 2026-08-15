import TemplateThumb from '../common/TemplateThumb'

export default function TemplateSelector({ templates, selectedId, onSelect }) {
  return (
    <div>
      <p className="muted small">Select the certificate template to use. A preview is shown using sample data.</p>
      <div className="grid grid-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className={`card template-card ${selectedId === t.id ? 'selected' : ''}`}
            onClick={() => onSelect(t)}
            style={selectedId === t.id ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px rgba(15,118,110,0.2)' } : undefined}
          >
            <div className="template-thumb">
              <TemplateThumb template={t} />
            </div>
            <div className="template-card-body">
              <h3 className="template-card-title">{t.name}</h3>
              <div className="template-card-meta">
                <span className="badge badge-teal">{t.type || 'Certificate'}</span>
                <span>{t.canvas?.width} × {t.canvas?.height}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
