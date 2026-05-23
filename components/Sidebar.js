'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

const ADMIN_USERS = {
  'alex@ohheythere.cafe': { name: 'Alex', role: 'Managing Director', color: '#7ab648', initials: 'A' },
  'cj@ohheythere.cafe':   { name: 'CJ',   role: 'CEO',               color: '#4a90c4', initials: 'CJ' },
}

export default function Sidebar({ user }) {
  const router = useRouter()
  const pathname = usePathname()
  const profile = ADMIN_USERS[user?.email] || { name: user?.email?.split('@')[0] || 'Admin', role: 'Admin', color: '#7ab648', initials: 'A' }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const links = [
    { href: '/dashboard',  icon: '🏠', label: 'Dashboard',     section: 'Overview' },
    { href: '/schedule',   icon: '📅', label: 'Scheduling',    section: 'Operations' },
    { href: '/tasks',      icon: '✅', label: 'Tasks',         section: null },
    { href: '/payroll',    icon: '💸', label: 'Payroll',       section: null },
    { href: '/staff',      icon: '👥', label: 'Staff',         section: null },
    { href: '/announce',   icon: '📣', label: 'Announcements', section: 'Comms' },
    { href: '/settings',   icon: '⚙️', label: 'Settings',      section: 'Admin' },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Oh Hey There</div>
        <div className="sidebar-brand-sub">Command Center</div>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar" style={{ background: profile.color }}>
          {profile.initials}
        </div>
        <div>
          <div className="sidebar-user-name">{profile.name}</div>
          <div className="sidebar-user-role">{profile.role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link, i) => {
          const prevSection = i > 0 ? links[i-1].section : null
          const showSection = link.section && link.section !== prevSection
          return (
            <div key={link.href}>
              {showSection && <div className="sidebar-section">{link.section}</div>}
              <a
                href={link.href}
                className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                {link.label}
              </a>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-signout" onClick={signOut}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
