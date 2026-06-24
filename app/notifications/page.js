'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const TYPE_STYLES = {
  announcement:      { icon:'📣', color:'#EF4576', bg:'#fdeef3', label:'Announcement' },
  shift_assigned:    { icon:'📅', color:'#4a7a1e', bg:'#eef7e4', label:'Shift Assigned' },
  schedule_published:{ icon:'📅', color:'#4a7a1e', bg:'#eef7e4', label:'Schedule Published' },
  dayoff_assigned:   { icon:'📆', color:'#4a90c4', bg:'#e8f0fb', label:'Day-Off Assigned' },
  leave_approved:    { icon:'✅', color:'#2d7a6a', bg:'#e8f7f5', label:'Leave Approved' },
  leave_rejected:    { icon:'❌', color:'#c0392b', bg:'#fdeaea', label:'Leave Rejected' },
  payroll_ready:     { icon:'💸', color:'#a06000', bg:'#fef3e2', label:'Payroll' },
  payroll_saved:     { icon:'💸', color:'#a06000', bg:'#fef3e2', label:'Payroll' },
  contract:          { icon:'📄', color:'#7a3a8a', bg:'#f5eeff', label:'Contract' },
  general:           { icon:'🔔', color:'#4a90c4', bg:'#e8f0fb', label:'Notification' },
}

export default function CommandNotificationsPage() {
  const [staffId, setStaffId]      = useState(null)
  const [notifications, setNotifs] = useState([])
  const [announcements, setAnnounce] = useState([])
  const [loading, setLoading]      = useState(true)
  const [filter, setFilter]        = useState('all') // all | unread | announcements

  useEffect(() => { init() }, [])

  async function init() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data: staff } = await supabase.from('staff').select('id').eq('email', session.user.email).single()
    if (staff) {
      setStaffId(staff.id)
      await fetchAll(supabase, staff.id)
    }
    setLoading(false)
  }

  async function fetchAll(supabase, sid) {
    const sb = supabase || createClient()
    const results = await Promise.allSettled([
      sb.from('notifications').select('*').eq('staff_id', sid).order('created_at', { ascending:false }),
      sb.from('announcements').select('*').order('is_pinned', { ascending:false }).order('created_at', { ascending:false }),
    ])
    setNotifs(results[0].status==='fulfilled' ? (results[0].value.data || []) : [])
    setAnnounce(results[1].status==='fulfilled' ? (results[1].value.data || []) : [])
  }

  async function markRead(id) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read:true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id===id ? { ...n, is_read:true } : n))
  }

  async function markAllRead() {
    if (!staffId) return
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read:true }).eq('staff_id', staffId).eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read:true })))
  }

  async function deleteNotif(id) {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const allItems = [
    ...announcements.map(a => ({ ...a, _type:'announcement', _date:a.created_at })),
    ...notifications.map(n => ({ ...n, _type:'notif', _date:n.created_at })),
  ].sort((a,b) => new Date(b._date) - new Date(a._date))

  const filtered = filter === 'unread'
    ? allItems.filter(x => x._type === 'notif' && !x.is_read)
    : filter === 'announcements'
    ? allItems.filter(x => x._type === 'announcement')
    : allItems

  return (
    <AuthShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Notifications</div>
          {unreadCount > 0 && (
            <div style={{ background:'#EF4576', color:'white', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{unreadCount}</div>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ background:'transparent', border:'1px solid #d8cebb', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, color:'#7a6a50', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            ✓ Mark all read
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
        <div style={{ display:'flex', gap:7, marginBottom:16 }}>
          {[['all','All'], ['unread',`Unread (${unreadCount})`], ['announcements','Announcements']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding:'7px 14px', borderRadius:20, border:`1.5px solid ${filter===val?'#EF4576':'#d8cebb'}`, background:filter===val?'#EF4576':'transparent', color:filter===val?'white':'#7a6a50', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'40px', color:'#7a6a50' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </div>
            <div style={{ fontSize:12, color:'#7a6a50' }}>
              {filter === 'unread' ? 'No unread notifications.' : 'Announcements and updates will appear here.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(item => {
              if (item._type === 'announcement') {
                return (
                  <div key={`a-${item.id}`} style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:'16px 18px', borderLeft:'4px solid #EF4576' }}>
                    {item.is_pinned && <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#EF4576', marginBottom:6 }}>📌 PINNED</div>}
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{ fontSize:24, flexShrink:0 }}>📣</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700, marginBottom:4 }}>{item.title}</div>
                        <div style={{ fontSize:12, color:'#1a1208', lineHeight:1.6, marginBottom:6 }}>{item.content}</div>
                        <div style={{ fontSize:10, color:'#7a6a50' }}>Posted by {item.posted_by} · {fmtDate(item.created_at)}</div>
                      </div>
                    </div>
                  </div>
                )
              } else {
                const ts = TYPE_STYLES[item.type] || TYPE_STYLES.general
                return (
                  <div key={`n-${item.id}`}
                    onClick={() => !item.is_read && markRead(item.id)}
                    style={{ background: item.is_read ? 'white' : ts.bg, border:`1px solid ${item.is_read?'#d8cebb':ts.color+'44'}`, borderRadius:13, padding:'14px 16px', borderLeft:`4px solid ${ts.color}`, cursor:!item.is_read?'pointer':'default', transition:'all .15s', position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{ fontSize:22, flexShrink:0 }}>{ts.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700 }}>{item.title}</span>
                          {!item.is_read && <span style={{ width:8, height:8, borderRadius:'50%', background:'#EF4576', display:'inline-block', flexShrink:0 }}/>}
                        </div>
                        {item.message && <div style={{ fontSize:12, color:'#1a1208', lineHeight:1.5, marginBottom:4 }}>{item.message}</div>}
                        <div style={{ fontSize:10, color:'#7a6a50' }}>{ts.label} · {fmtDate(item.created_at)}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteNotif(item.id) }}
                        style={{ background:'transparent', border:'none', color:'#d8cebb', cursor:'pointer', fontSize:14, flexShrink:0 }}
                        onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='#d8cebb'}>
                        ×
                      </button>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>
    </AuthShell>
  )
}
