'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}

export default function AnnouncementsPage() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState([])
  const [staff, setStaff]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [toast, setToast]               = useState(null)
  const [form, setForm] = useState({ title:'', content:'', posted_by:'Alex', is_pinned:false, notify_all:true, selected_staff:[] })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('announcements').select('*').order('is_pinned',{ascending:false}).order('created_at',{ascending:false}),
      supabase.from('staff').select('id,first_name,last_name,nickname').order('last_name'),
    ])
    setAnnouncements(a || [])
    setStaff(s || [])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  async function postAnnouncement() {
    if (!form.title || !form.content) { showToast('⚠️','Title and content required'); return }
    setSaving(true)
    // Save announcement
    const { data: ann, error } = await supabase.from('announcements').insert([{
      title: form.title, content: form.content,
      posted_by: form.posted_by, is_pinned: form.is_pinned
    }]).select().single()
    if (error) { showToast('❌', error.message); setSaving(false); return }

    // Create notifications for staff
    const targetStaff = form.notify_all ? staff : staff.filter(s => form.selected_staff.includes(s.id))
    if (targetStaff.length > 0) {
      const notifs = targetStaff.map(s => ({
        staff_id: s.id,
        type: 'announcement',
        title: form.title,
        message: form.content.slice(0, 120) + (form.content.length > 120 ? '…' : ''),
        is_read: false,
      }))
      await supabase.from('notifications').insert(notifs)
    }

    await fetchAll()
    setShowForm(false)
    setForm({ title:'', content:'', posted_by:'Alex', is_pinned:false, notify_all:true, selected_staff:[] })
    showToast('📣', `Announcement posted · ${targetStaff.length} staff notified`)
    setSaving(false)
  }

  async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    showToast('🗑️','Announcement deleted')
  }

  async function togglePin(id, current) {
    await supabase.from('announcements').update({ is_pinned: !current }).eq('id', id)
    setAnnouncements(prev => prev.map(a => a.id===id ? {...a,is_pinned:!current} : a))
  }

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Announcements</div>
          <div className="topbar-sub">{announcements.length} posts · staff notified via portal</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ New Announcement</button>
      </div>

      <div className="page-content">
        {/* Post form */}
        {showForm && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px 22px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>📣 New Announcement</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:5}}>Title *</label>
              <input style={iStyle} placeholder="e.g. New Menu Launch This Friday!" value={form.title} onChange={fv('title')}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:5}}>Content *</label>
              <textarea style={{...iStyle,resize:'vertical',minHeight:90,lineHeight:1.6}} placeholder="Write your announcement here…" value={form.content} onChange={fv('content')}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:5}}>Posted By</label>
                <div style={{display:'flex',gap:7}}>
                  {['Alex','CJ'].map(name=>(
                    <div key={name} onClick={()=>setForm(p=>({...p,posted_by:name}))}
                      style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${form.posted_by===name?'var(--matcha)':'var(--border)'}`,background:form.posted_by===name?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:12,fontWeight:600,color:form.posted_by===name?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:5}}>Pin to Top</label>
                <div onClick={()=>setForm(p=>({...p,is_pinned:!p.is_pinned}))}
                  style={{padding:'8px 14px',borderRadius:8,border:`1.5px solid ${form.is_pinned?'var(--gold)':'var(--border)'}`,background:form.is_pinned?'var(--gold-pale)':'var(--surface)',cursor:'pointer',fontSize:12,fontWeight:600,color:form.is_pinned?'#a06000':'var(--text-muted)',transition:'all .15s',textAlign:'center'}}>
                  {form.is_pinned?'📌 Pinned':'📌 Pin it'}
                </div>
              </div>
              <div>
                <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:5}}>Notify</label>
                <div style={{display:'flex',gap:7}}>
                  {[['true','All Staff'],['false','Select']].map(([val,label])=>(
                    <div key={val} onClick={()=>setForm(p=>({...p,notify_all:val==='true'}))}
                      style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${String(form.notify_all)=== val?'var(--sky)':'var(--border)'}`,background:String(form.notify_all)===val?'var(--sky-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:String(form.notify_all)===val?'var(--sky)':'var(--text-muted)',transition:'all .15s'}}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:9,marginTop:8}}>
              <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={postAnnouncement} disabled={saving}>
                {saving?'Posting…':'📣 Post Announcement'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>
        ) : announcements.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>📣</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No announcements yet</div>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Post First Announcement</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {announcements.map(a=>(
              <div key={a.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px',borderLeft:`4px solid ${a.is_pinned?'var(--gold)':'var(--espresso)'}`}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      {a.is_pinned&&<span style={{fontSize:10,fontWeight:700,color:'#a06000',background:'var(--gold-pale)',padding:'2px 7px',borderRadius:6}}>📌 Pinned</span>}
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>{a.title}</div>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-primary)',lineHeight:1.7,marginBottom:8}}>{a.content}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>Posted by {a.posted_by} · {fmtDate(a.created_at)}</div>
                  </div>
                  <div style={{display:'flex',gap:7,flexShrink:0}}>
                    <button onClick={()=>togglePin(a.id,a.is_pinned)}
                      style={{background:'transparent',border:'1px solid var(--border)',borderRadius:7,padding:'5px 9px',fontSize:11,cursor:'pointer',color:'var(--text-muted)',fontFamily:"'DM Sans',sans-serif"}}>
                      {a.is_pinned?'Unpin':'📌 Pin'}
                    </button>
                    <button onClick={()=>deleteAnnouncement(a.id)}
                      style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:16}}
                      onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
