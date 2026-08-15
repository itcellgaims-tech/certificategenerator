import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import TemplateEditor from './pages/TemplateEditor'
import Assets from './pages/Assets'
import MassProducer from './pages/MassProducer'
import GeneratedCertificates from './pages/GeneratedCertificates'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/new" element={<TemplateEditor />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/producer" element={<MassProducer />} />
          <Route path="/certificates" element={<GeneratedCertificates />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}
