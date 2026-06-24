'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase'

const TYPE_STYLES = {
  announcement:    { icon:'📣', color:'#EF4576' },
  shift_assigned:  { icon:'📅', color:'#4a7a1e' },
  schedule_published:{ icon:'📅', color:'#4a7a1e' },
  dayoff_assigned: { icon:'📆', color:'#4a90c4' },
  leave_approved:  { icon:'✅', color:'#2d7a6a' },
  leave_rejected:  { icon:'❌', color:'#c0392b' },
  payroll_ready:   { icon:'💸', color:'#a06000' },
  payroll_saved:   { icon:'💸', color:'#a06000' },
  contract:        { icon:'📄', color:'#7a3a8a' },
  general:         { icon:'🔔', color:'#4a90c4' },
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''

// Notification bell for the Command Center top bar.
// Shows this profile's own notifications (by staff_id, matched on email) plus
// company-wide announcements. Click bell to open a dropdown of recent items.
export default function NotificationBell({ user }) {
  const [staffId, setStaffId]   = useState(null)
  const [items, setItems]       = useState([])
  const [announce, setAnnounce] = useState([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(true)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!user?.email) return
    const supabase = createClient()
    supabase.from('staff').select('id').eq('email', user.email).single()
      .then(({ data }) => {
        if (data?.id) { setStaffId(data.id); fetchAll(supabase, data.id) }
        else setLoading(false)
      })
  }, [user])

  async function fetchAll(supabase, sid) {
    const sb = supabase || createClient()
    const results = await Promise.allSettled([
      sb.from('notifications').select('*').eq('staff_id', sid).order('created_at', { ascending:false }).limit(30),
      sb.from('announcements').select('*').order('created_at', { ascending:false }).limit(10),
    ])
    setItems(results[0].status==='fulfilled' ? (results[0].value.data || []) : [])
    setAnnounce(results[1].status==='fulfilled' ? (results[1].value.data || []) : [])
    setLoading(false)
  }

  // Close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function markRead(id) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read:true }).eq('id', id)
    setItems(prev => prev.map(n => n.id===id ? { ...n, is_read:true } : n))
  }

  async function markAllRead() {
    if (!staffId) return
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read:true }).eq('staff_id', staffId).eq('is_read', false)
    setItems(prev => prev.map(n => ({ ...n, is_read:true })))
  }

  const unread = items.filter(n => !n.is_read).length

  const merged = [
    ...announce.map(a => ({ _kind:'announcement', id:'a-'+a.id, title:a.title, message:a.content, type:'announcement', created_at:a.created_at, is_read:true })),
    ...items.map(n => ({ _kind:'notif', ...n })),
  ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25)

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        style={{ position:'relative', width:38, height:38, borderRadius:10, border:'1.5px solid #d8cebb', background:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
        🔔
        {unread > 0 && (
          <span style={{ position:'absolute', top:-5, right:-5, background:'#EF4576', color:'white', borderRadius:20, minWidth:17, height:17, padding:'0 4px', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position:'absolute', top:46, right:0, width:340, maxHeight:460, background:'white', border:'1px solid #d8cebb', borderRadius:13, boxShadow:'0 8px 28px rgba(0,0,0,.18)', zIndex:300, display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #eee3d0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700 }}>Notifications</div>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ background:'transparent', border:'none', color:'#EF4576', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                ✓ Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY:'auto', flex:1 }}>
            {loading ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#7a6a50', fontSize:12 }}>Loading…</div>
            ) : merged.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center' }}>
                <div style={{ fontSize:34, marginBottom:8 }}>🔔</div>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:4 }}>You're all caught up</div>
                <div style={{ fontSize:11, color:'#7a6a50' }}>Alerts and announcements appear here.</div>
              </div>
            ) : (
              merged.map(item => {
                const ts = TYPE_STYLES[item.type] || TYPE_STYLES.general
                const isUnread = item._kind === 'notif' && !item.is_read
                return (
                  <div key={item.id}
                    onClick={() => isUnread && markRead(item.id)}
                    style={{ display:'flex', gap:11, padding:'12px 16px', borderBottom:'1px solid #f3ecde', background:isUnread?'#fdeef3':'white', cursor:isUnread?'pointer':'default', borderLeft:`3px solid ${isUnread?ts.color:'transparent'}` }}>
                    <div style={{ fontSize:19, flexShrink:0 }}>{ts.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:12.5, fontWeight:700 }}>{item.title}</span>
                        {isUnread && <span style={{ width:7, height:7, borderRadius:'50%', background:'#EF4576', flexShrink:0 }} />}
                      </div>
                      {item.message && <div style={{ fontSize:11.5, color:'#1a1208', lineHeight:1.45, marginTop:2 }}>{item.message}</div>}
                      <div style={{ fontSize:10, color:'#7a6a50', marginTop:3 }}>{item._kind==='announcement'?'Announcement':''} {fmtDate(item.created_at)}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <a href="/notifications"
            style={{ display:'block', textAlign:'center', padding:'11px', borderTop:'1px solid #eee3d0', color:'#EF4576', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
            View all notifications →
          </a>
        </div>
      )}
    </div>
  )
}
