'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function StaffLogin() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('login')
  const [sent, setSent]         = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Invalid email or password.'); setLoading(false) }
    else {
      // Mark staff as active (signed in at least once)
      await supabase.from('staff').update({ onboarded: true }).eq('email', email).catch(()=>{})
      window.location.href = '/portal'
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://oht-staff-portal.vercel.app/reset-password',
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  const inp = { width:'100%', background:'#faf7f2', border:'1px solid #d8cebb', borderRadius:10, padding:'11px 14px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none' }
  const lbl = { display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }

  return (
    <div style={{ minHeight:'100vh', background:'#EF4576', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'white', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/OHT_Logo.png" alt="Oh Hey There" style={{ width:120, height:'auto', margin:'0 auto 14px', display:'block' }} />
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:900, color:'#EF4576' }}>Oh Hey There</div>
          <div style={{ fontSize:11, color:'#7a6a50', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>
            {mode === 'login' ? 'Staff Portal' : 'Reset Password'}
          </div>
        </div>

        {mode === 'forgot' && sent ? (
          <div>
            <div style={{ background:'#eef7e4', border:'1px solid #7ab648', borderRadius:10, padding:'16px', textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📧</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#4a7a1e', marginBottom:4 }}>Check your email</div>
              <div style={{ fontSize:12, color:'#7a6a50', lineHeight:1.6 }}>We sent a reset link to <strong>{email}</strong>.</div>
            </div>
            <button onClick={() => { setMode('login'); setSent(false); setEmail('') }}
              style={{ width:'100%', background:'#EF4576', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              ← Back to Sign In
            </button>
          </div>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleForgot}>
            <div style={{ fontSize:12, color:'#7a6a50', lineHeight:1.6, marginBottom:20 }}>Enter your email and we'll send you a reset link.</div>
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}/>
            </div>
            {error && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', background:loading?'#aaa':'#7ab648', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginBottom:12 }}>
              {loading ? 'Sending…' : '📧 Send Reset Link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              style={{ width:'100%', background:'transparent', color:'#7a6a50', border:'1px solid #d8cebb', borderRadius:10, padding:11, fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              ← Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}/>
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={lbl}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={inp}/>
            </div>
            <div style={{ textAlign:'right', marginBottom:20 }}>
              <button type="button" onClick={() => { setMode('forgot'); setError('') }}
                style={{ background:'none', border:'none', fontSize:11, color:'#4a7a1e', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
                Forgot password?
              </button>
            </div>
            {error && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', background:loading?'#aaa':'#7ab648', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
            <div style={{ marginTop:20, padding:'12px 14px', background:'#faf7f2', borderRadius:9, border:'1px solid #d8cebb', fontSize:11, color:'#7a6a50', lineHeight:1.6 }}>
              Use the email and password provided by your manager. Contact Alex or CJ if you need help.
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
