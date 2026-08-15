export default function GenerationProgress({ phase, progress, results, batchName, onAbort, onDownloadZip, onDownloadPdf, onDownloadOne }) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div>
      {phase === 'running' && (
        <div className="card">
          <div className="card-body">
            <h3 className="card-title mb-8">Generating certificates…</h3>
            <div className="progress-track mb-8">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex-between">
              <span className="muted">{progress.done} / {progress.total} certificates</span>
              <span style={{ fontWeight: 700 }}>{pct}%</span>
            </div>
            <div className="flex mt-16">
              <button className="btn btn-danger-ghost btn-sm" onClick={onAbort}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="alert alert-error">
          Generation failed. Check the template and data, then try again.
        </div>
      )}

      {phase === 'done' && (
        <div>
          <div className="alert alert-success">
            ✅ {results.length} certificate{results.length === 1 ? '' : 's'} generated successfully.
          </div>
          <div className="card">
            <div className="card-header">
              <span>Batch: <strong>{batchName}</strong></span>
              <span className="badge badge-teal">{results.length} certs</span>
            </div>
            <div className="card-body">
              <div className="flex flex-wrap mb-16">
                <button className="btn btn-primary" onClick={onDownloadPdf}>⬇ Download All (PDF)</button>
                <button className="btn btn-secondary" onClick={onDownloadZip}>⬇ Download All (ZIP)</button>
              </div>
              <h4 className="mb-8">Individual Downloads</h4>
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>File</th>
                      <th style={{ textAlign: 'right' }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td className="mono small">{r.key}.pdf</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => onDownloadOne(i)}>
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
