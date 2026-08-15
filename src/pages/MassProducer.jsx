import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TemplateSelector from '../components/mass-producer/TemplateSelector'
import RecipientGrid from '../components/mass-producer/RecipientGrid'
import GenerationProgress from '../components/mass-producer/GenerationProgress'
import Modal from '../components/common/Modal'
import { templateService } from '../services/templateService'
import { assetService } from '../services/assetService'
import { batchService } from '../services/batchService'
import { generateBatch, buildZip, mergePdfs, renderCertificate } from '../services/certificateGenerator'
import { parseFile } from '../utils/excelParser'
import { validateData, classifyVariables } from '../utils/validation'
import { COMMON_VAR_LABELS, RECIPIENT_VAR } from '../constants/config'
import {
  DEFAULT_DESIGN_KEY,
  normalizeCertificateType,
  normalizeTemplateDesigns,
  resolveDesignKey,
  templateForDesign,
} from '../utils/templateDesigns'
import { useToast } from '../context/ToastContext'
import { downloadBlob, slugifyName } from '../utils/fileUtils'

const STEPS = ['Template', 'Common Details', 'Recipients', 'Validate', 'Preview', 'Generate']

function mapRecordsToRows(records, neededVars) {
  return records.map((rec) => {
    const row = {}
    row.certificate_type = normalizeCertificateType(rec.certificate_type) || 'Volunteer'
    for (const v of neededVars) {
      if (v === RECIPIENT_VAR) {
        row[v] =
          String(rec[v] ?? '').trim() ||
          String(rec.name ?? '').trim() ||
          String(rec.full_name ?? '').trim() ||
          String(rec.fullname ?? '').trim()
      } else {
        row[v] = String(rec[v] ?? '').trim()
      }
    }
    return row
  })
}

