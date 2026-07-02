'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const STATUS_STYLE = {
  'Pending':              { bg:'#fef3e2', color:'#a06000' },
  'NTE Issued':           { bg:'#e8f0fb', color:'#2d5a8a' },
  'Explanation Received': { bg:'#f5eeff', color:'#7a3a8a' },
  'NOD Issued':           { bg:'#fff0e0', color:'#b06000' },
  'Served':               { bg:'#eef7e4', color:'#4a7a1e' },
  'Appealed':             { bg:'#fde8ee', color:'#c0392b' },
  'Lifted':               { bg:'#f0f0f0', color:'#666' },
}

const SEV_STYLE = {
  Minor:    { bg:'#eef7e4', color:'#4a7a1e' },
  Moderate: { bg:'#fef3e2', color:'#a06000' },
  Major:    { bg:'#fde8ee', color:'#c0392b' },
  Grave:    { bg:'#2d0a0a', color:'#ff6b6b' },
}

const iStyle = { width:'100%', background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', boxSizing:'border-box' }
const labelStyle = { fontSize:12, fontWeight:600, color:'#5a4a3a', marginBottom:5, display:'block' }
const btn = (bg, color='white') => ({ background:bg, color, border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" })

const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '—'
const fmtDT   = s => s ? new Date(s).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—'

function StatusBadge({ s }) {
  const st = STATUS_STYLE[s] || { bg:'#eee', color:'#333' }
  return <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>{s}</span>
}

function SeverityBadge({ s }) {
  const st = SEV_STYLE[s] || { bg:'#eee', color:'#333' }
  return <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{s}</span>
}

function IssueSanctionModal({ incidentReport, onSave, onClose }) {
  const [staff, setStaff]       = useState([])
  const [violations, setViolations] = useState([])
  const [form, setForm] = useState({
    staff_id: incidentReport?.staff_ids?.[0] || '',
    handbook_entry_id: '',
    sanction_type: '',
    offense_number: 1,
    admin_notes: '',
    suspension_days: '',
    suspension_start: '',
  })
  const [saving, setSaving] = useState(false)
  const [selectedViolation, setSelectedViolation] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('staff').select('id,first_name,last_name,role').order('first_name'),
      supabase.from('handbook_entries').select('*').eq('is_active', true).order('violation_code'),
    ]).then(([{ data: s }, { data: v }]) => {
      setStaff(s || [])
      setViolations(v || [])
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function onViolationChange(id) {
    set('handbook_entry_id', id)
    const v = violations.find(x => x.id === id)
    setSelectedViolation(v || null)
    if (v) {
      const sanctions = [v.sanction_1st, v.sanction_2nd, v.sanction_3rd, v.sanction_4th, v.sanction_5th].filter(Boolean)
      const idx = Math.min(form.offense_number - 1, sanctions.length - 1)
      set('sanction_type', sanctions[idx] || '')
    }
  }

  function onOffenseChange(n) {
    set('offense_number', n)
    if (selectedViolation) {
      const sanctions = [selectedViolation.sanction_1st, selectedViolation.sanction_2nd, selectedViolation.sanction_3rd, selectedViolation.sanction_4th, selectedViolation.sanction_5th].filter(Boolean)
      const idx = Math.min(n - 1, sanctions.length - 1)
      set('sanction_type', sanctions[idx] || '')
    }
  }

  async function save() {
    if (!form.staff_id || !form.handbook_entry_id || !form.sanction_type) return alert('Staff, violation, and sanction type are required.')
    setSaving(true)
    const supabase = createClient()
    const v = selectedViolation
    const payload = {
      incident_report_id: incidentReport?.id || null,
      staff_id: form.staff_id,
      handbook_entry_id: form.handbook_entry_id,
      violation_code: v?.violation_code,
      violation_title: v?.title,
      category: v?.category,
      severity: v?.severity,
      offense_number: form.offense_number,
      sanction_type: form.sanction_type,
      status: 'Pending',
      admin_notes: form.admin_notes,
      suspension_days: form.suspension_days ? parseInt(form.suspension_days) : null,
      suspension_start: form.suspension_start || null,
      suspension_end: form.suspension_days && form.suspension_start
        ? new Date(new Date(form.suspension_start).getTime() + parseInt(form.suspension_days) * 86400000).toISOString().split('T')[0]
        : null,
    }
    const { error } = await supabase.from('sanctions').insert(payload)
    if (error) { setSaving(false); return alert('Error: ' + error.message) }

    // Notify admins
    try {
      const staffMember = staff.find(s => s.id === form.staff_id)
      await notifyAdmins(supabase, {
        title: '⚠️ New Sanction Issued',
        body: `${staffMember?.first_name} ${staffMember?.last_name} — ${v?.violation_code}: ${v?.title} (${form.sanction_type})`
      })
    } catch {}

    setSaving(false)
    onSave()
  }

  const groupedViolations = violations.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {})

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fffdf9', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#1a1208' }}>Issue Sanction</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888' }}>×</button>
        </div>

        {incidentReport && (
          <div style={{ background:'#fef3e2', border:'1px solid #f5d89e', borderRadius:8, padding:10, marginBottom:16, fontSize:12, color:'#a06000' }}>
            Linked to Incident Report filed on {fmtDT(incidentReport.created_at)}
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Staff Member *</label>
          <select style={iStyle} value={form.staff_id} onChange={e => set('staff_id', e.target.value)}>
            <option value="">— Select staff —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.role}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Violation *</label>
          <select style={iStyle} value={form.handbook_entry_id} onChange={e => onViolationChange(e.target.value)}>
            <option value="">— Select violation —</option>
            {Object.entries(groupedViolations).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map(v => <option key={v.id} value={v.id}>{v.violation_code} — {v.title}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {selectedViolation && (
          <div style={{ background:'#f5f0e8', borderRadius:8, padding:12, marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
              <SeverityBadge s={selectedViolation.severity} />
              <span style={{ color:'#5a4a3a', fontWeight:600 }}>{selectedViolation.category}</span>
            </div>
            <div style={{ color:'#5a4a3a' }}>
              {[selectedViolation.sanction_1st, selectedViolation.sanction_2nd, selectedViolation.sanction_3rd, selectedViolation.sanction_4th, selectedViolation.sanction_5th]
                .filter(Boolean).map((s, i) => <span key={i} style={{ marginRight:4 }}>{i>0?'→':''} <b>{i+1}{['st','nd','rd','th','th'][i]}:</b> {s}</span>)}
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <div>
            <label style={labelStyle}>Offense Number *</label>
            <select style={iStyle} value={form.offense_number} onChange={e => onOffenseChange(parseInt(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}{['st','nd','rd','th','th'][n-1]} Offense</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sanction Type *</label>
            <input style={iStyle} value={form.sanction_type} onChange={e => set('sanction_type', e.target.value)} placeholder="Auto-filled from violation" />
          </div>
        </div>

        {(form.sanction_type || '').toLowerCase().includes('suspension') && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Suspension Days</label>
              <input type="number" style={iStyle} value={form.suspension_days} onChange={e => set('suspension_days', e.target.value)} min="1" max="30" />
            </div>
            <div>
              <label style={labelStyle}>Suspension Start Date</label>
              <input type="date" style={iStyle} value={form.suspension_start} onChange={e => set('suspension_start', e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Admin Notes</label>
          <textarea style={{ ...iStyle, minHeight:80, resize:'vertical' }} value={form.admin_notes} onChange={e => set('admin_notes', e.target.value)} placeholder="Context, findings, or additional details…" />
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btn('#f0ebe3','#5a4a3a')}>Cancel</button>
          <button onClick={save} disabled={saving} style={btn('#c0392b')}>{saving ? 'Issuing…' : '⚠️ Issue Sanction'}</button>
        </div>
      </div>
    </div>
  )
}

function SanctionDetail({ sanction, staff, onUpdate, onClose }) {
  const [status, setStatus] = useState(sanction.status)
  const [notes, setNotes]   = useState(sanction.admin_notes || '')
  const [explanation, setExplanation] = useState(sanction.explanation_text || '')
  const [saving, setSaving] = useState(false)
  const [linkedReport, setLinkedReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const staffMember = staff.find(s => s.id === sanction.staff_id)

  useEffect(() => {
    if (!sanction.incident_report_id) { setLinkedReport(null); return }
    setLoadingReport(true)
    const supabase = createClient()
    supabase
      .from('incident_reports')
      .select('mgt_notes, mgt_case_summary, investigation_findings, staff_explanations, sanction_notes')
      .eq('id', sanction.incident_report_id)
      .single()
      .then(({ data }) => { setLinkedReport(data || null); setLoadingReport(false) })
  }, [sanction.incident_report_id])

  function parseExplanations(raw) {
    if (!raw) return []
    try { const list = JSON.parse(raw); return Array.isArray(list) ? list : [] } catch { return [] }
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const update = { status, admin_notes: notes, explanation_text: explanation, updated_at: new Date().toISOString() }
    if (status === 'NTE Issued' && !sanction.nte_issued_at) update.nte_issued_at = new Date().toISOString()
    if (status === 'NOD Issued' && !sanction.nod_issued_at) update.nod_issued_at = new Date().toISOString()
    if (status === 'Served') update.notified_at = new Date().toISOString()
    await supabase.from('sanctions').update(update).eq('id', sanction.id)
    setSaving(false)
    onUpdate()
  }

  return (
    <div style={{ background:'white', borderRadius:12, border:'1px solid #e8ddd0', padding:20, height:'100%', overflowY:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#888', fontFamily:'monospace', marginBottom:4 }}>{sanction.violation_code}</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#1a1208' }}>{sanction.violation_title}</div>
          <div style={{ fontSize:12, color:'#888', marginTop:3 }}>{sanction.category}</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#888' }}>×</button>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <SeverityBadge s={sanction.severity} />
        <StatusBadge s={sanction.status} />
        <span style={{ background:'#f5f0e8', color:'#5a4a3a', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
          {sanction.offense_number}{['st','nd','rd','th','th'][sanction.offense_number-1]} Offense
        </span>
      </div>

      <div style={{ background:'#f5f0e8', borderRadius:8, padding:12, marginBottom:16, fontSize:13 }}>
        <div style={{ fontWeight:700, color:'#1a1208', marginBottom:4 }}>
          👤 {staffMember?.first_name} {staffMember?.last_name}
        </div>
        <div style={{ color:'#5a4a3a' }}>{staffMember?.role}</div>
      </div>

      <div style={{ background:'#fde8ee', borderRadius:8, padding:12, marginBottom:16, fontSize:13 }}>
        <div style={{ fontWeight:700, color:'#c0392b', marginBottom:2 }}>Sanction</div>
        <div style={{ color:'#1a1208' }}>{sanction.sanction_type}</div>
        {sanction.suspension_days && (
          <div style={{ color:'#888', marginTop:4, fontSize:12 }}>
            {sanction.suspension_days} day{sanction.suspension_days > 1 ? 's' : ''} suspension
            {sanction.suspension_start ? ` · Starts ${fmtDate(sanction.suspension_start)}` : ''}
            {sanction.suspension_end ? ` → Ends ${fmtDate(sanction.suspension_end)}` : ''}
          </div>
        )}
      </div>

      {/* Case history from the linked incident report — Mgt. Review onward.
          HR Review stays out of scope here on purpose, same as everywhere else. */}
      {sanction.incident_report_id && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:8 }}>CASE NOTES — MGT. REVIEW ONWARD</div>
          {loadingReport ? (
            <div style={{ fontSize:12, color:'#888' }}>Loading…</div>
          ) : !linkedReport ? (
            <div style={{ fontSize:12, color:'#888', fontStyle:'italic' }}>Linked report not found.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ background:'#e8f0fb', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2d5a8a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Mgt. Review Notes</div>
                <div style={{ fontSize:12, color:'#1a1208', whiteSpace:'pre-wrap' }}>{linkedReport.mgt_notes || <em style={{ color:'#9a8a7a' }}>None recorded</em>}</div>
              </div>
              {linkedReport.mgt_case_summary && (
                <div style={{ background:'#e8f0fb', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#2d5a8a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Case Summary Shown to Employee</div>
                  <div style={{ fontSize:12, color:'#1a1208', whiteSpace:'pre-wrap' }}>{linkedReport.mgt_case_summary}</div>
                </div>
              )}
              <div style={{ background:'#fef3e2', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#a06000', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Investigation Findings</div>
                <div style={{ fontSize:12, color:'#1a1208', whiteSpace:'pre-wrap' }}>{linkedReport.investigation_findings || <em style={{ color:'#9a8a7a' }}>None recorded</em>}</div>
              </div>
              {parseExplanations(linkedReport.staff_explanations).length > 0 && (
                <div style={{ background:'#fef3e2', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#a06000', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Staff Explanations</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {parseExplanations(linkedReport.staff_explanations).map((e, i) => (
                      <div key={i} style={{ fontSize:12, color:'#1a1208' }}>
                        <strong>{e.name}</strong> <span style={{ color:'#9a8a7a', fontWeight:400 }}>· {fmtDT(e.submitted_at)}</span>
                        <div style={{ marginTop:2 }}>{e.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {linkedReport.sanction_notes && (
                <div style={{ background:'#fde8ee', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#c0392b', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Final Sanction Admin Notes</div>
                  <div style={{ fontSize:12, color:'#1a1208', whiteSpace:'pre-wrap' }}>{linkedReport.sanction_notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:8 }}>TWIN-NOTICE TIMELINE</div>
        <div style={{ fontSize:12, color:'#888' }}>
          <div style={{ marginBottom:4 }}>📋 Sanction Created: {fmtDT(sanction.created_at)}</div>
          <div style={{ marginBottom:4, color: sanction.nte_issued_at ? '#4a7a1e' : '#ccc' }}>📝 NTE Issued: {sanction.nte_issued_at ? fmtDT(sanction.nte_issued_at) : 'Not yet'}</div>
          <div style={{ marginBottom:4, color: sanction.explanation_text ? '#4a7a1e' : '#ccc' }}>💬 Explanation: {sanction.explanation_text ? 'Received' : 'Pending'}</div>
          <div style={{ marginBottom:4, color: sanction.nod_issued_at ? '#4a7a1e' : '#ccc' }}>⚖️ NOD Issued: {sanction.nod_issued_at ? fmtDT(sanction.nod_issued_at) : 'Not yet'}</div>
          <div style={{ color: sanction.notified_at ? '#4a7a1e' : '#ccc' }}>✅ Served/Notified: {sanction.notified_at ? fmtDT(sanction.notified_at) : 'Not yet'}</div>
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={labelStyle}>Update Status</label>
        <select style={iStyle} value={status} onChange={e => setStatus(e.target.value)}>
          {Object.keys(STATUS_STYLE).map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={labelStyle}>Employee Explanation</label>
        <textarea style={{ ...iStyle, minHeight:70, resize:'vertical' }} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Paste or type employee's explanation here…" />
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={labelStyle}>Admin Notes</label>
        <textarea style={{ ...iStyle, minHeight:70, resize:'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Investigation findings, decisions, context…" />
      </div>

      {sanction.incident_report_id && (
        <div style={{ marginBottom:14, fontSize:12 }}>
          <a href={`/reports?id=${sanction.incident_report_id}`} style={{ color:'#2d5a8a', fontWeight:600 }}>🔗 View Linked Incident Report</a>
        </div>
      )}

      <button onClick={save} disabled={saving} style={{ ...btn('#1a1208'), width:'100%' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
    </div>
  )
}

export default function SanctionsPage() {
  const [sanctions, setSanctions] = useState([])
  const [staff, setStaff]         = useState([])
  const [filtered, setFiltered]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [issueModal, setIssueModal] = useState(false)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusF] = useState('all')
  const [sevFilter, setSevF]      = useState('all')
  const [toast, setToast]         = useState(null)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase.from('sanctions').select('*').order('created_at', { ascending: false }),
      supabase.from('staff').select('id,first_name,last_name,role'),
    ])
    setSanctions(s || [])
    setStaff(st || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let r = sanctions
    if (statusFilter !== 'all') r = r.filter(x => x.status === statusFilter)
    if (sevFilter !== 'all') r = r.filter(x => x.severity === sevFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      const staffMatch = staff.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)).map(s => s.id)
      r = r.filter(x => (x.violation_title||'').toLowerCase().includes(q) || (x.violation_code||'').toLowerCase().includes(q) || staffMatch.includes(x.staff_id))
    }
    setFiltered(r)
  }, [sanctions, statusFilter, sevFilter, search])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const getStaff = id => staff.find(s => s.id === id)

  const stats = {
    total: sanctions.length,
    pending: sanctions.filter(s => s.status === 'Pending').length,
    nte: sanctions.filter(s => s.status === 'NTE Issued').length,
    served: sanctions.filter(s => s.status === 'Served').length,
  }

  return (
    <AuthShell>
      <div style={{ padding:'24px 28px', fontFamily:"'DM Sans',sans-serif", maxWidth:1200, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'#1a1208' }}>⚖️ Sanctions</h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#888' }}>Disciplinary actions and NTE/NOD tracking</p>
          </div>
          <button onClick={() => setIssueModal(true)} style={btn('#c0392b')}>+ Issue Sanction</button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Total', value:stats.total, bg:'#f5f0e8', color:'#1a1208' },
            { label:'Pending', value:stats.pending, bg:'#fef3e2', color:'#a06000' },
            { label:'NTE Issued', value:stats.nte, bg:'#e8f0fb', color:'#2d5a8a' },
            { label:'Served', value:stats.served, bg:'#eef7e4', color:'#4a7a1e' },
          ].map(st => (
            <div key={st.label} style={{ background:st.bg, borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:800, color:st.color }}>{st.value}</div>
              <div style={{ fontSize:11, fontWeight:600, color:st.color, opacity:0.8 }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          <input style={{ ...iStyle, maxWidth:220 }} placeholder="🔍 Search staff or violation…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...iStyle, maxWidth:180 }} value={statusFilter} onChange={e => setStatusF(e.target.value)}>
            <option value="all">All Status</option>
            {Object.keys(STATUS_STYLE).map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={{ ...iStyle, maxWidth:160 }} value={sevFilter} onChange={e => setSevF(e.target.value)}>
            <option value="all">All Severities</option>
            {['Minor','Moderate','Major','Grave'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap:20 }}>
          {/* List */}
          <div>
            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading sanctions…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, color:'#888' }}>No sanctions found.</div>
            ) : (
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e8ddd0', overflow:'hidden' }}>
                {filtered.map((s, i) => {
                  const sm = getStaff(s.staff_id)
                  return (
                    <div key={s.id} onClick={() => setSelected(s)} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, padding:'14px 16px', borderBottom: i < filtered.length-1 ? '1px solid #f0ebe3':'none', cursor:'pointer', background: selected?.id === s.id ? '#fef8f0':'white', transition:'background 0.15s' }}>
                      <div>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'#888', fontFamily:'monospace' }}>{s.violation_code}</span>
                          <SeverityBadge s={s.severity} />
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#1a1208', marginBottom:2 }}>{s.violation_title}</div>
                        <div style={{ fontSize:12, color:'#888' }}>
                          👤 {sm ? `${sm.first_name} ${sm.last_name}` : 'Unknown'} · {s.offense_number}{['st','nd','rd','th','th'][s.offense_number-1]} offense · {fmtDT(s.created_at)}
                        </div>
                        <div style={{ fontSize:12, color:'#5a4a3a', marginTop:2 }}>📋 {s.sanction_type}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                        <StatusBadge s={s.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <SanctionDetail
              sanction={selected}
              staff={staff}
              onUpdate={() => { load(); showToast('Sanction updated') }}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      {issueModal && (
        <IssueSanctionModal
          incidentReport={null}
          onSave={() => { setIssueModal(false); load(); showToast('Sanction issued!') }}
          onClose={() => setIssueModal(false)}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1a1208', color:'white', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, zIndex:2000 }}>{toast}</div>
      )}
    </AuthShell>
  )
}
