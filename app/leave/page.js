'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const fmtDT   = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const LEAVE_TYPES = [
  { id:'sick',       label:'Sick Leave',         icon:'🤒', color:'#c0392b', bg:'#fdeaea' },
  { id:'vacation',   label:'Vacation Leave',      icon:'🌴', color:'#2d7a6a', bg:'#e4f4f0' },
  { id:'emergency',  label:'Emergency Leave',     icon:'🚨', color:'#a06000', bg:'#fef3e2' },
  { id:'personal',   label:'Personal Leave',      icon:'🧘', color:'#7a3a8a', bg:'#f5eeff' },
  { id:'maternity',  label:'Maternity Leave',     icon:'🤰', color:'#4a90c4', bg:'#e8f0fb' },
  { id:'paternity',  label:'Paternity Leave',     icon:'👨‍👶', color:'#4a90c4', bg:'#e8f0fb' },
  { id:'bereavement',label:'Bereavement Leave',   icon:'🕊️', color:'#7a6a50', bg:'#f0ede8' },
  { id:'other',      label:'Other',               icon:'📋', color:'#7a6a50', bg:'#f0ede8' },
]
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r]||'#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

export default function LeavePage() {
  const supabase = createClient()
  const [requests, setRequests] = useState([])
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState(null)
  const [filter, setFilter]     = useState('pending')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:r },{ data:s }] = await Promise.all([
      supabase.from('leave_requests').select('*, staff(first_name,last_name,role,nickname)').order('created_at',{ascending:false}),
      supabase.from('staff').select('id,first_name,last_name,role').order('last_name'),
    ])
    setRequests(r||[]); setStaff(s||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}

  async function updateStatus(id, status, approver) {
    const { error } = await supabase.from('leave_requests').update({ status, approved_by:approver, approved_at:new Date().toISOString() }).eq('id',id)
    if (error) { showToast('❌',error.message); return }
    const req = requests.find(r=>r.id===id)
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status,approved_by:approver}:r))
    if (req?.staff_id) {
      const lt = LEAVE_TYPES.find(x=>x.id===req.leave_type)
      const approverName = approver==='alex'?'Alex':'CJ'
      const dateRange = `${fmtDate(req.date_from)}${req.date_from!==req.date_to?' – '+fmtDate(req.date_to):''}`
      const staffMember = staff.find(s=>s.id===req.staff_id)
      const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Staff'
      // In-app notification
      await notifyOne(req.staff_id, {
        type: status==='approved'?'leave_approved':'leave_rejected',
        title: status==='approved' ? `${lt?.icon} Leave Approved ✅` : `${lt?.icon} Leave Request Rejected`,
        message: status==='approved'
          ? `Your ${lt?.label} (${dateRange}) has been approved by ${approverName}.`
          : `Your ${lt?.label} request has been rejected by ${approverName}. Please speak to your manager.`,
      })
      // Messenger to staff member
      const staffMsg = status==='approved'
        ? `✅ Leave Approved\n\n${lt?.label}\n${dateRange}\n\nApproved by ${approverName}.`
        : `❌ Leave Request Rejected\n\n${lt?.label}\n${dateRange}\n\nRejected by ${approverName}. Please speak to your manager.`
      await fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId: req.staff_id, message: staffMsg })
      }).catch(()=>{})
      // Messenger to Richelle (HR)
      const hrMsg = status==='approved'
        ? `✅ Leave Approved\n\n${staffName} — ${lt?.label}\n${dateRange}\n\nApproved by ${approverName}.`
        : `❌ Leave Rejected\n\n${staffName} — ${lt?.label}\n${dateRange}\n\nRejected by ${approverName}.`
      await fetch('/api/messenger/send-by-emails', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ emails:['hr.ohtgroup@gmail.com'], message: hrMsg })
      }).catch(()=>{})
    }
    showToast(status==='approved'?'✅':'❌',`Request ${status} — staff notified`)
  }

  const filtered = requests.filter(r => {
    if (filter!=='all' && r.status!==filter) return false
    if (typeFilter!=='all' && r.leave_type!==typeFilter) return false
    return true
  })

  const counts = { pending:requests.filter(r=>r.status==='pending').length, approved:requests.filter(r=>r.status==='approved').length, rejected:requests.filter(r=>r.status==='rejected').length }

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Leave Requests</div>
          <div className="topbar-sub">{counts.pending} pending · {counts.approved} approved · {counts.rejected} rejected</div>
        </div>
      </div>

      <div className="page-content">
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:5}}>
            {[['all','All'],['pending','Pending'],['approved','Approved'],['rejected','Rejected']].map(([val,label])=>(
              <button key={val} onClick={()=>setFilter(val)}
                style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${filter===val?'var(--espresso)':'var(--border)'}`,background:filter===val?'var(--espresso)':'transparent',color:filter===val?'var(--cream)':'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
                {label}{val!=='all'?` (${counts[val]||0})`:''}
              </button>
            ))}
          </div>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}}>
            <option value="all">All Types</option>
            {LEAVE_TYPES.map(lt=><option key={lt.id} value={lt.id}>{lt.icon} {lt.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading…</div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>🗓️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700}}>No leave requests</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {filtered.map(r => {
              const lt = LEAVE_TYPES.find(x=>x.id===r.leave_type)||LEAVE_TYPES[LEAVE_TYPES.length-1]
              const s  = r.staff
              const dateRange = `${fmtDate(r.date_from)}${r.date_from!==r.date_to?' – '+fmtDate(r.date_to):''}`
              return (
                <div key={r.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 18px',borderLeft:`4px solid ${lt.color}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>
                    {s && (
                      <div style={{display:'flex',alignItems:'center',gap:9,minWidth:180}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{s.first_name} {s.last_name}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                        </div>
                      </div>
                    )}
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:16}}>{lt.icon}</span>
                        <span style={{fontSize:13,fontWeight:700}}>{lt.label}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6,
                          background:r.status==='approved'?'#eef7e4':r.status==='rejected'?'#fdeaea':'#fef3e2',
                          color:r.status==='approved'?'#4a7a1e':r.status==='rejected'?'#c0392b':'#a06000'}}>
                          {r.status?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>📅 {dateRange}</div>
                      {r.reason && <div style={{fontSize:12,color:'var(--text-primary)',fontStyle:'italic'}}>"{r.reason}"</div>}
                      {r.approved_by && <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>
                        {r.status==='approved'?'✅':'❌'} {r.status} by {r.approved_by==='alex'?'Alex':'CJ'} · {fmtDT(r.approved_at)}
                      </div>}
                    </div>
                    {r.status==='pending' && (
                      <div style={{display:'flex',flexDirection:'column',gap:7,minWidth:180}}>
                        <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>Approve as:</div>
                        <div style={{display:'flex',gap:6}}>
                          {[['alex','Alex'],['cj','CJ']].map(([val,name])=>(
                            <div key={val} style={{flex:1}}>
                              <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textAlign:'center',marginBottom:3}}>{name}</div>
                              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                <button onClick={()=>updateStatus(r.id,'approved',val)}
                                  style={{background:'#eef7e4',color:'#4a7a1e',border:'1px solid #7ab648',borderRadius:7,padding:'5px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>✅ Approve</button>
                                <button onClick={()=>updateStatus(r.id,'rejected',val)}
                                  style={{background:'#fdeaea',color:'#c0392b',border:'1px solid #f5c6c6',borderRadius:7,padding:'5px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>❌ Reject</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