export default function MassProducer() {
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState([])
  const [template, setTemplate] = useState(null)
  const [common, setCommon] = useState({})
  const [rows, setRows] = useState([])
  const [requireUnique, setRequireUnique] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [report, setReport] = useState(null)
  const [previews, setPreviews] = useState([])
  const [gen, setGen] = useState({ phase: 'idle', progress: null, results: [] })
  const [busy, setBusy] = useState(false)

  const abortRef = useRef(false)
  const toast = useToast()

  const fieldMap = useMemo(() => (template ? classifyVariables(template) : null), [template])

  useEffect(() => {
    templateService.list().then(setTemplates)
  }, [])

  const assetProvider = async (id) => {
    const a = await assetService.get(id)
    return a
  }

  const batchName =
    (template ? (common.event_name || 'Certificates') + ' — ' + template.name : 'Certificates') || 'Certificates'

  const onSelectTemplate = (t) => {
    setTemplate(normalizeTemplateDesigns(t))
    setCommon({})
    setRows([])
    setReport(null)
    setPreviews([])
    setGen({ phase: 'idle', progress: null, results: [] })
    setStep(2)
  }

  const commonReady = () => {
    if (!fieldMap) return true
    return fieldMap.commonVars.every((v) => String(common[v] ?? '').trim())
  }

  const onUploadFile = async (file) => {
    try {
      const parsed = await parseFile(file)
      const needed = [fieldMap.recipientVar, ...fieldMap.perRowVars].filter(Boolean)
      const mapped = mapRecordsToRows(parsed.records, needed)
      if (mapped.length === 0) {
        toast.info('No data rows found in file.')
        return
      }
      setRows(mapped)
      setFileInfo({
        name: file.name,
        rows: mapped.length,
        columns: parsed.columns.map((c) => c.key || c.raw),
        matched: parsed.columns.filter((c) => needed.includes(c.key)).map((c) => c.key),
      })
      toast.success(`Loaded ${mapped.length} recipients from ${file.name}.`)
    } catch (err) {
      toast.error(`Could not read file: ${err.message}`)
    }
  }

  const runValidation = () => {
    const r = validateData({ rows, common, template, requireUnique, defaultDesignKey: DEFAULT_DESIGN_KEY })
    setReport(r)
    return r
  }

  const goValidate = () => {
    const r = runValidation()
    if (r.errors.length === 0 && r.total > 0) {
      toast.success('All data looks good.')
    }
    setStep(4)
  }

  const goPreview = async () => {
    const r = report || runValidation()
    setReport(r)
    if (r.invalidCount > 0) {
      toast.error('Fix the highlighted rows before generating.')
      return
    }
    setStep(5)
    setBusy(true)
    try {
      const sampleRows = rows.slice(0, 4)
      const imgs = []
      for (const row of sampleRows) {
        const { dataUrl } = await renderCertificate({
          template: templateForDesign(template, resolveDesignKey(row.certificate_type, DEFAULT_DESIGN_KEY)),
          data: { ...common, ...row },
          assetProvider,
        })
        imgs.push({ name: row.recipient_name || 'Certificate', dataUrl })
      }
      setPreviews(imgs)
    } catch (err) {
      toast.error(`Preview failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const startGenerate = async () => {
    abortRef.current = false
    setGen({ phase: 'running', progress: { done: 0, total: rows.length }, results: [] })
    setStep(6)
    try {
      const results = await generateBatch({
        template,
        rows,
        common,
        defaultDesignKey: DEFAULT_DESIGN_KEY,
        assetProvider,
        onProgress: ({ done, total }) => setGen((g) => ({ ...g, progress: { done, total } })),
        shouldAbort: () => abortRef.current,
      })
      if (abortRef.current) {
        setGen({ phase: 'idle', progress: null, results: [] })
        setStep(5)
        toast.info('Generation cancelled.')
        return
      }
      setGen({ phase: 'done', progress: { done: results.length, total: rows.length }, results })
      await batchService.save({
        name: batchName,
        templateId: template.id,
        templateName: template.name,
        template,
        defaultDesignKey: DEFAULT_DESIGN_KEY,
        common,
        rows,
        certificateCount: results.length,
      })
      toast.success('Batch saved to history.')
    } catch (err) {
      setGen({ phase: 'error', progress: null, results: [] })
      toast.error(`Generation failed: ${err.message}`)
    }
  }

  const downloadZip = async () => {
    try {
      setBusy(true)
      const blob = await buildZip(gen.results, `${batchName}.zip`)
      downloadBlob(blob, `${batchName}.zip`)
    } catch (err) {
      toast.error(`ZIP failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const downloadPdf = async () => {
    try {
      setBusy(true)
      const blob = await mergePdfs(gen.results)
      const name = slugifyName(common.college_name || '') || slugifyName(batchName) || 'Certificates'
      downloadBlob(new Blob([blob], { type: 'application/pdf' }), `${name}.pdf`)
      toast.success('All certificates downloaded as one PDF.')
    } catch (err) {
      toast.error(`PDF failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const downloadOne = (index) => {
    const r = gen.results[index]
    if (!r) return
    downloadBlob(new Blob([r.pdfBytes], { type: 'application/pdf' }), `${r.key}.pdf`)
  }

  const neededVars = fieldMap ? [fieldMap.recipientVar, ...fieldMap.perRowVars].filter(Boolean) : []
  const gridColumns = ['certificate_type', ...neededVars]
  const checkColumns = { certificate_type: { label: 'Organiser?', on: 'Organiser', off: 'Volunteer' } }
  const invalidRows = report ? new Set(report.errors.filter((e) => e.row > 0).map((e) => e.row)) : new Set()

  const canNextFromValidate = report ? report.invalidCount === 0 && report.total > 0 : false

  return (
    <div className="page wizard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mass Producer</h1>
          <p className="page-subtitle">Select a template, add event details and recipient data, then generate certificates.</p>
        </div>
      </div>

      <div className="steps">
        {STEPS.map((label, i) => {
          const n = i + 1
          return (
            <div key={label} className={`step-item ${n === step ? 'active' : ''} ${n < step ? 'done' : ''}`}>
              <div className="step-circle">{n < step ? '✓' : n}</div>
              <div className="step-label">{label}</div>
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div>
          <TemplateSelector templates={templates} selectedId={template?.id} onSelect={onSelectTemplate} />
          {templates.length === 0 && (
            <div className="alert alert-info mt-16">
              No templates yet. <Link to="/templates">Create a template</Link> first.
            </div>
          )}
        </div>
      )}

      {step === 2 && template && (
        <div className="card">
          <div className="card-header">
            Common Event Details
            <span className="muted small">These values fill the same placeholders on every certificate.</span>
          </div>
          <div className="card-body">
            {fieldMap.commonVars.length === 0 ? (
              <div className="alert alert-info">
                This template has no common event fields (college_name, event_name, date, state, committee_name).
              </div>
            ) : (
              <div className="form-grid">
                {fieldMap.commonVars.map((v) => (
                  <div className="field" key={v}>
                    <label>
                      {COMMON_VAR_LABELS[v] || v} <span className="variable-chip">{'\{\{'+v+'\}\}'}</span>
                    </label>
                    <input
                      className="input"
                      value={common[v] ?? ''}
                      onChange={(e) => setCommon({ ...common, [v]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex mt-16">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-primary" disabled={!commonReady()} onClick={() => setStep(3)}>
                Next →
              </button>
            </div>
            {!commonReady() && <p className="tooltip-msg">Please fill all common event details.</p>}
          </div>
        </div>
      )}

      {step === 3 && template && (
        <div className="card">
          <div className="card-header">
            Recipient Data
            <span className="muted small">
              Columns: {neededVars.map((v) => <span key={v} className="variable-chip">{'\{\{'+v+'\}\}'}</span>)}
            </span>
          </div>
          <div className="card-body">
            <div
              className="dropzone"
              onClick={() => document.getElementById('recipient-file-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) onUploadFile(f)
              }}
            >
              <div style={{ fontSize: 26 }}>⬆</div>
              <div style={{ fontWeight: 600 }}>Upload Excel (.xlsx) or CSV</div>
              <div className="small">
                Column headers are matched to placeholders automatically (e.g. <span className="mono">Recipient Name</span> →{' '}
                <span className="mono">{RECIPIENT_VAR}</span>). An optional{' '}
                <span className="mono">Certificate Type</span> (Volunteer / Organiser) column is respected, otherwise
                use each row's <strong>Organiser?</strong> checkbox below.
              </div>
              <input
                id="recipient-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onUploadFile(f)
                  e.target.value = ''
                }}
              />
            </div>

            {fileInfo && (
              <div className="alert alert-info mt-16">
                <strong>{fileInfo.name}</strong> · {fileInfo.rows} rows loaded. Columns matched:{' '}
                {fileInfo.matched.length ? fileInfo.matched.join(', ') : 'none — edit manually below'}
              </div>
            )}

            <div className="mt-16">
              <label className="flex" style={{ marginBottom: 10 }}>
                <span style={{ width: 220 }}>Certificate Type</span>
                <span className="muted small">
                  Tick <strong>Organiser?</strong> for the Organiser certificate. Unticked = Volunteer certificate.
                </span>
              </label>
              <RecipientGrid
                columns={gridColumns}
                rows={rows}
                onRowsChange={setRows}
                errorRows={invalidRows}
                checkColumns={checkColumns}
              />
            </div>

            <div className="flex mt-16">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={goValidate} disabled={rows.length === 0}>
                Validate Data →
              </button>
            </div>
            {rows.length === 0 && <p className="tooltip-msg">Add at least one recipient before validating.</p>}
          </div>
        </div>
      )}

      {step === 4 && report && (
        <div className="card">
          <div className="card-header">
            Data Validation
            <span className="badge badge-green">{report.validCount} ready</span>
            {report.invalidCount > 0 && <span className="badge badge-red">{report.invalidCount} issues</span>}
          </div>
          <div className="card-body">
            {report.errors.length > 0 ? (
              <div className="alert alert-error">
                <div style={{ fontWeight: 600 }}>Missing required data:</div>
                {report.errors.map((e, i) => (
                  <div key={i} className="small">
                    {e.row === 0 ? (
                      <>Common event detail missing: {e.missing.join(', ')}</>
                    ) : (
                      <>Row {e.row}: missing {e.missing.join(', ')}</>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-success">All {report.total} records are ready for generation.</div>
            )}

            {report.warnings.length > 0 && (
              <div className="alert alert-warn">
                <div style={{ fontWeight: 600 }}>Warnings:</div>
                {report.warnings.map((w, i) => (
                  <div key={i} className="small">Row {w.row}: {w.message}</div>
                ))}
              </div>
            )}

            <div className="mt-16">
              <label className="flex" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={requireUnique} onChange={(e) => setRequireUnique(e.target.checked)} />
                <span>Warn about duplicate recipient names</span>
              </label>
              <RecipientGrid
                columns={gridColumns}
                rows={rows}
                onRowsChange={setRows}
                errorRows={invalidRows}
                checkColumns={checkColumns}
              />
            </div>

            <div className="flex mt-16">
              <button className="btn btn-secondary" onClick={() => setStep(3)}>← Edit Data</button>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={goPreview} disabled={!canNextFromValidate}>
                Preview Certificates →
              </button>
            </div>
            {!canNextFromValidate && <p className="tooltip-msg">Resolve all issues before previewing.</p>}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <div className="card-header">
            Preview
            <span className="muted small">First {previews.length} certificate{previews.length === 1 ? '' : 's'} with actual data.</span>
          </div>
          <div className="card-body">
            {busy ? (
              <div className="empty-state">
                <span className="spinner" />
                <p className="muted">Rendering previews…</p>
              </div>
            ) : previews.length === 0 ? (
              <div className="alert alert-error">No previews to show.</div>
            ) : (
              <div className="preview-grid">
                {previews.map((p, i) => (
                  <div key={i}>
                    <div className="flex-between mb-8">
                      <strong className="small">{p.name || `Row ${i + 1}`}</strong>
                    </div>
                    <img src={p.dataUrl} alt={p.name} className="cert-preview-img" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex mt-16">
              <button className="btn btn-secondary" onClick={() => setStep(4)}>← Back</button>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-primary btn-lg" onClick={startGenerate} disabled={busy}>
                Generate {rows.length} Certificate{rows.length === 1 ? '' : 's'} ⚙
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 6 && (
        <div>
          <div className="flex mb-16">
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(5)} disabled={gen.phase === 'running'}>
              ← Back
            </button>
          </div>
          <GenerationProgress
            phase={gen.phase}
            progress={gen.progress}
            results={gen.results}
            batchName={batchName}
            onAbort={() => {
              abortRef.current = true
            }}
            onDownloadZip={downloadZip}
            onDownloadPdf={downloadPdf}
            onDownloadOne={downloadOne}
          />
          {gen.phase === 'done' && (
            <div className="card mt-16">
              <div className="card-body flex">
                <Link className="btn btn-secondary" to="/certificates">View Generated Certificates</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {busy && gen.phase !== 'running' && (
        <Modal title="Please wait" size="sm">
          <div className="flex">
            <span className="spinner" />
            <span>Working…</span>
          </div>
        </Modal>
      )}
    </div>
  )
}
