'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Sidebar from './Sidebar'

export default function AuthShell({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
      else setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--cream)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🌿</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--espresso)' }}>
            Oh Hey There
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: 2 }}>
            LOADING...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="main-area">
        {children}
      </div>
    </div>
  )
}
