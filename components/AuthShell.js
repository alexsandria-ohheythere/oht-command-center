'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getUserRole, can } from '../lib/auth'
import Sidebar from './Sidebar'

export default function AuthShell({ children, require: requirePermission }) {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setUser(session.user)
      const roleData = await getUserRole(supabase)
      setUserRole(roleData)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)
      const roleData = await getUserRole(supabase)
      setUserRole(roleData)
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--cream)' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:10 }}>🌿</div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, color:'var(--espresso)' }}>Oh Hey There</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, letterSpacing:2 }}>LOADING...</div>
        </div>
      </div>
    )
  }

  // Check permission if required
  if (requirePermission && userRole && !can(userRole.role, requirePermission)) {
    return (
      <div className="app-shell">
        <Sidebar user={user} userRole={userRole} />
        <div className="main-area">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:40 }}>🔒</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:700, color:'var(--espresso)' }}>Access Restricted</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>You don't have permission to view this page.</div>
            <a href="/dashboard" style={{ fontSize:12, color:'var(--matcha-dark)', fontWeight:600, textDecoration:'none', marginTop:8 }}>← Back to Dashboard</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} userRole={userRole} />
      <div className="main-area">
        {children}
      </div>
    </div>
  )
}
