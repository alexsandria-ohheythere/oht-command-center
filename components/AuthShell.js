'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Sidebar from './Sidebar'

const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']
const SUPERVISOR_EMAILS = ['richelle@ohheythere.cafe']

function getRoleFromEmail(email) {
  if (!email) return 'staff'
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin'
  if (SUPERVISOR_EMAILS.includes(email.toLowerCase())) return 'supervisor'
  return 'staff'
}

export default function AuthShell({ children, require: requirePermission }) {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const email = session.user.email
      const role = getRoleFromEmail(email)
      // If it's a staff email, redirect to staff portal
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
        <div style={{ fontSize:28, marginBottom:10 }}>🌿</div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, color:'var(--espresso)' }}>Oh Hey There</div>
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, letterSpacing:2 }}>LOADING...</div>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      <Sidebar user={user} userRole={userRole} />
      <div className="main-area">{children}</div>
    </div>
  )
}
