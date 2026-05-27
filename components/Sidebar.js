'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

const ADMIN_USERS = {
  'alex@ohheythere.cafe': { name: 'Alex', role: 'Managing Director', color: '#7ab648', initials: 'A' },
  'cj@ohheythere.cafe':   { name: 'CJ',   role: 'CEO',               color: '#4a90c4', initials: 'CJ' },
}

const NAV = [
  { type:'section', label:'Overview' },
  { type:'link', href:'/dashboard', icon:'🏠', label:'Dashboard' },

  { type:'section', label:'Operations' },
  { type:'link', href:'/schedule', icon:'📅', label:'Scheduling'      },
  { type:'link', href:'/tasks',    icon:'✅', label:'Tasks'            },
  { type:'link', href:'/leave',    icon:'🗓️', label:'Leave & Unavail.' },
  { type:'link', href:'/roles',    icon:'📋', label:'Role Tasks'       },
  { type:'link', href:'/checkin',  icon:'✔️', label:'Daily Check-In'   },
  { type:'link', href:'/payroll',  icon:'💸', label:'Payroll'          },
  { type:'link', href:'/staff',    icon:'👥', label:'Staff'            },

  { type:'section', label:'Finance' },
  { type:'group', icon:'💹', label:'Finance', key:'finance', children:[
    { href:'/finance',          icon:'📊', label:'Financial Statement' },
    { href:'/finance/sales',    icon:'💰', label:'Sales'               },
    { href:'/finance/expenses', icon:'🧾', label:'Expenses'            },
    { href:'/finance/forecast', icon:'📈', label:'Forecast'            },
    { href:'/finance/bank',     icon:'🏦', label:'Bank Records'        },
  ]},

  { type:'section', label:'Comms' },
  { type:'link', href:'/announce', icon:'📣', label:'Announcements' },

  { type:'section', label:'Admin' },
  { type:'link', href:'/settings', icon:'⚙️', label:'Settings' },
]

export default function Sidebar({ user }) {
  const router   = useRouter()
  const pathname = usePathname()
  const profile  = ADMIN_USERS[user?.email] || {
    name: user?.email?.split('@')[0] || 'Admin',
    role: 'Admin', color: '#7ab648', initials: 'A',
  }

  // Auto-open Finance group if currently on a finance page
  const [openGroups, setOpenGroups] = useState(() => {
    const open = {}
    if (typeof window !== 'undefined') {
      const p = window.location.pathname
      if (p.startsWith('/finance')) open['finance'] = true
    }
    return open
  })

  function toggleGroup(key) {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isFinanceActive = pathname.startsWith('/finance')

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
        {NAV.map((item, i) => {

          // Section header
          if (item.type === 'section') return (
            <div key={i} className="sidebar-section">{item.label}</div>
          )

          // Regular link
          if (item.type === 'link') return (
            <a key={item.href} href={item.href}
              className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}>
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </a>
          )

          // Collapsible group
          if (item.type === 'group') {
            const isOpen    = openGroups[item.key]
            const anyActive = item.children.some(c => pathname === c.href)
            return (
              <div key={item.key}>
                {/* Group header */}
                <div
                  onClick={() => toggleGroup(item.key)}
                  className={`sidebar-link ${anyActive ? 'active' : ''}`}
                  style={{ cursor:'pointer', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span className="sidebar-link-icon">{item.icon}</span>
                    {item.label}
                  </div>
                  <span style={{
                    fontSize:10, color: anyActive ? 'var(--matcha-light)' : '#5a4a30',
                    transition:'transform .2s',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    display:'inline-block',
                  }}>▶</span>
                </div>

                {/* Children */}
                {isOpen && item.children.map(child => (
                  <a key={child.href} href={child.href}
                    className={`sidebar-link ${pathname === child.href ? 'active' : ''}`}
                    style={{ paddingLeft:32, fontSize:11 }}>
                    <span className="sidebar-link-icon" style={{fontSize:12}}>{child.icon}</span>
                    {child.label}
                  </a>
                ))}
              </div>
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
