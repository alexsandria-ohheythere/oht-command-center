'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'

const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']
const HR_EMAILS    = ['hr.ohtgroup@gmail.com']

function getRoleFromEmail(email) {
  if (!email) return 'staff'
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin'
  if (HR_EMAILS.includes(email.toLowerCase()))    return 'hr'
  return 'staff'
}

export default function AuthShell({ children, require: requirePermission }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser]         = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const email = session.user.email
      const role = getRoleFromEmail(email)
      if (role === 'staff') { router.replace('/login'); return }
      setUser(session.user)
      setUserRole({ role, email })
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--cream)' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/OHT_Logo.png" alt="Oh Hey There" style={{ width:80, height:'auto', margin:'0 auto 14px', display:'block' }} />
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, letterSpacing:2 }}>LOADING...</div>
      </div>
    </div>
  )

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}
      onClick={e => { if (sidebarOpen && e.target === e.currentTarget) setSidebarOpen(false) }}>
      <Sidebar user={user} userRole={userRole} onClose={() => setSidebarOpen(false)} />
      <div className="main-area" style={{ display:'flex', flexDirection:'column', flex:1, minWidth:0 }}>
        {/* Top bar — holds the notification bell on every page */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12, padding:'10px 20px 10px 60px', flexShrink:0 }}>
          <NotificationBell user={user} />
        </div>
        {/* Hamburger — mobile only */}
        <button className="hamburger" onClick={() => setSidebarOpen(true)}
          style={{ position:'fixed', top:14, left:14, zIndex:150 }}
          aria-label="Open menu">
          ☰
        </button>
        <div style={{ flex:1, minHeight:0, overflow:'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
