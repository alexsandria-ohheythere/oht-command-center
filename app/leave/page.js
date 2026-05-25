'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const LEAVE_TYPES = [
  { id:'unavailable',     label:'Unavailable',              color:'#7a6a50', bg:'#f0ede8', icon:'🚫' },
  { id:'vacation_paid',   label:'Vacation Leave (Paid)',    color:'#4a7a1e', bg:'#eef7e4', icon:'🌴' },
  { id:'vacation_unpaid', label:'Vacation Leave (Unpaid)',  color:'#2d5a8a', bg:'#e8f0fb', icon:'🌴' },
  { id:'sick_paid',       label:'Sick Leave (Paid)',        color:'#a06000', bg:'#fef3e2', icon:'🤒' },
  { id:'sick_unpaid',     label:'Sick Leave (Unpaid)',      color:'#8e44ad', bg:'#f5eeff', icon:'🤒' },
]

const STATUS_STYLES = {
  pending:  { color:'#a06000', bg:'#fef3e2', border:'#d4a84344', label:'Pending'  },
  approved: { color:'#4a7a1e', bg:'#eef7e4', border:'#7ab64844', label:'Approved' },
  rejected: { color:'#c0392b', bg:'#fdeaea', border:'#f5c6c644', label:'Rejected' },
}

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const toISO = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }

const EMPTY_FORM = {
  staff_id:'', leave_type:'unavailable',
  date_from: toISO(new Date()), date_to: toISO(new Date()),
  reason:'', submitted_by:'alex',
}

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }
const lStyle = { display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }

