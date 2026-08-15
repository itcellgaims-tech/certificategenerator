import { FONTS } from '../../constants/config'
import { Color } from 'fabric'
import { extractVariables, findMalformedPlaceholders } from '../../utils/placeholderParser'

const ALIGNS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
]

export default function PropertiesPanel({ element, assets = [], onUpdate, onDelete, onDuplicate, onBringForward, onSendBackward }) {
  if (!element) {
    return (
      <div className="editor-props">
        <div className="prop-section">
          <h4>Properties</h4>
          <p className="muted small mb-0">
            Select an element on the canvas to edit its properties. Use the left panel to add fields, logos and
            signatures.
          </p>
        </div>
      </div>
    )
  }

  const isText = element.type === 'text' || element.type === 'paragraph'
  const set = (patch) => onUpdate(patch)

  const malformed = isText ? findMalformedPlaceholders(element.content) : []

  return (
    <div className="editor-props">
      {isText && (
        <div className="prop-section">
          <h4>Text</h4>
          {element.type === 'paragraph' ? (
            <>
              <div className="field mb-8">
                <label>Paragraph Content</label>
                <textarea
                  className="textarea mono"
                  rows={7}
                  value={element.content}
                  onChange={(e) => set({ content: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap mb-8">
                {extractVariables(element.content).map((v) => (
                  <span key={v} className="variable-chip">{'\{\{'+v+'\}\}'}</span>
                ))}
                {extractVariables(element.content).length === 0 && <span className="muted small">No variables.</span>}
              </div>
            </>
          ) : (
            <div className="field mb-8">
              <label>Text</label>
              <input className="input mono" value={element.content} onChange={(e) => set({ content: e.target.value })} />
            </div>
          )}
          {malformed.length > 0 && (
            <div className="alert alert-error" style={{ padding: '8px 10px', marginBottom: 8 }}>
              {malformed.map((m, i) => (
                <div key={i} className="small">Invalid placeholder: {m.text}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="prop-section">
        <h4>Position</h4>
        <div className="prop-row">
          <label>X</label>
          <input
            className="input number"
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => set({ x: Number(e.target.value) })}
          />
          <label>Y</label>
          <input
            className="input number"
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => set({ y: Number(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <label>Angle</label>
          <input
            className="input number"
            type="number"
            value={Math.round(element.angle || 0)}
            onChange={(e) => set({ angle: Number(e.target.value) })}
          />
          <label>Opacity</label>
          <input
            className="input number"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={element.opacity ?? 1}
            onChange={(e) => set({ opacity: Number(e.target.value) })}
          />
        </div>
      </div>

      {isText && (
        <div className="prop-section">
          <h4>Font</h4>
          <div className="prop-row">
            <label>Family</label>
            <select
              className="input wide"
              value={element.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
            >
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="prop-row">
            <label>Size</label>
            <input
              className="input number"
              type="number"
              min="6"
              value={element.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
            />
            <label>Weight</label>
            <select
              className="input"
              style={{ width: 92 }}
              value={element.fontWeight}
              onChange={(e) => set({ fontWeight: e.target.value })}
            >
              <option value="normal">Regular</option>
              <option value="bold">Bold</option>
            </select>
          </div>
          <div className="prop-row">
            <label>Style</label>
            <div className="seg wide">
              <button className={element.fontStyle === 'normal' ? 'active' : ''} onClick={() => set({ fontStyle: 'normal' })}>
                Regular
              </button>
              <button className={element.fontStyle === 'italic' ? 'active' : ''} onClick={() => set({ fontStyle: 'italic' })}>
                Italic
              </button>
            </div>
          </div>
          <div className="prop-row">
            <label>Align</label>
            <div className="seg wide">
              {ALIGNS.map((a) => (
                <button
                  key={a.value}
                  className={element.textAlign === a.value ? 'active' : ''}
                  onClick={() => set({ textAlign: a.value })}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-row">
            <label>Line Height</label>
            <input
              className="input number"
              type="number"
              min="0.5"
              step="0.05"
              value={element.lineHeight}
              onChange={(e) => set({ lineHeight: Number(e.target.value) })}
            />
            <label>Letter</label>
            <input
              className="input number"
              type="number"
              step="0.5"
              value={element.letterSpacing ?? 0}
              onChange={(e) => set({ letterSpacing: Number(e.target.value) })}
            />
          </div>
          <div className="prop-row">
            <label>Colour</label>
            <div className="color-field wide">
              <input
                type="color"
                value={normalizeColor(element.fill)}
                onChange={(e) => set({ fill: e.target.value })}
              />
              <input
                className="input mono"
                value={element.fill}
                onChange={(e) => set({ fill: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {element.type === 'paragraph' && (
            <div className="prop-row">
              <label>Width</label>
              <input
                className="input number"
                type="number"
                min="50"
                value={Math.round(element.width)}
                onChange={(e) => set({ width: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
      )}

      {element.type === 'image' && (
        <div className="prop-section">
          <h4>Image</h4>
          <div className="prop-row">
            <label>Asset</label>
            <select
              className="input wide"
              value={element.assetId}
              onChange={(e) => {
                const a = assets.find((x) => x.id === e.target.value)
                if (a) onUpdate({ assetId: a.id })
              }}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="prop-row">
            <label>Width</label>
            <input
              className="input number"
              type="number"
              min="10"
              value={Math.round(element.width)}
              onChange={(e) => set({ width: Number(e.target.value), height: Math.round((element.height / element.width) * Number(e.target.value)) })}
            />
            <label>Height</label>
            <input
              className="input number"
              type="number"
              min="10"
              value={Math.round(element.height)}
              onChange={(e) => set({ height: Number(e.target.value), width: Math.round((element.width / element.height) * Number(e.target.value)) })}
            />
          </div>
        </div>
      )}

      <div className="prop-section">
        <h4>Actions</h4>
        <div className="flex flex-wrap">
          <button className="btn btn-secondary btn-sm" onClick={onDuplicate}>Duplicate</button>
          <button className="btn btn-secondary btn-sm" onClick={onBringForward}>Bring Forward</button>
          <button className="btn btn-secondary btn-sm" onClick={onSendBackward}>Send Backward</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function normalizeColor(color) {
  if (!color) return '#000000'
  if (color.startsWith('#')) return color
  try {
    return new Color(color).toHex()
  } catch {
    return '#000000'
  }
}
