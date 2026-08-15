import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: '▦', end: true },
  { to: '/templates', label: 'Templates', short: 'Templates', icon: '▤' },
  { to: '/assets', label: 'Assets', short: 'Assets', icon: '❏' },
  { to: '/producer', label: 'Mass Producer', short: 'Mass', icon: '⚙' },
  { to: '/certificates', label: 'Generated Certificates', short: 'History', icon: '📄' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo-mark">C</span>
        <span>Certificate</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label nav-label-full">{item.label}</span>
            <span className="nav-label nav-label-short">{item.short}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">Certificates stored locally in your browser.</div>
    </aside>
  )
}
