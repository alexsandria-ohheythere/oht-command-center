'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { can } from '../lib/auth'

const ROLE_PROFILES = {
  'ohheythere.matcha@gmail.com': { name:'Alex', role:'Managing Director', color:'#7ab648', initials:'A' },
  'ohheythere.group@gmail.com':  { name:'CJ',   role:'CEO',               color:'#4a90c4', initials:'CJ' },
  'richelle@ohheythere.cafe':    { name:'Richelle', role:'Cafe Supervisor', color:'#b06af5', initials:'R' },
}

export default function Sidebar({ user, userRole }) {
  const router   = useRouter()
  const pathname = usePathname()
  const role     = userRole?.role || 'staff'

  const profile = ROLE_PROFILES[user?.email] || {
    name: user?.email?.split('@')[0] || 'User',
    role: role.charAt(0).toUpperCase() + role.slice(1),
    color: '#7ab648', initials: (user?.email||'U')[0].toUpperCase(),
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Build nav based on permissions
  const NAV = [
    { type:'section', label:'Overview' },
    { type:'link', href:'/dashboard',  icon:'🏠', label:'Dashboard',       show: true },

    { type:'section', label:'Operations', show: can(role,'schedule')||can(role,'tasks')||can(role,'checkin') },
    { type:'link', href:'/schedule',   icon:'📅', label:'Scheduling',       show: can(role,'schedule')  },
    { type:'link', href:'/tasks',      icon:'✅', label:'Tasks',             show: can(role,'tasks')     },
    { type:'link', href:'/leave',      icon:'🗓️', label:'Leave & Unavail.', show: can(role,'leaveReview') },
    { type:'link', href:'/roles',      icon:'📋', label:'Role Tasks',        show: can(role,'roles')     },
    { type:'link', href:'/checkin',    icon:'✔️', label:'Daily Check-In',    show: can(role,'checkin')   },
    { type:'link', href:'/payroll',    icon:'💸', label:'Payroll',           show: can(role,'payrollUpload') },
    { type:'link', href:'/staff',      icon:'👥', label:'Staff',             show: can(role,'staffView') },

    { type:'section', label:'Finance', show: can(role,'finance') },
    { type:'link', href:'/finance',          icon:'📊', label:'Financial Statement', show: can(role,'finance') },
    { type:'link', href:'/finance/sales',    icon:'💰', label:'Sales',               show: can(role,'finance') },
    { type:'link', href:'/finance/expenses', icon:'🧾', label:'Expenses',            show: can(role,'finance') },
    { type:'link', href:'/finance/forecast', icon:'📈', label:'Forecast',            show: can(role,'finance') },
    { type:'link', href:'/finance/bank',     icon:'🏦', label:'Bank Records',        show: can(role,'finance') },

    { type:'section', label:'Comms', show: can(role,'announcements') },
    { type:'link', href:'/announce',   icon:'📣', label:'Announcements',    show: can(role,'announcements') },

    { type:'section', label:'Admin', show: can(role,'settings') },
    { type:'link', href:'/settings',   icon:'⚙️', label:'Settings',         show: can(role,'settings') },
  ]

  // Supervisor badge
  const roleLabel = role === 'supervisor' ? 'Supervisor Access' : role === 'admin' ? 'Admin Access' : ''

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
          {roleLabel && (
            <div style={{ fontSize:8, fontWeight:700, letterSpacing:1, color: role==='supervisor'?'#b06af5':'var(--matcha-light)', marginTop:2, textTransform:'uppercase' }}>
              {roleLabel}
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.show === false) return null

          if (item.type === 'section') {
            // Don't show section if no visible links follow
            const hasVisibleLinks = NAV.slice(i+1).some(n => n.type === 'link' && n.show !== false) &&
              NAV.slice(i+1).findIndex(n => n.type === 'section' && n.show !== false) !== 0
            return (
              <div key={i} className="sidebar-section">{item.label}</div>
            )
          }

          if (item.type === 'link') {
            return (
              <a key={item.href} href={item.href}
                className={`sidebar-link ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/finance') ? 'active' : ''}`}>
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
              </a>
            )
          }
          return null
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-signout" onClick={signOut}>Sign Out</button>
      </div>
    </div>
  )
}