export default function LeavePage() {
  const supabase = createClient()
  const [staff, setStaff]         = useState([])
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('list') // list | form
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStaff, setFilterStaff]   = useState('')
  const [toast, setToast]         = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('staff').select('*').order('last_name'),
      supabase.from('leave_requests').select('*, staff(first_name,last_name,nickname,role)').order('created_at', { ascending:false }),
    ])
    setStaff(s || [])
    setRequests(r || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }
  const fv = k => e => setForm(prev => ({...prev,[k]:e.target.value}))

  async function submitRequest() {
    if (!form.staff_id) { showToast('⚠️','Please select a staff member'); return }
    if (!form.date_from || !form.date_to) { showToast('⚠️','Please set the dates'); return }
    if (form.date_to < form.date_from) { showToast('⚠️','End date must be after start date'); return }
    setSaving(true)
    const { error } = await supabase.from('leave_requests').insert([{
      staff_id: form.staff_id,
      leave_type: form.leave_type,
      date_from: form.date_from,
      date_to: form.date_to,
      reason: form.reason,
      submitted_by: form.submitted_by,
      status: 'pending',
    }])
    if (error) { showToast('❌', error.message); setSaving(false); return }
    await fetchAll()
    setForm(EMPTY_FORM)
    setView('list')
    showToast('✅', 'Leave request submitted')
    setSaving(false)
  }

  async function updateStatus(id, status, approver) {
    const { error } = await supabase.from('leave_requests').update({
      status,
      approved_by: approver,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { showToast('❌', error.message); return }
    setRequests(prev => prev.map(r => r.id===id ? {...r, status, approved_by:approver} : r))
    showToast(status==='approved'?'✅':'❌', `Request ${status}`)
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this request?')) return
    await supabase.from('leave_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
    showToast('🗑️', 'Request deleted')
  }

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterStaff && r.staff_id !== filterStaff) return false
    return true
  })

  const pendingCount = requests.filter(r => r.status==='pending').length

  // Count days between two dates
  function countDays(from, to) {
    const d1 = new Date(from), d2 = new Date(to)
    return Math.round((d2-d1)/(1000*60*60*24)) + 1
  }

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Leave & Unavailability</div>
          <div className="topbar-sub">{requests.length} total requests · {pendingCount} pending approval</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {view==='form' && <button className="btn btn-secondary" onClick={()=>setView('list')}>← Back</button>}
          {view==='list' && <button className="btn btn-primary" onClick={()=>setView('form')}>+ New Request</button>}
        </div>
      </div>

      <div className="page-content">

        {/* ── FORM ── */}
        {view==='form' && (
          <div style={{maxWidth:560,margin:'0 auto'}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:20}}>
                + New Leave / Unavailability Request
              </div>

              <div style={{marginBottom:14}}>
                <label style={lStyle}>Staff Member *</label>
                <select style={iStyle} value={form.staff_id} onChange={fv('staff_id')}>
                  <option value="">Select staff member…</option>
                  {staff.map(s=>(
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.nickname?`"${s.nickname}"`:''} — {s.role}</option>
                  ))}
                </select>
              </div>

              <div style={{marginBottom:14}}>
                <label style={lStyle}>Leave Type *</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {LEAVE_TYPES.map(lt=>(
                    <div key={lt.id}
                      onClick={()=>setForm(prev=>({...prev,leave_type:lt.id}))}
                      style={{padding:'10px 12px',borderRadius:9,border:`1.5px solid ${form.leave_type===lt.id?lt.color:' var(--border)'}`,background:form.leave_type===lt.id?lt.bg:'var(--surface)',cursor:'pointer',transition:'all .15s',display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16}}>{lt.icon}</span>
                      <span style={{fontSize:11,fontWeight:600,color:form.leave_type===lt.id?lt.color:'var(--text-muted)'}}>{lt.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div>
                  <label style={lStyle}>From *</label>
                  <input style={iStyle} type="date" value={form.date_from} onChange={fv('date_from')} />
                </div>
                <div>
                  <label style={lStyle}>To *</label>
                  <input style={iStyle} type="date" value={form.date_to} onChange={fv('date_to')} />
                </div>
              </div>

              {form.date_from && form.date_to && form.date_to >= form.date_from && (
                <div style={{background:'var(--sky-pale)',border:'1px solid #4a90c444',borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:11,color:'var(--sky)',fontWeight:600}}>
                  📅 {countDays(form.date_from, form.date_to)} day{countDays(form.date_from,form.date_to)!==1?'s':''}
                  {['vacation_paid','sick_paid'].includes(form.leave_type) && ' · Paid leave days will be deducted from leave credits'}
                </div>
              )}

              <div style={{marginBottom:14}}>
                <label style={lStyle}>Reason / Notes</label>
                <textarea style={{...iStyle,resize:'vertical',minHeight:70,lineHeight:1.5}} value={form.reason} onChange={fv('reason')} placeholder="Optional — medical certificate, personal reason, etc." />
              </div>

              <div style={{marginBottom:20}}>
                <label style={lStyle}>Submitted By</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[['alex','Alex (MD)','#7ab648'],['cj','CJ (CEO)','#4a90c4']].map(([val,label,color])=>(
                    <div key={val} onClick={()=>setForm(prev=>({...prev,submitted_by:val}))}
                      style={{padding:'9px 12px',borderRadius:9,border:`1.5px solid ${form.submitted_by===val?color:'var(--border)'}`,background:form.submitted_by===val?color+'22':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:12,fontWeight:600,color:form.submitted_by===val?color:'var(--text-muted)',transition:'all .15s'}}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',gap:9}}>
                <button className="btn btn-secondary" onClick={()=>setView('list')}>Cancel</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={submitRequest} disabled={saving}>
                  {saving?'Submitting…':'✓ Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIST ── */}
        {view==='list' && <>
          {/* Filters */}
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:6}}>
              {['all','pending','approved','rejected'].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{padding:'6px 13px',borderRadius:7,border:`1px solid ${filterStatus===s?'var(--espresso)':'var(--border)'}`,background:filterStatus===s?'var(--espresso)':'transparent',color:filterStatus===s?'var(--cream)':'var(--text-muted)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textTransform:'capitalize',transition:'all .15s'}}>
                  {s==='all'?`All (${requests.length})`:s==='pending'?`Pending (${requests.filter(r=>r.status==='pending').length})`:s==='approved'?`Approved (${requests.filter(r=>r.status==='approved').length})`:`Rejected (${requests.filter(r=>r.status==='rejected').length})`}
                </button>
              ))}
            </div>
            <select style={{...iStyle,width:'auto',minWidth:180}} value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}>
              <option value="">All Staff</option>
              {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>

          {/* Pending banner */}
          {pendingCount > 0 && (
            <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>⏳</span>
              <span style={{fontSize:13,fontWeight:600,color:'#a06000'}}>{pendingCount} request{pendingCount!==1?'s':''} pending your approval</span>
              <button onClick={()=>setFilterStatus('pending')} style={{marginLeft:'auto',background:'#a06000',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                Review Now
              </button>
            </div>
          )}

          {loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-muted)'}}>Loading requests…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No requests yet</div>
              <button className="btn btn-primary" onClick={()=>setView('form')}>+ Submit First Request</button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(r => {
                const lt = LEAVE_TYPES.find(x=>x.id===r.leave_type) || LEAVE_TYPES[0]
                const ss = STATUS_STYLES[r.status] || STATUS_STYLES.pending
                const s = r.staff
                const days = r.date_from && r.date_to ? countDays(r.date_from, r.date_to) : 1
                return (
                  <div key={r.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 18px',borderLeft:`4px solid ${lt.color}`}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                      {/* Staff */}
                      <div style={{display:'flex',alignItems:'center',gap:10,minWidth:180}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s?.role||''),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
                          {initials(s?.first_name||'',s?.last_name||'')}
                        </div>
                        <div>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700}}>{s?.first_name} {s?.last_name}</div>
                          {s?.nickname&&<div style={{fontSize:10,color:'var(--text-muted)'}}>"{s.nickname}"</div>}
                        </div>
                      </div>

                      {/* Leave type */}
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                          <span style={{fontSize:14}}>{lt.icon}</span>
                          <span style={{fontSize:12,fontWeight:700,color:lt.color}}>{lt.label}</span>
                          <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:'var(--text-muted)'}}>· {days} day{days!==1?'s':''}</span>
                        </div>
                        <div style={{fontSize:12,color:'var(--espresso)',fontWeight:600}}>
                          {fmtDate(r.date_from)}{r.date_from!==r.date_to?` → ${fmtDate(r.date_to)}`:''}
                        </div>
                        {r.reason&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{r.reason}</div>}
                        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>Submitted by {r.submitted_by==='alex'?'Alex':'CJ'} · {fmtDate(r.created_at)}</div>
                        {r.approved_by&&<div style={{fontSize:10,color:'var(--text-muted)'}}>{r.status==='approved'?'Approved':'Rejected'} by {r.approved_by==='alex'?'Alex':'CJ'}</div>}
                      </div>

                      {/* Status + actions */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`}}>
                          {ss.label}
                        </span>
                        {r.status==='pending' && (
                          <div style={{display:'flex',gap:6'}}>
                            <button onClick={()=>updateStatus(r.id,'approved','alex')}
                              style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:7,padding:'5px 11px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              ✓ Approve
                            </button>
                            <button onClick={()=>updateStatus(r.id,'rejected','alex')}
                              style={{background:'transparent',color:'#c0392b',border:'1px solid #f5c6c6',borderRadius:7,padding:'5px 11px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              ✕ Reject
                            </button>
                          </div>
                        )}
                        {r.status!=='pending' && (
                          <button onClick={()=>updateStatus(r.id,'pending',null)}
                            style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:7,padding:'4px 9px',fontSize:10,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                            Undo
                          </button>
                        )}
                        <button onClick={()=>deleteRequest(r.id)}
                          style={{background:'transparent',color:'var(--text-muted)',border:'none',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>}
      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
