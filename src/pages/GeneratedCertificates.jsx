import { useEffect, useState } from 'react'
import Modal from '../components/common/Modal'
import { batchService } from '../services/batchService'
import { assetService } from '../services/assetService'
import { generateCertificate, generateBatch, buildZip, mergePdfs, renderCertificate } from '../services/certificateGenerator'
import { resolveDesignKey, templateForDesign } from '../utils/templateDesigns'
import { useToast } from '../context/ToastContext'
import { downloadBlob, formatDateTime, slugifyName } from '../utils/fileUtils'

export default function GeneratedCertificates() {
  const [batches, setBatches] = useState([])
  const [busy, setBusy] = useState(null)
  const [previewBatch, setPreviewBatch] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewImg, setPreviewImg] = useState(null)
  const toast = useToast()

  const load = async () => {
    setBatches(await batchService.list())
  }

  useEffect(() => {
    load()
  }, [])

  const assetProvider = async (id) => {
    const a = await assetService.get(id)
    return a
  }

  const openPreview = (batch) => {
    setPreviewBatch(batch)
    setPreviewIndex(0)
    setPreviewImg(null)
  }

  useEffect(() => {
    if (!previewBatch) return
    let alive = true
    setPreviewImg(null)
    const row = previewBatch.rows?.[previewIndex]
    renderCertificate({
      template: templateForDesign(previewBatch.template, resolveDesignKey(row?.certificate_type, previewBatch.defaultDesignKey)),
      data: { ...previewBatch.common, ...row },
      assetProvider,
    })
      .then(({ dataUrl }) => alive && setPreviewImg(dataUrl))
      .catch(() => alive && setPreviewImg(null))
    return () => {
      alive = false
    }
  }, [previewBatch, previewIndex])

  const downloadOne = async (batch, index) => {
    try {
      setBusy(`Preparing certificate…`)
      const row = batch.rows?.[index]
      const res = await generateCertificate({
        template: batch.template,
        data: { ...batch.common, ...row },
        defaultDesignKey: batch.defaultDesignKey,
        assetProvider,
      })
      const name = (row?.recipient_name || `Certificate_${index + 1}`).trim()
      downloadBlob(new Blob([res.pdfBytes], { type: 'application/pdf' }), `${name.replace(/\s+/g, '_')}.pdf`)
      toast.success('Certificate downloaded.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const downloadZip = async (batch) => {
    try {
      setBusy('Generating all certificates…')
      const results = await generateBatch({
        template: batch.template,
        rows: batch.rows,
        common: batch.common,
        defaultDesignKey: batch.defaultDesignKey,
        assetProvider,
        onProgress: ({ done, total }) => setBusy(`Generating certificates… ${done}/${total}`),
      })
      const blob = await buildZip(results, `${batch.name || 'Certificates'}.zip`)
      downloadBlob(blob, `${batch.name || 'Certificates'}.zip`)
      toast.success(`${results.length} certificates downloaded as ZIP.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = async (batch) => {
    try {
      setBusy('Generating all certificates…')
      const results = await generateBatch({
        template: batch.template,
        rows: batch.rows,
        common: batch.common,
        defaultDesignKey: batch.defaultDesignKey,
        assetProvider,
        onProgress: ({ done, total }) => setBusy(`Generating certificates… ${done}/${total}`),
      })
      const blob = await mergePdfs(results)
      const name = slugifyName(batch.common?.college_name || '') || slugifyName(batch.name || '') || 'Certificates'
      downloadBlob(new Blob([blob], { type: 'application/pdf' }), `${name}.pdf`)
      toast.success(`${results.length} certificates downloaded as one PDF.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const remove = async (batch) => {
    if (!window.confirm(`Delete batch "${batch.name}"? This removes the history entry.`)) return
    await batchService.remove(batch.id)
    toast.success('Batch deleted.')
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Generated Certificates</h1>
          <p className="page-subtitle">Recently generated batches. Download individual certificates or the whole batch.</p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state">
          <div className="big">🗂</div>
          <p>No batches generated yet.</p>
          <p className="small">Use the Mass Producer to generate your first batch of certificates.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Template</th>
                  <th style={{ textAlign: 'right' }}>Certificates</th>
                  <th>Generated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td>{b.templateName}</td>
                    <td style={{ textAlign: 'right' }}>{b.certificateCount}</td>
                    <td>{formatDateTime(b.createdAt)}</td>
                    <td>
                      <div className="flex" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openPreview(b)}>Preview</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => downloadOne(b, 0)}>Download PDF</button>
                        <button className="btn btn-primary btn-sm" onClick={() => downloadPdf(b)} disabled={busy}>Download All (PDF)</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => downloadZip(b)} disabled={busy}>Download ZIP</button>
                        <button className="icon-btn danger" title="Delete" onClick={() => remove(b)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewBatch && (
        <Modal
          title={`Preview — ${previewBatch.name}`}
          size="lg"
          onClose={() => setPreviewBatch(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))} disabled={previewIndex === 0}>
                ◀ Previous
              </button>
              <span className="muted small">
                {previewIndex + 1} / {previewBatch.rows?.length || 0}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewIndex((i) => Math.min((previewBatch.rows?.length || 1) - 1, i + 1))}
                disabled={previewIndex >= (previewBatch.rows?.length || 1) - 1}
              >
                Next ▶
              </button>
              <button className="btn btn-primary" onClick={() => downloadOne(previewBatch, previewIndex)} disabled={busy}>
                Download this certificate
              </button>
            </>
          }
        >
          {previewImg ? (
            <img src={previewImg} alt="certificate preview" className="cert-preview-img" />
          ) : (
            <div className="empty-state">
              <span className="spinner" />
            </div>
          )}
        </Modal>
      )}

      {busy && (
        <Modal title="Please wait" size="sm">
          <div className="flex">
            <span className="spinner" />
            <span>{busy}</span>
          </div>
        </Modal>
      )}
    </div>
  )
}
