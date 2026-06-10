'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
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
          <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,var(--matcha),var(--matcha-dark))', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:24 }}>🌿</div>
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
        ) : (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>New Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 8 characters" required style={inp}/>
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
