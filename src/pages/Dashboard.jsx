import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { templateService } from '../services/templateService'
import { assetService } from '../services/assetService'
import { batchService } from '../services/batchService'
import { formatDate } from '../utils/fileUtils'

export default function Dashboard() {
  const [stats, setStats] = useState({ templates: 0, logos: 0, signatures: 0, batches: 0 })
  const [recentBatches, setRecentBatches] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    Promise.all([
      templateService.count(),
      assetService.count('logo'),
      assetService.count('signature'),
      batchService.count(),
      batchService.list(),
    ]).then(([templates, logos, signatures, batches, list]) => {
      if (!alive) return
      setStats({ templates, logos, signatures, batches })
      setRecentBatches(list.slice(0, 5))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Create templates, upload assets and mass-generate certificates.</p>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        <div className="card stat-card">
          <div className="stat-label">Templates</div>
          <div className="stat-value">{stats.templates}</div>
          <div className="flex mt-8">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/templates/new')}>Create Template</button>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Logos</div>
          <div className="stat-value">{stats.logos}</div>
          <div className="flex mt-8">
            <Link className="btn btn-secondary btn-sm" to="/assets">Manage Assets</Link>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Signatures</div>
          <div className="stat-value">{stats.signatures}</div>
          <div className="flex mt-8">
            <Link className="btn btn-secondary btn-sm" to="/assets">Manage Assets</Link>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Generated Batches</div>
          <div className="stat-value">{stats.batches}</div>
          <div className="flex mt-8">
            <Link className="btn btn-secondary btn-sm" to="/certificates">View History</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">Quick Actions</div>
          <div className="card-body">
            <div className="flex flex-wrap" style={{ gap: 10 }}>
              <button className="btn btn-primary" onClick={() => navigate('/templates/new')}>＋ Create Template</button>
              <button className="btn btn-secondary" onClick={() => navigate('/producer')}>⚙ Mass Produce</button>
              <Link className="btn btn-secondary" to="/assets">❏ Upload Logo / Signature</Link>
            </div>
            <p className="muted small mt-16" style={{ maxWidth: 520 }}>
              Flow: create a template (background, logo, signature, {'\{\{placeholders\}\}'}) → save →
              open Mass Producer → pick template → enter event details → upload recipient list →
              generate → download as ZIP.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            Recent Batches
            <Link to="/certificates" className="small">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Template</th>
                  <th style={{ textAlign: 'right' }}>Certs</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No batches generated yet.</td>
                  </tr>
                )}
                {recentBatches.map((b) => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/certificates')}>
                    <td>{b.name}</td>
                    <td>{b.templateName}</td>
                    <td style={{ textAlign: 'right' }}>{b.certificateCount}</td>
                    <td>{formatDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
