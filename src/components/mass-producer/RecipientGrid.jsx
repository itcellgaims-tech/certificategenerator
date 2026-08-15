import { prettyLabel } from '../../utils/fileUtils'

/**
 * Editable table for recipient rows.
 * columns: array of variable names
 * rows: array of { [varName]: value }
 * selectColumns: { [column]: [options] } — columns rendered as a dropdown instead of text input.
 * checkColumns: { [column]: { label, on, off } } — columns rendered as a checkbox
 *   (checked = `on` value, unchecked = `off` value). New rows default to the `off` value.
 */
export default function RecipientGrid({
  columns,
  rows,
  onRowsChange,
  errorRows = new Set(),
  readOnly = false,
  selectColumns = {},
  checkColumns = {},
}) {
  const setCell = (rowIdx, col, value) => {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r))
    onRowsChange(next)
  }

  const addRow = () => {
    const row = {}
    columns.forEach((c) => (row[c] = checkColumns[c] ? checkColumns[c].off : ''))
    onRowsChange([...rows, row])
  }

  const removeRow = (idx) => {
    onRowsChange(rows.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              {columns.map((c) => (
                <th key={c}>
                  {checkColumns[c] ? checkColumns[c].label : prettyLabel(c)}{' '}
                  {!selectColumns[c] && !checkColumns[c] && <span className="variable-chip">{'\{\{'+c+'\}\}'}</span>}
                </th>
              ))}
              {!readOnly && <th style={{ width: 60 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="muted">
                  No recipients yet. Upload a file or add rows manually.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c} className={errorRows.has(i + 1) ? 'error-cell' : ''}>
                    {readOnly ? (
                      <span className="cell-value">{r[c] || '—'}</span>
                    ) : checkColumns[c] ? (
                      <label
                        className="cell-check"
                        title={`Check = ${checkColumns[c].on} · uncheck = ${checkColumns[c].off}`}
                      >
                        <input
                          type="checkbox"
                          checked={r[c] === checkColumns[c].on}
                          onChange={(e) =>
                            setCell(i, c, e.target.checked ? checkColumns[c].on : checkColumns[c].off)
                          }
                        />
                      </label>
                    ) : selectColumns[c] ? (
                      <select className="cell-input" value={r[c] || ''} onChange={(e) => setCell(i, c, e.target.value)}>
                        <option value="">—</option>
                        {selectColumns[c].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="cell-input"
                        value={r[c] ?? ''}
                        onChange={(e) => setCell(i, c, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td>
                    <button className="icon-btn danger" style={{ width: 24, height: 24 }} title="Remove row" onClick={() => removeRow(i)}>
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button className="btn btn-secondary btn-sm mt-8" onClick={addRow}>＋ Add Row</button>
      )}
      <p className="tooltip-msg">
        {rows.length} recipient{rows.length === 1 ? '' : 's'} · one certificate is generated per row.
      </p>
    </div>
  )
}
