'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const STATUS_STYLE = {
  pending:  { bg:'#fef3e2', color:'#a06000', label:'Pending' },
  reviewed: { bg:'#e8f0fb', color:'#2d5a8a', label:'Reviewed' },
  resolved: { bg:'#eef7e4', color:'#4a7a1e', label:'Resolved' },
}
const TYPE_ICONS = {
  'Injury/Accident':    '🩹',
  'Property Damage':    '🔧',
  'Customer Complaint': '😤',
  'Employee Misconduct':'⚠️',
  'Safety Hazard':      '🚨',
  'Abuse':              '🚫',
  'Other':              '📋',
}
const DEPT_COLORS = {
  'Operations':  { bg:'#e8f0fb', color:'#2d5a8a' },
  'Creatives':   { bg:'#f5eeff', color:'#7a3a8a' },
  'Cafe Bar':    { bg:'#fde8ee', color:'#c0392b' },
  'Commissary':  { bg:'#fef3e2', color:'#a06000' },
}

const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '—'
const fmtCreated = s => s ? new Date(s).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—'

export default function ReportsPage() {
  const [reports, setReports]       = useState([])
  const [filtered, setFiltered]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)
  const [filterStatus, setFilter]   = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch]         = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => { fetchReports() }, [])
  useEffect(() => { applyFilters() }, [reports, filterStatus, filterDept, search])

  async function fetchReports() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('incident_reports')
        .select('*, staff(first_name, last_name, nickname, role)')
        .order('created_at', { ascending: false })
      setReports(data || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function applyFilters() {
    let list = [...reports]
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus)
    if (filterDept !== 'all')   list = list.filter(r => r.department === filterDept)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.incident_type?.toLowerCase().includes(q) ||
        r.reported_by?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3000) }

  async function updateStatus(id, status) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('incident_reports')
        .update({ status, admin_notes: adminNotes || null })
        .eq('id', id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchReports()
      setSelected(s => ({ ...s, status, admin_notes: adminNotes || s.admin_notes }))
      showToast('✅', `Status updated to ${status}`)
    } catch(e) { showToast('❌', 'Update failed') }
    setSaving(false)
  }

  const DEPTS = ['Operations', 'Creatives', 'Cafe Bar', 'Commissary']

  // Counts
  const counts = {
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    reviewed: reports.filter(r => r.status === 'reviewed').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  return (
    <AuthShell>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>

        {/* Page header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Incident Reports</div>
          <div style={{ fontSize:11, color:'#9a8a7a' }}>{filtered.length} of {reports.length} reports</div>
        </div>

        {/* Status filter tabs */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'0 24px', display:'flex', gap:4, overflowX:'auto', flexShrink:0 }}>
          {[
            { key:'all',      label:'All',      count: counts.all },
            { key:'pending',  label:'Pending',  count: counts.pending },
            { key:'reviewed', label:'Reviewed', count: counts.reviewed },
            { key:'resolved', label:'Resolved', count: counts.resolved },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                background:'transparent', border:'none', borderBottom: filterStatus === tab.key ? '2px solid #EF4576' : '2px solid transparent',
                padding:'12px 14px', fontSize:12, fontWeight: filterStatus === tab.key ? 700 : 400,
                color: filterStatus === tab.key ? '#EF4576' : '#9a8a7a', cursor:'pointer', whiteSpace:'nowrap',
                display:'flex', alignItems:'center', gap:6,
              }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: filterStatus === tab.key ? '#EF4576' : '#e5e0d8',
                  color: filterStatus === tab.key ? 'white' : '#7a6a50',
                  borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

          {/* LEFT: List */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', minWidth:0 }}>

            {/* Search + dept filter */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reports..."
                style={{ flex:1, border:'1px solid #d8cebb', borderRadius:8, padding:'8px 12px', fontSize:12, outline:'none', fontFamily:"'DM Sans',sans-serif" }}
              />
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                style={{ border:'1px solid #d8cebb', borderRadius:8, padding:'8px 10px', fontSize:12, outline:'none', color:'#3a2a1a', fontFamily:"'DM Sans',sans-serif", background:'white' }}>
                <option value="all">All Depts</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#9a8a7a', fontSize:12 }}>Loading reports...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#5a4a3a' }}>No reports found</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(r => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                  const dc = DEPT_COLORS[r.department] || { bg:'#f0ede8', color:'#7a6a50' }
                  const icon = TYPE_ICONS[r.incident_type] || '📋'
                  const isActive = selected?.id === r.id
                  return (
                    <div key={r.id}
                      onClick={() => { setSelected(r); setAdminNotes(r.admin_notes || '') }}
                      style={{
                        background: isActive ? '#fde8ee' : 'white',
                        border: `1px solid ${isActive ? '#EF4576' : '#e5e0d8'}`,
                        borderRadius:10, padding:'12px 14px', cursor:'pointer',
                        transition:'all .15s',
                      }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:20 }}>{icon}</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#1a1208' }}>{r.incident_type}</div>
                            <div style={{ fontSize:11, color:'#9a8a7a', marginTop:1 }}>
                              {r.reported_by} · {fmtDate(r.date_of_report)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
                          <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{st.label}</span>
                          <span style={{ background:dc.bg, color:dc.color, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{r.department}</span>
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:'#5a4a3a', lineHeight:1.5 }}>
                        {r.description?.slice(0, 100)}{r.description?.length > 100 ? '...' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Detail panel */}
          {selected && (
            <div style={{ width:400, borderLeft:'1px solid #e5e0d8', overflowY:'auto', background:'white', flexShrink:0 }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e0d8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700 }}>Report Detail</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {selected.staff_id && (
                    <a href={`/files?staff=${selected.staff_id}`}
                      style={{ background:'#fde8ee', color:'#EF4576', border:'1px solid #f5b8ca', borderRadius:7, padding:'4px 10px', fontSize:10, fontWeight:700, textDecoration:'none' }}>
                      📁 View 201
                    </a>
                  )}
                  <button onClick={() => setSelected(null)}
                    style={{ background:'#f0ede8', border:'none', borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              </div>

              <div style={{ padding:'20px' }}>

                {/* Status badge + actions */}
                <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
                  {['pending','reviewed','resolved'].map(s => {
                    const st = STATUS_STYLE[s]
                    const isActive = selected.status === s
                    return (
                      <button key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        disabled={saving || isActive}
                        style={{
                          background: isActive ? st.bg : '#f0ede8',
                          color: isActive ? st.color : '#7a6a50',
                          border: isActive ? `1.5px solid ${st.color}` : '1.5px solid #d8cebb',
                          borderRadius:20, padding:'5px 12px', fontSize:11, fontWeight:700,
                          cursor: isActive ? 'default' : 'pointer',
                        }}>
                        {isActive ? '✓ ' : ''}{st.label}
                      </button>
                    )
                  })}
                </div>

                {/* Basic info */}
                <div style={{ background:'#faf8f5', borderRadius:10, padding:'14px', marginBottom:16 }}>
                  <Row label="Incident Type" value={`${TYPE_ICONS[selected.incident_type] || '📋'} ${selected.incident_type}`} />
                  <Row label="Date & Time" value={`${fmtDate(selected.date_of_report)} at ${selected.time_of_report}`} />
                  <Row label="Reported By" value={selected.reported_by} />
                  <Row label="Department" value={selected.department} />
                  <Row label="Submitted" value={fmtCreated(selected.created_at)} last />
                </div>

                {/* Description */}
                <Section title="Description of Incident">
                  <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.description}</p>
                </Section>

                {/* Persons involved */}
                <Section title="Persons Involved">
                  <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.persons_involved}</p>
                </Section>

                {/* Witnesses */}
                {selected.witnesses && (
                  <Section title="Witnesses">
                    <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.witnesses}</p>
                  </Section>
                )}

                {/* Resolution */}
                <Section title="Resolution">
                  <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.resolution || <em style={{ color:'#9a8a7a' }}>Not provided</em>}</p>
                </Section>

                {/* Photo */}
                {selected.photo_url && (
                  <Section title="Attached Photo">
                    <a href={selected.photo_url} target="_blank" rel="noreferrer">
                      <img src={selected.photo_url} alt="Incident" style={{ width:'100%', borderRadius:8, objectFit:'cover', maxHeight:220 }} />
                    </a>
                    <div style={{ fontSize:10, color:'#9a8a7a', marginTop:4 }}>Click to open full size</div>
                  </Section>
                )}

                {/* Declaration */}
                <Section title="Declaration">
                  <div style={{ background:'#fef3e2', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:11, color:'#7a5500', lineHeight:1.6 }}>
                      Signed by: <strong>{selected.declaration_name}</strong><br />
                      Date: <strong>{fmtDate(selected.declaration_date)}</strong>
                    </div>
                  </div>
                </Section>

                {/* Admin notes */}
                <Section title="Admin Notes">
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={3}
                    placeholder="Add internal notes about this incident..."
                    style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', resize:'vertical', boxSizing:'border-box' }}
                  />
                  <button
                    onClick={() => updateStatus(selected.id, selected.status)}
                    disabled={saving}
                    style={{ marginTop:8, background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </Section>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', background:'#1a1208', color:'white', borderRadius:10, padding:'10px 18px', fontSize:12, fontWeight:600, zIndex:999, display:'flex', gap:8, alignItems:'center', whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

function Row({ label, value, last }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, paddingBottom: last ? 0 : 8, marginBottom: last ? 0 : 8, borderBottom: last ? 'none' : '1px solid #e5e0d8' }}>
      <span style={{ fontSize:11, color:'#9a8a7a', fontWeight:600, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, color:'#1a1208', textAlign:'right', fontWeight:500 }}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{title}</div>
      {children}
    </div>
  )
}
