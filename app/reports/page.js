'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

// Access control
const INCIDENT_AUTHORIZED = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com', 'hr.ohtgroup@gmail.com']
const MGT_EMAILS           = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']
const HR_EMAIL             = 'hr.ohtgroup@gmail.com'
const HR_STAFF_EMAIL       = 'nazar.richelleann@gmail.com'

// ─── Workflow stages ───────────────────────────────────────────────────────────
// Each incoming report starts at stage 1: hr_review
// hr_review  → mgt_review → investigation → final_sanction → closed
const STAGES = [
  { key: 'hr_review',       label: 'HR Review',       short: 'HR Review',    color: '#7a3a8a', bg: '#f5eeff', num: 1 },
  { key: 'mgt_review',      label: 'Mgt. Review',     short: 'Mgt. Review',  color: '#2d5a8a', bg: '#e8f0fb', num: 2 },
  { key: 'investigation',   label: 'Investigation',   short: 'Investigate',  color: '#a06000', bg: '#fef3e2', num: 3 },
  { key: 'final_sanction',  label: 'Final Sanction',  short: 'Final',        color: '#c0392b', bg: '#fff0f0', num: 4 },
  { key: 'closed',          label: 'Closed',          short: 'Closed',       color: '#4a7a1e', bg: '#eef7e4', num: 5 },
]
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]))

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
  const [userEmail, setUserEmail]     = useState(null)
  const [reports, setReports]         = useState([])
  const [filtered, setFiltered]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState(null)
  const [filterStage, setFilterStage] = useState('all')
  const [filterDept, setFilterDept]   = useState('all')
  const [search, setSearch]           = useState('')
  const [expandedStages, setExpandedStages] = useState(new Set())

  // Panel state per stage
  const [hrNotes,          setHrNotes]          = useState('')
  const [hrSanctions,      setHrSanctions]      = useState('')
  const [mgtNotes,         setMgtNotes]          = useState('')
  const [investigationFindings, setInvestigationFindings] = useState('')
  const [sanctionDetails,  setSanctionDetails]  = useState('')
  const [handbookRef,      setHandbookRef]      = useState('')

  useEffect(() => { fetchReports() }, [])
  useEffect(() => { applyFilters() }, [reports, filterStage, filterDept, search])

  async function fetchReports() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) setUserEmail(session.user.email.toLowerCase())
      const { data } = await supabase
        .from('incident_reports')
        .select('*, staff(first_name, last_name, nickname, role)')
        .order('created_at', { ascending: false })
      const isHR = session?.user?.email?.toLowerCase() === HR_EMAIL
      let allReports = data || []
      if (isHR) {
        allReports = allReports.filter(r => r.staff?.role !== 'Cafe Supervisor')
        const { data: hrStaff } = await supabase
          .from('staff')
          .select('first_name, last_name')
          .eq('email', HR_STAFF_EMAIL)
          .single()
        if (hrStaff) {
          const hrFullName = `${hrStaff.first_name} ${hrStaff.last_name}`.toLowerCase()
          allReports = allReports.filter(r =>
            !r.persons_involved?.toLowerCase().includes(hrFullName)
          )
        }
      }
      setReports(allReports)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function applyFilters() {
    let list = [...reports]
    if (filterStage !== 'all') list = list.filter(r => (r.stage || 'hr_review') === filterStage)
    if (filterDept !== 'all')  list = list.filter(r => r.department === filterDept)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.incident_type?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3500) }

  function openReport(r) {
    setSelected(r)
    setExpandedStages(new Set())
    setHrNotes(r.hr_notes || '')
    setHrSanctions(r.hr_sanctions || '')
    setMgtNotes(r.mgt_notes || '')
    setInvestigationFindings(r.investigation_findings || '')
    setSanctionDetails(r.sanction_details || '')
    setHandbookRef(r.handbook_ref || '')
  }

  // Advance to next stage (or set any stage for mgt)
  async function advanceStage(report, newStage) {
    setSaving(true)
    try {
      const supabase = createClient()
      const updates = {
        stage: newStage,
        hr_notes: hrNotes || null,
        hr_sanctions: hrSanctions || null,
        mgt_notes: mgtNotes || null,
        investigation_findings: investigationFindings || null,
        sanction_details: sanctionDetails || null,
        handbook_ref: handbookRef || null,
      }
      const { error } = await supabase
        .from('incident_reports')
        .update(updates)
        .eq('id', report.id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchReports()
      setSelected(s => s ? { ...s, ...updates } : null)
      showToast('✅', `Moved to ${STAGE_MAP[newStage]?.label}`)
    } catch(e) { showToast('❌', 'Update failed') }
    setSaving(false)
  }

  // Save notes only (no stage change)
  async function saveNotes(report) {
    setSaving(true)
    try {
      const supabase = createClient()
      const updates = {
        hr_notes: hrNotes || null,
        hr_sanctions: hrSanctions || null,
        mgt_notes: mgtNotes || null,
        investigation_findings: investigationFindings || null,
        sanction_details: sanctionDetails || null,
        handbook_ref: handbookRef || null,
      }
      const { error } = await supabase
        .from('incident_reports')
        .update(updates)
        .eq('id', report.id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchReports()
      showToast('✅', 'Notes saved')
    } catch(e) { showToast('❌', 'Save failed') }
    setSaving(false)
  }

  const isHR  = userEmail === HR_EMAIL
  const isMgt = MGT_EMAILS.includes(userEmail)
  const DEPTS = ['Operations', 'Creatives', 'Cafe Bar', 'Commissary']

  const stageCounts = {}
  STAGES.forEach(s => { stageCounts[s.key] = reports.filter(r => (r.stage || 'hr_review') === s.key).length })

  if (userEmail === null) return <AuthShell><div style={{ height:'100%' }} /></AuthShell>

  if (!INCIDENT_AUTHORIZED.includes(userEmail)) {
    return (
      <AuthShell>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, fontFamily:"'DM Sans',sans-serif" }}>
          <div style={{ fontSize:40 }}>🔒</div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, fontWeight:700, color:'#1a1208' }}>Access Restricted</div>
          <div style={{ fontSize:13, color:'#7a6a50', textAlign:'center', maxWidth:320, lineHeight:1.6 }}>
            Incident reports are only accessible to the Managing Director, CEO, and HR.
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Incident Reports</div>
          <div style={{ fontSize:11, color:'#9a8a7a' }}>{filtered.length} of {reports.length} reports</div>
        </div>

        {/* Stage filter tabs */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e0d8', padding:'0 24px', display:'flex', gap:4, overflowX:'auto', flexShrink:0 }}>
          {[{ key:'all', label:'All', count: reports.length }, ...STAGES].map(tab => {
            const count = tab.key === 'all' ? reports.length : stageCounts[tab.key]
            const isActive = filterStage === tab.key
            const stg = STAGE_MAP[tab.key]
            return (
              <button key={tab.key}
                onClick={() => setFilterStage(tab.key)}
                style={{
                  background:'transparent', border:'none',
                  borderBottom: isActive ? `2px solid ${stg?.color || '#EF4576'}` : '2px solid transparent',
                  padding:'12px 12px', fontSize:11, fontWeight: isActive ? 700 : 400,
                  color: isActive ? (stg?.color || '#EF4576') : '#9a8a7a', cursor:'pointer', whiteSpace:'nowrap',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                {tab.label || tab.short}
                {count > 0 && (
                  <span style={{
                    background: isActive ? (stg?.color || '#EF4576') : '#e5e0d8',
                    color: isActive ? 'white' : '#7a6a50',
                    borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

          {/* Report List */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', minWidth:0 }}>
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
                  const stage = r.stage || 'hr_review'
                  const stg = STAGE_MAP[stage] || STAGE_MAP.hr_review
                  const dc = DEPT_COLORS[r.department] || { bg:'#f0ede8', color:'#7a6a50' }
                  const icon = TYPE_ICONS[r.incident_type] || '📋'
                  const isActive = selected?.id === r.id
                  return (
                    <div key={r.id}
                      onClick={() => openReport(r)}
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
                              {isHR ? 'Anonymous' : r.reported_by} · {fmtDate(r.date_of_report)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
                          <span style={{ background:stg.bg, color:stg.color, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                            {stg.num}. {stg.short}
                          </span>
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

          {/* Detail Panel */}
          {selected && (
            <div style={{ width:440, borderLeft:'1px solid #e5e0d8', overflowY:'auto', background:'white', flexShrink:0 }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e0d8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700 }}>Report Detail</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {selected.staff_id && (
                    <a href={`/files?staff=${selected.staff_id}`}
                      style={{ background:'#fde8ee', color:'#EF4576', border:'1px solid #f5b8ca', borderRadius:7, padding:'4px 10px', fontSize:10, fontWeight:700, textDecoration:'none' }}>
                      📁 201 File
                    </a>
                  )}
                  <button onClick={() => setSelected(null)}
                    style={{ background:'#f0ede8', border:'none', borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              </div>

              {/* Stage progress bar */}
              <StageProgress report={selected} />

              <div style={{ padding:'16px 20px' }}>

                {/* Report Facts */}
                <div style={{ background:'#faf8f5', borderRadius:10, padding:'14px', marginBottom:16 }}>
                  <Row label="Incident Type" value={`${TYPE_ICONS[selected.incident_type] || '📋'} ${selected.incident_type}`} />
                  <Row label="Date & Time" value={`${fmtDate(selected.date_of_report)} at ${selected.time_of_report}`} />
                  <Row label="Reported By" value={isHR ? 'Anonymous' : selected.reported_by} />
                  <Row label="Department" value={selected.department} />
                  <Row label="Submitted" value={fmtCreated(selected.created_at)} last />
                </div>

                <Section title="Description of Incident">
                  <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.description}</p>
                </Section>

                <Section title="Persons Involved">
                  <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.persons_involved}</p>
                </Section>

                {selected.witnesses && (
                  <Section title="Witnesses">
                    <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.witnesses}</p>
                  </Section>
                )}

                {selected.resolution && (
                  <Section title="Resolution (from report)">
                    <p style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.7, margin:0 }}>{selected.resolution}</p>
                  </Section>
                )}

                {selected.photo_url && (
                  <Section title="Attached Photo">
                    <a href={selected.photo_url} target="_blank" rel="noreferrer">
                      <img src={selected.photo_url} alt="Incident" style={{ width:'100%', borderRadius:8, objectFit:'cover', maxHeight:200 }} />
                    </a>
                  </Section>
                )}

                {!isHR && (
                  <Section title="Declaration">
                    <div style={{ background:'#fef3e2', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:'#7a5500', lineHeight:1.6 }}>
                        Signed by: <strong>{selected.declaration_name}</strong><br />
                        Date: <strong>{fmtDate(selected.declaration_date)}</strong>
                      </div>
                    </div>
                  </Section>
                )}

                <div style={{ height:1, background:'#e5e0d8', margin:'20px 0' }} />

                {/* ── STAGE 1: HR REVIEW ── */}
                <StageBlock
                  num={1}
                  title="HR Review"
                  color="#7a3a8a"
                  bg="#f5eeff"
                  active={(selected.stage || 'hr_review') === 'hr_review'}
                  done={STAGE_MAP[(selected.stage || 'hr_review')]?.num > 1}
                  expanded={expandedStages.has('hr_review')}
                  onToggle={() => setExpandedStages(s => { const n = new Set(s); n.has('hr_review') ? n.delete('hr_review') : n.add('hr_review'); return n })}
                  viewContent={
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>HR Screening Notes</div>
                        <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#f0eaf8', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap' }}>
                          {selected.hr_notes || <em style={{ color:'#9a8a7a' }}>No notes recorded</em>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>HR Recommended Sanctions</div>
                        <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#f0eaf8', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap' }}>
                          {selected.hr_sanctions || <em style={{ color:'#9a8a7a' }}>No sanctions recorded</em>}
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:10 }}>
                    HR performs initial screening of the report. Once reviewed, forward to Management.
                    <br /><em style={{ color:'#c0392b' }}>HR cannot edit or remove report submissions.</em>
                  </div>
                  <label style={labelStyle}>HR Screening Notes</label>
                  <textarea
                    value={hrNotes}
                    onChange={e => setHrNotes(e.target.value)}
                    disabled={!isHR && !isMgt}
                    rows={3}
                    placeholder="Initial screening observations, completeness check, etc."
                    style={{ ...textareaStyle, opacity: (!isHR && !isMgt) ? 0.6 : 1 }}
                  />
                  <label style={{ ...labelStyle, marginTop:10 }}>HR Recommended Sanctions</label>
                  <textarea
                    value={hrSanctions}
                    onChange={e => setHrSanctions(e.target.value)}
                    disabled={!isHR && !isMgt}
                    rows={2}
                    placeholder="e.g. Verbal warning, written warning, suspension recommendation..."
                    style={{ ...textareaStyle, opacity: (!isHR && !isMgt) ? 0.6 : 1 }}
                  />
                  {(isHR || isMgt) && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => saveNotes(selected)} disabled={saving}
                        style={{ ...outlineBtn }}>
                        {saving ? 'Saving…' : 'Save Notes'}
                      </button>
                      {(selected.stage || 'hr_review') === 'hr_review' && (
                        <button onClick={() => advanceStage(selected, 'mgt_review')} disabled={saving}
                          style={{ ...primaryBtn, background:'#7a3a8a' }}>
                          Forward to Mgt. Review →
                        </button>
                      )}
                    </div>
                  )}
                </StageBlock>

                {/* ── STAGE 2: MGT. REVIEW ── */}
                <StageBlock
                  num={2}
                  title="Mgt. Review"
                  color="#2d5a8a"
                  bg="#e8f0fb"
                  active={(selected.stage || 'hr_review') === 'mgt_review'}
                  done={STAGE_MAP[(selected.stage || 'hr_review')]?.num > 2}
                  locked={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 2}
                  expanded={expandedStages.has('mgt_review')}
                  onToggle={() => setExpandedStages(s => { const n = new Set(s); n.has('mgt_review') ? n.delete('mgt_review') : n.add('mgt_review'); return n })}
                  viewContent={
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Management Notes</div>
                      <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#e0eaf8', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap' }}>
                        {selected.mgt_notes || <em style={{ color:'#9a8a7a' }}>No notes recorded</em>}
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:10 }}>
                    Reviewed by Alex or CJ only. Management decides whether to escalate to formal investigation.
                  </div>
                  <label style={labelStyle}>Management Notes</label>
                  <textarea
                    value={mgtNotes}
                    onChange={e => setMgtNotes(e.target.value)}
                    disabled={!isMgt || STAGE_MAP[(selected.stage || 'hr_review')]?.num < 2}
                    rows={3}
                    placeholder="Management assessment, action items, escalation decision..."
                    style={{ ...textareaStyle, opacity: (!isMgt || STAGE_MAP[(selected.stage || 'hr_review')]?.num < 2) ? 0.5 : 1 }}
                  />
                  {isMgt && (selected.stage || 'hr_review') === 'mgt_review' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => saveNotes(selected)} disabled={saving}
                        style={{ ...outlineBtn }}>
                        {saving ? 'Saving…' : 'Save Notes'}
                      </button>
                      <button onClick={() => advanceStage(selected, 'investigation')} disabled={saving}
                        style={{ ...primaryBtn, background:'#2d5a8a' }}>
                        Escalate to Investigation →
                      </button>
                    </div>
                  )}
                  {isMgt && (selected.stage || 'hr_review') === 'mgt_review' && (
                    <button onClick={() => advanceStage(selected, 'closed')} disabled={saving}
                      style={{ ...outlineBtn, marginTop:6, fontSize:10, color:'#4a7a1e', borderColor:'#4a7a1e' }}>
                      Close without escalation
                    </button>
                  )}
                </StageBlock>

                {/* ── STAGE 3: INVESTIGATION ── */}
                <StageBlock
                  num={3}
                  title="Investigation"
                  color="#a06000"
                  bg="#fef3e2"
                  active={(selected.stage || 'hr_review') === 'investigation'}
                  done={STAGE_MAP[(selected.stage || 'hr_review')]?.num > 3}
                  locked={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 3}
                  expanded={expandedStages.has('investigation')}
                  onToggle={() => setExpandedStages(s => { const n = new Set(s); n.has('investigation') ? n.delete('investigation') : n.add('investigation'); return n })}
                  viewContent={
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Investigation Findings</div>
                      <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#f5e8cc', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap' }}>
                        {selected.investigation_findings || <em style={{ color:'#9a8a7a' }}>No findings recorded</em>}
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:10 }}>
                    Formal investigation and final findings.<br />
                    <strong>Alex</strong> handles cases involving Richelle or any company-wide matter.<br />
                    <strong>HR (Richelle)</strong> handles all other employee cases.
                  </div>
                  <label style={labelStyle}>Investigation Findings</label>
                  <textarea
                    value={investigationFindings}
                    onChange={e => setInvestigationFindings(e.target.value)}
                    disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 3}
                    rows={4}
                    placeholder="Summary of investigation, evidence reviewed, interviews conducted, conclusions reached..."
                    style={{ ...textareaStyle, opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 3 ? 0.5 : 1 }}
                  />
                  {(isMgt || isHR) && (selected.stage || 'hr_review') === 'investigation' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => saveNotes(selected)} disabled={saving}
                        style={{ ...outlineBtn }}>
                        {saving ? 'Saving…' : 'Save Findings'}
                      </button>
                      <button onClick={() => advanceStage(selected, 'final_sanction')} disabled={saving}
                        style={{ ...primaryBtn, background:'#a06000' }}>
                        Proceed to Final Sanction →
                      </button>
                    </div>
                  )}
                  {isMgt && (selected.stage || 'hr_review') === 'investigation' && (
                    <button onClick={() => advanceStage(selected, 'closed')} disabled={saving}
                      style={{ ...outlineBtn, marginTop:6, fontSize:10, color:'#4a7a1e', borderColor:'#4a7a1e' }}>
                      Close — No sanction needed
                    </button>
                  )}
                </StageBlock>

                {/* ── STAGE 4: FINAL SANCTION ── */}
                <StageBlock
                  num={4}
                  title="Final Sanction"
                  color="#c0392b"
                  bg="#fff0f0"
                  active={(selected.stage || 'hr_review') === 'final_sanction'}
                  done={(selected.stage || 'hr_review') === 'closed'}
                  locked={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                  expanded={expandedStages.has('final_sanction')}
                  onToggle={() => setExpandedStages(s => { const n = new Set(s); n.has('final_sanction') ? n.delete('final_sanction') : n.add('final_sanction'); return n })}
                  viewContent={
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {selected.handbook_ref && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Handbook Reference</div>
                          <div style={{ fontSize:12, color:'#3a2a1a', background:'#fde0dd', borderRadius:8, padding:'8px 12px' }}>{selected.handbook_ref}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Sanction Details</div>
                        <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#fde0dd', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap' }}>
                          {selected.sanction_details || <em style={{ color:'#9a8a7a' }}>No sanction recorded</em>}
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:10 }}>
                    Final sanction must be supported by the OHT Employee Handbook.
                    Reference the applicable section below.
                  </div>
                  <label style={labelStyle}>Handbook Reference</label>
                  <input
                    value={handbookRef}
                    onChange={e => setHandbookRef(e.target.value)}
                    disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                    placeholder="e.g. Section 8.3 — Progressive Discipline"
                    style={{ ...inputStyle, opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4 ? 0.5 : 1, marginBottom:8 }}
                  />
                  <label style={labelStyle}>Sanction Details</label>
                  <textarea
                    value={sanctionDetails}
                    onChange={e => setSanctionDetails(e.target.value)}
                    disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                    rows={3}
                    placeholder="Specific sanction issued (verbal warning, written warning, suspension, termination, etc.) and terms..."
                    style={{ ...textareaStyle, opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4 ? 0.5 : 1 }}
                  />
                  {isMgt && (selected.stage || 'hr_review') === 'final_sanction' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => saveNotes(selected)} disabled={saving}
                        style={{ ...outlineBtn }}>
                        {saving ? 'Saving…' : 'Save Sanction'}
                      </button>
                      <button onClick={() => advanceStage(selected, 'closed')} disabled={saving || !handbookRef.trim()}
                        style={{ ...primaryBtn, background: !handbookRef.trim() ? '#ccc' : '#c0392b', cursor: !handbookRef.trim() ? 'not-allowed' : 'pointer' }}
                        title={!handbookRef.trim() ? 'Handbook reference required' : ''}>
                        Close Case ✓
                      </button>
                    </div>
                  )}
                  {!handbookRef.trim() && (selected.stage || 'hr_review') === 'final_sanction' && isMgt && (
                    <div style={{ fontSize:10, color:'#c0392b', marginTop:4 }}>⚠ Handbook reference required before closing</div>
                  )}
                </StageBlock>

                {/* Closed badge */}
                {(selected.stage || 'hr_review') === 'closed' && (
                  <div style={{ background:'#eef7e4', border:'1px solid #b8dfaa', borderRadius:10, padding:'14px', textAlign:'center', marginTop:8 }}>
                    <div style={{ fontSize:22, marginBottom:6 }}>✅</div>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, color:'#4a7a1e' }}>Case Closed</div>
                    <div style={{ fontSize:11, color:'#6a8a5a', marginTop:4 }}>This incident report has been fully resolved and closed.</div>
                    {isMgt && (
                      <button onClick={() => advanceStage(selected, 'final_sanction')} disabled={saving}
                        style={{ ...outlineBtn, marginTop:10, fontSize:10 }}>
                        Reopen to Final Sanction
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', background:'#1a1208', color:'white', borderRadius:10, padding:'10px 18px', fontSize:12, fontWeight:600, zIndex:999, display:'flex', gap:8, alignItems:'center', whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StageProgress({ report }) {
  const currentStage = report.stage || 'hr_review'
  const currentNum   = STAGE_MAP[currentStage]?.num || 1
  return (
    <div style={{ padding:'12px 20px', background:'#faf8f5', borderBottom:'1px solid #e5e0d8' }}>
      <div style={{ display:'flex', alignItems:'center', gap:0 }}>
        {STAGES.map((s, i) => {
          const done    = currentNum > s.num
          const active  = currentNum === s.num
          const locked  = currentNum < s.num
          return (
            <div key={s.key} style={{ display:'flex', alignItems:'center', flex: i < STAGES.length - 1 ? 1 : 'none' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, fontWeight:700,
                  background: done ? s.color : active ? s.color : '#e5e0d8',
                  color: done || active ? 'white' : '#9a8a7a',
                  border: active ? `2px solid ${s.color}` : 'none',
                  boxSizing:'border-box',
                }}>
                  {done ? '✓' : s.num}
                </div>
                <div style={{ fontSize:9, color: active ? s.color : locked ? '#c0b8ae' : '#7a6a50', fontWeight: active ? 700 : 400, whiteSpace:'nowrap' }}>
                  {s.short}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ flex:1, height:2, background: done ? '#4a7a1e' : '#e5e0d8', margin:'0 2px', marginBottom:12 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StageBlock({ num, title, color, bg, active, done, locked, viewContent, children, expanded, onToggle }) {
  const hasView = viewContent && (done || locked)

  return (
    <div style={{
      border: `1.5px solid ${active ? color : done ? '#b8dfaa' : '#e5e0d8'}`,
      borderRadius:10,
      padding:'14px',
      marginBottom:12,
      background: active ? bg : done ? '#f7fcf4' : '#faf8f5',
      opacity: locked && !expanded ? 0.65 : 1,
      transition:'opacity .15s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: active || expanded ? 10 : 0 }}>
        <div style={{
          width:22, height:22, borderRadius:'50%', fontSize:10, fontWeight:700,
          display:'flex', alignItems:'center', justifyContent:'center',
          background: done ? '#4a7a1e' : active ? color : '#d8cebb',
          color: 'white', flexShrink:0,
        }}>
          {done ? '✓' : num}
        </div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:12, fontWeight:700, color: active ? color : done ? '#4a7a1e' : '#7a6a50', flex:1 }}>
          {title}
          {done && <span style={{ fontSize:10, fontWeight:400, marginLeft:6, color:'#4a7a1e' }}>Completed</span>}
          {locked && <span style={{ fontSize:10, fontWeight:400, marginLeft:6, color:'#9a8a7a' }}>Pending</span>}
        </div>
        {hasView && (
          <button
            onClick={onToggle}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:11, color: done ? '#4a7a1e' : '#9a8a7a', fontWeight:600, padding:'2px 6px', borderRadius:6, display:'flex', alignItems:'center', gap:3, fontFamily:"'DM Sans',sans-serif" }}>
            {expanded ? '▲ Hide' : '▾ View'}
          </button>
        )}
      </div>
      {active && children}
      {!active && expanded && hasView && (
        <div style={{ marginTop:4 }}>
          {viewContent}
        </div>
      )}
    </div>
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

const labelStyle = { fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:4 }
const textareaStyle = { width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', resize:'vertical', boxSizing:'border-box' }
const inputStyle = { width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'8px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', boxSizing:'border-box' }
const primaryBtn = { background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }
const outlineBtn = { background:'white', color:'#3a2a1a', border:'1px solid #d8cebb', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }
