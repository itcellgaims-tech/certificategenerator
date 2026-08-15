import { useState } from 'react'
import Modal from '../common/Modal'
import { extractVariables, findMalformedPlaceholders, validateVariableName } from '../../utils/placeholderParser'

export default function AddFieldModal({ mode, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [variable, setVariable] = useState('')
  const [content, setContent] = useState('')

  const isVariable = mode === 'variable'
  const isParagraph = mode === 'paragraph'

  const varError = isVariable ? validateVariableName(variable) : null
  const detectedVars = isParagraph ? extractVariables(content) : []
  const malformed = isParagraph ? findMalformedPlaceholders(content) : []

  const canSubmit = () => {
    if (isVariable) return name.trim() && variable.trim() && !varError
    if (isParagraph) return content.trim() && malformed.length === 0 && detectedVars.length > 0
    return content.trim() !== ''
  }

  const submit = () => {
    if (isVariable) {
      onSubmit({ label: name.trim(), variable: variable.trim() })
    } else {
      onSubmit(content)
    }
    onClose()
  }

  const titles = { variable: 'Add Variable Field', paragraph: 'Add Paragraph', text: 'Add Static Text' }

  return (
    <Modal
      title={titles[mode]}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!canSubmit()}>
            {isVariable ? 'Add Field' : 'Add'}
          </button>
        </>
      }
    >
      {isVariable && (
        <>
          <div className="field">
            <label>Field Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Recipient Name"
              autoFocus
            />
            <p className="tooltip-msg">Used as the display name for this field.</p>
          </div>
          <div className="field">
            <label>Variable</label>
            <input
              className="input mono"
              value={variable}
              onChange={(e) => setVariable(e.target.value.replace(/\s+/g, '_').toLowerCase())}
              placeholder="e.g. recipient_name"
            />
            {varError ? (
              <div className="alert alert-error" style={{ padding: '8px 10px' }}>{varError}</div>
            ) : (
              <p className="tooltip-msg">
                Stored as: <span className="variable-chip">{'\{\{'+variable+'\}\}'}</span>
              </p>
            )}
          </div>
        </>
      )}

      {isParagraph && (
        <>
          <div className="field">
            <label>Paragraph</label>
            <textarea
              className="textarea mono"
              rows={7}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'Use {{variable}} placeholders. Example:\n\nThis certificate is proudly presented to {{recipient_name}} for serving as a Volunteer during {{event_name}}.'}
              autoFocus
            />
          </div>
          <div className="field mb-0">
            <label>Detected Variables</label>
            <div className="flex flex-wrap mb-8" style={{ gap: 6 }}>
              {detectedVars.length === 0 ? (
                <span className="muted small">No variables detected yet.</span>
              ) : (
                detectedVars.map((v) => (
                  <span key={v} className="variable-chip">{'\{\{'+v+'\}\}'}</span>
                ))
              )}
            </div>
            {malformed.length > 0 && (
              <div className="alert alert-error">
                <div className="small" style={{ fontWeight: 600 }}>Malformed placeholders:</div>
                {malformed.map((m, i) => (
                  <div key={i} className="small mono">{m.text} — {m.message}</div>
                ))}
              </div>
            )}
            <p className="tooltip-msg">Variables are automatically detected from the paragraph.</p>
          </div>
        </>
      )}

      {mode === 'text' && (
        <div className="field mb-0">
          <label>Text</label>
          <input
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g. Certificate of Appreciation"
            autoFocus
          />
        </div>
      )}
    </Modal>
  )
}
