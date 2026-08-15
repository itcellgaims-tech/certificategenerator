import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/templates', label: 'Templates', icon: '▤' },
  { to: '/assets', label: 'Assets', icon: '❏' },
  { to: '/producer', label: 'Mass Producer', icon: '⚙' },
  { to: '/certificates', label: 'Generated Certificates', icon: '📄' },
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">Certificates stored locally in your browser.</div>
    </aside>
  )
}
