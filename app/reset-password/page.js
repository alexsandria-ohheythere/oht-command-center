'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [ready, setReady]       = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // PKCE flow — Supabase v2 sends ?code= in the URL
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')

    // Legacy hash flow — #access_token=...
    const hashParams   = new URLSearchParams(window.location.hash.substring(1))
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type         = hashParams.get('type')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { setError('Reset link is invalid or expired. Please request a new one.') }
        else { setReady(true) }
      })
    } else if (accessToken && type === 'recovery') {
      supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken || '',
      }).then(({ error }) => {
        if (error) { setError('Reset link is invalid or expired. Please request a new one.') }
        else { setReady(true) }
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) { setReady(true) }
        else { setError('Reset link is invalid or expired. Please request a new one.') }
      })
    }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  const inp = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }

  return (
    <div style={{ minHeight:'100vh', background:'var(--espresso)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--white)', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/OHT_Logo.png" alt="Oh Hey There" style={{ width:120, height:'auto', margin:'0 auto 14px', display:'block' }} />
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:900, color:'var(--espresso)' }}>Oh Hey There</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>Set New Password</div>
        </div>

        {success ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ background:'var(--matcha-pale)', border:'1px solid var(--matcha)', borderRadius:10, padding:'20px', marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--matcha-dark)' }}>Password updated!</div>
            </div>
            <a href="/login" style={{ display:'block', background:'var(--matcha)', color:'white', borderRadius:10, padding:13, fontSize:13, fontWeight:700, textDecoration:'none', textAlign:'center' }}>Sign In →</a>
          </div>

        ) : !ready && error ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:10, padding:'20px', marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#c0392b', marginBottom:4 }}>Link expired or invalid</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Please request a new password reset link.</div>
            </div>
            <a href="/login" style={{ display:'block', background:'var(--espresso)', color:'white', borderRadius:10, padding:13, fontSize:13, fontWeight:700, textDecoration:'none', textAlign:'center' }}>← Back to Sign In</a>
          </div>

        ) : !ready ? (
          <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>Verifying reset link…</div>

        ) : (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>New Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" required style={inp}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" required style={inp}/>
            </div>
            {error && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', background:loading?'#aaa':'var(--matcha)', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {loading ? 'Updating…' : '✓ Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
