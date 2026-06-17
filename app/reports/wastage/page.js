'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const STATUS_STYLE = {
  pending:  { bg:'#fef3e2', color:'#a06000', label:'Pending' },
  reviewed: { bg:'#e8f0fb', color:'#2d5a8a', label:'Reviewed' },
  resolved: { bg:'#eef7e4', color:'#4a7a1e', label:'Resolved' },
}

const DEPT_COLORS = {
  'Operations':  { bg:'#e8f0fb', color:'#2d5a8a' },
  'Creatives':   { bg:'#f5eeff', color:'#7a3a8a' },
  'Cafe Bar':    { bg:'#fde8ee', color:'#c0392b' },
  'Commissary':  { bg:'#eef7e4', color:'#4a7a1e' },
}

const TYPE_ICONS = {
  'Accidental (e.g. natapon, spilled, etc.)': '💧',
  'Natural (e.g. rotting)':                   '🍂',
  'Customer wastage (e.g. caused by customer)':'👤',
  'Other':                                    '📋',
}

const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
}
const fmtDatetime = s => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function WastageAdminPage() {
  const [reports, setReports]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [filter, setFilter]       = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('wastage_reports')
        .select('*, staff(first_name, last_name, role)')
        .order('created_at', { ascending: false })
      setReports(data || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3500) }

  async function updateStatus(id, status) {
    setSaving(true)
    try {
      const supabase = createClient()
      const updates = { status }
      if (adminNote.trim()) updates.admin_notes = adminNote.trim()
      const { error } = await supabase.from('wastage_reports').update(updates).eq('id', id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await load()
      setSelected(prev => prev ? { ...prev, status, admin_notes: updates.admin_notes ?? prev.admin_notes } : prev)
      setAdminNote('')
      showToast('✅', `Report marked as ${status}`)
    } catch(e) { showToast('❌', 'Update failed') }
    setSaving(false)
  }

  const DEPARTMENTS = ['Operations', 'Creatives', 'Cafe Bar', 'Commissary']

  const filtered = reports.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (deptFilter !== 'all' && r.department !== deptFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : r.reported_by
      if (!name.toLowerCase().includes(q) && !r.department?.toLowerCase().includes(q) && !r.type_of_wastage?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const counts = {
    all:      reports.length,
    pending:  reports.filter(r => r.status === 'pending').length,
    reviewed: reports.filter(r => r.status === 'reviewed').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  return (
    <AuthShell>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:"'DM Sans',sans-serif", background:'#f8f5f0' }}>

        {/* Header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:800 }}>Wastage Reports</div>
            <div style={{ fontSize:11, color:'#9a8a7a', marginTop:1 }}>{reports.length} total report{reports.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

          {/* LEFT: Report List */}
          <div style={{ width: selected ? 380 : '100%', flexShrink:0, display:'flex', flexDirection:'column', borderRight: selected ? '1px solid #e5e0d8' : 'none', overflow:'hidden', transition:'width .2s' }}>

            {/* Filters */}
            <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'12px 18px', flexShrink:0 }}>
              {/* Status tabs */}
              <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                {[['all','All'], ['pending','Pending'], ['reviewed','Reviewed'], ['resolved','Resolved']].map(([k,l]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'1.5px solid', borderColor: filter===k ? '#EF4576' : '#d8cebb', background: filter===k ? '#fde8ee' : 'white', color: filter===k ? '#EF4576' : '#7a6a50' }}>
                    {l} {counts[k] > 0 && <span style={{ marginLeft:4, background: filter===k?'#EF4576':'#e5e0d8', color: filter===k?'white':'#7a6a50', borderRadius:10, padding:'1px 6px', fontSize:10 }}>{counts[k]}</span>}
                  </button>
                ))}
              </div>
              {/* Dept + search */}
              <div style={{ display:'flex', gap:8 }}>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  style={{ flex:1, background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'7px 10px', fontSize:12, color:'#3a2a1a', outline:'none', fontFamily:"'DM Sans',sans-serif" }}>
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, type..."
                  style={{ flex:1.5, background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'7px 10px', fontSize:12, color:'#3a2a1a', outline:'none', fontFamily:"'DM Sans',sans-serif" }} />
              </div>
            </div>

            {/* List */}
            <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
              {loading ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'#9a8a7a', fontSize:12 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0' }}>
                  <div style={{ fontSize:32 }}>🗑️</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#5a4a3a', marginTop:10 }}>No reports found</div>
                  <div style={{ fontSize:11, color:'#9a8a7a', marginTop:4 }}>Try adjusting your filters.</div>
                </div>
              ) : filtered.map(r => {
                const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                const dept = DEPT_COLORS[r.department] || { bg:'#f0ede8', color:'#5a4a3a' }
                const icon = TYPE_ICONS[r.type_of_wastage] || '🗑️'
                const staffName = r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : r.reported_by?.split('—')[0]?.trim()
                const isActive = selected?.id === r.id
                return (
                  <div key={r.id}
                    onClick={() => { setSelected(r); setAdminNote(r.admin_notes || '') }}
                    style={{ background:'white', borderRadius:12, border:`1.5px solid ${isActive?'#EF4576':'#e5e0d8'}`, padding:'14px 16px', cursor:'pointer', transition:'all .15s' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor='#d8cebb' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor='#e5e0d8' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', minWidth:0 }}>
                        <span style={{ fontSize:20 }}>{icon}</span>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#1a1208', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.type_of_wastage}</div>
                          <div style={{ fontSize:11, color:'#9a8a7a', marginTop:2 }}>{staffName} · {fmtDate(r.date_of_report)}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0, alignItems:'flex-end' }}>
                        <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'3px 9px', fontSize:10, fontWeight:700 }}>{st.label}</span>
                        <span style={{ background:dept.bg, color:dept.color, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{r.department}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'#5a4a3a', lineHeight:1.5, background:'#faf8f5', borderRadius:7, padding:'8px 10px' }}>
                      <strong>Items:</strong> {r.wastage_breakdown?.slice(0,100)}{r.wastage_breakdown?.length > 100 ? '...' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Detail Panel */}
          {selected && (
            <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                <div>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:800, color:'#1a1208' }}>
                    {TYPE_ICONS[selected.type_of_wastage] || '🗑️'} {selected.type_of_wastage}
                  </div>
                  <div style={{ fontSize:12, color:'#9a8a7a', marginTop:4 }}>
                    Filed {fmtDatetime(selected.created_at)}
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#7a6a50', cursor:'pointer' }}>
                  ✕ Close
                </button>
              </div>

              {/* Status badges */}
              <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
                <span style={{ background:STATUS_STYLE[selected.status]?.bg, color:STATUS_STYLE[selected.status]?.color, borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700 }}>
                  {STATUS_STYLE[selected.status]?.label || selected.status}
                </span>
                <span style={{ background:(DEPT_COLORS[selected.department]||{bg:'#f0ede8'}).bg, color:(DEPT_COLORS[selected.department]||{color:'#5a4a3a'}).color, borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700 }}>
                  {selected.department}
                </span>
              </div>

              {/* Basic info grid */}
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Basic Information</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    ['Date', fmtDate(selected.date_of_report)],
                    ['Time', selected.time_of_report || '—'],
                    ['Reported By', selected.reported_by],
                    ['Department', selected.department],
                  ].map(([k,v]) => (
                    <div key={k}>
                      <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:13, color:'#1a1208', fontWeight:500 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Wastage Details</div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>Description</div>
                  <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{selected.description}</div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>Items Wasted</div>
                  <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, whiteSpace:'pre-wrap', background:'#faf8f5', borderRadius:8, padding:'10px 12px' }}>{selected.wastage_breakdown}</div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>Weight Breakdown</div>
                  <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, whiteSpace:'pre-wrap', background:'#faf8f5', borderRadius:8, padding:'10px 12px' }}>{selected.wastage_weight}</div>
                </div>
                {selected.witnesses && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>Witnesses</div>
                    <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7 }}>{selected.witnesses}</div>
                  </div>
                )}
                {selected.resolution && (
                  <div>
                    <div style={{ fontSize:10, color:'#9a8a7a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>Resolution</div>
                    <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7 }}>{selected.resolution}</div>
                  </div>
                )}
              </div>

              {/* Photo */}
              {selected.photo_url && (
                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px', marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Attached Photo</div>
                  <img src={selected.photo_url} alt="wastage" style={{ maxWidth:'100%', borderRadius:10, border:'1px solid #e5e0d8' }} />
                </div>
              )}

              {/* Declaration */}
              <div style={{ background:'#fef3e2', borderRadius:12, border:'1px solid #f5d78e', padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#a06000', marginBottom:8 }}>Declaration</div>
                <div style={{ fontSize:12, color:'#7a5500' }}>
                  Signed by <strong>{selected.declaration_name}</strong> on {fmtDate(selected.declaration_date)}
                </div>
              </div>

              {/* Admin actions */}
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Admin Actions</div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#5a4a3a', marginBottom:5, display:'block' }}>Add / Update Note</label>
                  <textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="Optional note for the staff member..."
                    style={{ width:'100%', background:'#faf8f5', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', boxSizing:'border-box', resize:'vertical' }}
                  />
                </div>

                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['pending','reviewed','resolved'].map(s => {
                    const st = STATUS_STYLE[s]
                    const isCurrentStatus = selected.status === s
                    return (
                      <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={saving || isCurrentStatus}
                        style={{ flex:1, minWidth:100, padding:'10px 12px', borderRadius:9, fontSize:12, fontWeight:700, cursor: isCurrentStatus || saving ? 'default' : 'pointer', border:'1.5px solid', borderColor: isCurrentStatus ? st.color : '#d8cebb', background: isCurrentStatus ? st.bg : 'white', color: isCurrentStatus ? st.color : '#5a4a3a', opacity: saving ? 0.6 : 1, fontFamily:"'DM Sans',sans-serif" }}>
                        {isCurrentStatus ? '✓ ' : ''}{st.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:30, right:30, background:'#1a1208', color:'white', borderRadius:10, padding:'10px 18px', fontSize:12, fontWeight:600, zIndex:999, display:'flex', gap:8, alignItems:'center', boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
