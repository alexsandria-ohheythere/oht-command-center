'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyWithAdmins } from '../../lib/notify'

// Access control
const INCIDENT_AUTHORIZED = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com', 'hr.ohtgroup@gmail.com']
const MGT_EMAILS           = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']
const HR_EMAIL             = 'hr.ohtgroup@gmail.com'
const HR_STAFF_EMAIL       = 'nazar.richelleann@gmail.com'
const LEADERSHIP_ROLES     = ['Managing Director', 'CEO']

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

// "Name (Role), Name (Role), Name (Role)" → ["Name (Role)", "Name (Role)", "Name (Role)"]
function splitPersons(str) {
  if (!str) return []
  const parts = str.split('), ')
  return parts
    .map((p, i) => (i < parts.length - 1 ? p + ')' : p))
    .map(p => p.trim())
    .filter(Boolean)
}

// "Richelle Nazar (Cafe Supervisor)" → "Richelle Nazar"
const bareName = s => (s || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()

// Legacy fallback: match a display name to a staff record by exact "First Last" text.
// Returns an id ONLY if there's exactly one unambiguous match — duplicate/ambiguous
// names (e.g. two staff records for the same person under different logins) are left
// unresolved so mgt can pick the right one manually rather than guessing wrong.
function guessStaffId(name, directory) {
  const target = bareName(name)
  if (!target) return null
  const matches = directory.filter(s => `${s.first_name} ${s.last_name}`.trim().toLowerCase() === target)
  return matches.length === 1 ? matches[0].id : null
}

// Builds a { "Name (Role)": staffId } lookup for a report's persons_involved list.
// Prefers the IDs saved at submission time (persons_involved_ids); for older reports
// filed before ID-tracking existed, falls back to an unambiguous name match.
function buildIdMap(namesStr, idsStr, directory) {
  const names = splitPersons(namesStr)
  const ids = (idsStr || '').split(',').map(s => s.trim()).filter(Boolean)
  const map = {}
  names.forEach((name, i) => {
    const id = ids[i] || guessStaffId(name, directory)
    if (id) map[name] = id
  })
  return map
}

// Explanations staff submit themselves from the Staff Portal during the Investigation
// stage — stored as a JSON list: [{ staff_id, name, text, submitted_at }]
function parseExplanations(raw) {
  if (!raw) return []
  try { const list = JSON.parse(raw); return Array.isArray(list) ? list : [] } catch { return [] }
}

export default function ReportsPage() {
  const [userEmail, setUserEmail]     = useState(null)
  const [reports, setReports]         = useState([])
  const [filtered, setFiltered]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [filterStage, setFilterStage] = useState('all')
  const [filterDept, setFilterDept]   = useState('all')
  const [search, setSearch]           = useState('')
  const [expandedStages, setExpandedStages] = useState(new Set())
  const [handbookEntries, setHandbookEntries] = useState([])
  const [staffDirectory,  setStaffDirectory]  = useState([])

  // Panel state per stage
  const [hrNotes,          setHrNotes]          = useState('')
  const [hrSanction,       setHrSanction]       = useState('')
  const [hrSanctionNotes,  setHrSanctionNotes]  = useState('')
  const [hrViolation,      setHrViolation]      = useState('')
  const [mgtNotes,         setMgtNotes]          = useState('')
  const [investigationFindings, setInvestigationFindings] = useState('')
  const [handbookRef,      setHandbookRef]      = useState('')
  const [offenseNum,       setOffenseNum]       = useState('1st')
  const [sanctionType,     setSanctionType]     = useState('')
  const [sanctionNotes,    setSanctionNotes]    = useState('')
  const [sanctionDetails,  setSanctionDetails]  = useState('')
  const [sanctionedStaff,  setSanctionedStaff]  = useState([])
  const [staffIdMap,       setStaffIdMap]       = useState({})
  const [editingLinks,     setEditingLinks]     = useState(new Set())
  const [addStaffPick,     setAddStaffPick]     = useState('')
  const [stageOverride,    setStageOverride]    = useState('')
  const [pendingStageMove, setPendingStageMove] = useState('')

  useEffect(() => { fetchReports() }, [])
  useEffect(() => { applyFilters() }, [reports, filterStage, filterDept, search])
  useEffect(() => {
    async function fetchHandbook() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('handbook_entries')
          .select('id, violation_code, title, category, severity')
          .eq('is_active', true)
          .order('violation_code', { ascending: true })
        setHandbookEntries(data || [])
      } catch(e) { console.error('handbook fetch', e) }
    }
    fetchHandbook()
  }, [])
  useEffect(() => {
    async function fetchStaffDirectory() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('staff')
          .select('id, first_name, last_name, role')
          .order('first_name', { ascending: true })
        setStaffDirectory(data || [])
      } catch(e) { console.error('staff directory fetch', e) }
    }
    fetchStaffDirectory()
  }, [])
  // Keeps Sanction Type in sync with Violation + Offense Number at all times — including
  // when a report is reopened with these already pre-filled and neither dropdown gets
  // touched this session. Previously this only ran on an actual onChange event, so a
  // report could sit with sanction_type empty indefinitely, which then silently broke
  // the sync into the `sanctions` table (sanction_type is NOT NULL there).
  useEffect(() => {
    if (!handbookRef) return
    const entry = handbookEntries.find(x => `${x.violation_code} — ${x.title}` === handbookRef)
    if (!entry) return
    const offenseKey = { '1st':'sanction_1st', '2nd':'sanction_2nd', '3rd':'sanction_3rd', '4th':'sanction_4th', '5th':'sanction_5th' }[offenseNum] || 'sanction_1st'
    setSanctionType(entry[offenseKey] || '')
  }, [handbookRef, offenseNum, handbookEntries])

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

  async function deleteReport(id) {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('incident_reports').delete().eq('id', id)
      if (error) { showToast('❌', error.message); setDeleting(false); return }
      setSelected(null)
      setConfirmDelete(false)
      await fetchReports()
      showToast('🗑️', 'Report deleted')
    } catch(e) { showToast('❌', 'Delete failed') }
    setDeleting(false)
  }

  function openReport(r) {
    setSelected(r)
    setExpandedStages(new Set())
    setHrNotes(r.hr_notes || '')
    setHrSanction(r.hr_sanction || '')
    setHrSanctionNotes(r.hr_sanction_notes || '')
    setHrViolation(r.hr_violation || '')
    setMgtNotes(r.mgt_notes || '')
    setInvestigationFindings(r.investigation_findings || '')
    setSanctionDetails(r.sanction_details || '')
    setHandbookRef(r.handbook_ref || '')
    setOffenseNum(r.offense_num || '1st')
    setSanctionType(r.sanction_type || '')
    setSanctionNotes(r.sanction_notes || '')
    setSanctionedStaff(r.sanctioned_staff ? splitPersons(r.sanctioned_staff) : splitPersons(r.persons_involved))
    setStaffIdMap(buildIdMap(r.persons_involved, r.persons_involved_ids, staffDirectory))
    setEditingLinks(new Set())
    setAddStaffPick('')
    setStageOverride('')
    setPendingStageMove('')
  }

  // Safety net: if the staff directory finishes loading after a report is already
  // open (race on first load), re-run the auto-match — but keep any manual picks
  // mgt already made in the meantime.
  useEffect(() => {
    if (!selected || staffDirectory.length === 0) return
    setStaffIdMap(prev => ({
      ...buildIdMap(selected.persons_involved, selected.persons_involved_ids, staffDirectory),
      ...prev,
    }))
  }, [staffDirectory])

  // Bridges the incident report's Final Sanction stage into the `sanctions` table —
  // the table the Staff Portal's "My Sanctions" page actually reads from. Without this,
  // finishing Final Sanction here never showed up for the employee, since the two
  // features wrote to completely different tables.
  async function syncSanctionsForReport(report, supabase) {
    const targets = sanctionedStaff
      .map(name => ({ name, id: staffIdMap[name] }))
      .filter(p => p.id)
    if (targets.length === 0) return { ok: true, created: 0 }
    try {
      const { data: existing } = await supabase
        .from('sanctions')
        .select('staff_id')
        .eq('incident_report_id', report.id)
      const existingIds = new Set((existing || []).map(s => s.staff_id))
      const toCreate = targets.filter(p => !existingIds.has(p.id))
      if (toCreate.length === 0) return { ok: true, created: 0 }

      const entry = handbookEntries.find(x => `${x.violation_code} — ${x.title}` === handbookRef)
      const offenseInt = { '1st':1, '2nd':2, '3rd':3, '4th':4, '5th':5 }[offenseNum] || 1
      const payloads = toCreate.map(p => ({
        incident_report_id: report.id,
        staff_id: p.id,
        handbook_entry_id: entry?.id || null,
        violation_code: entry?.violation_code || null,
        violation_title: entry?.title || null,
        category: entry?.category || null,
        severity: entry?.severity || null,
        offense_number: offenseInt,
        sanction_type: sanctionType || null,
        status: 'Pending',
        admin_notes: sanctionNotes || null,
      }))
      const { error } = await supabase.from('sanctions').insert(payloads)
      if (error) { console.error('Sanction sync error:', error.message); return { ok: false, error: error.message } }

      for (const p of toCreate) {
        try {
          await notifyWithAdmins(
            p.id,
            { type:'general', title:'⚖️ New Sanction Issued', message:'A sanction has been recorded on your disciplinary file. Check My Sanctions for details.' },
            { type:'general', title:'⚖️ Sanction Issued', message:`${p.name} received a sanction: ${sanctionType || entry?.title || 'see incident report'}.` }
          )
        } catch(e) { console.error('Sanction notify error:', e) }
      }
      return { ok: true, created: toCreate.length }
    } catch(e) {
      console.error('Sanction sync failed:', e)
      return { ok: false, error: e?.message || 'Unknown error' }
    }
  }

  // Advance to next stage (or set any stage for mgt)
  async function advanceStage(report, newStage) {
    setSaving(true)
    try {
      const supabase = createClient()
      const updates = {
        stage: newStage,
        hr_notes: hrNotes || null,
        hr_sanction: hrSanction || null,
        hr_sanction_notes: hrSanctionNotes || null,
        hr_violation: hrViolation || null,
        mgt_notes: mgtNotes || null,
        investigation_findings: investigationFindings || null,
        handbook_ref: handbookRef || null,
        offense_num: offenseNum || null,
        sanction_type: sanctionType || null,
        sanction_notes: sanctionNotes || null,
        sanctioned_staff: sanctionedStaff.join(', ') || null,
        sanctioned_staff_ids: sanctionedStaff.map(n => staffIdMap[n]).filter(Boolean).join(', ') || null,
      }
      const { error } = await supabase
        .from('incident_reports')
        .update(updates)
        .eq('id', report.id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchReports()
      setSelected(s => s ? { ...s, ...updates } : null)
      if (newStage === 'closed' && (report.stage || 'hr_review') === 'final_sanction' && handbookRef.trim()) {
        const syncResult = await syncSanctionsForReport(report, supabase)
        if (!syncResult.ok) {
          showToast('⚠️', `Report closed, but sanction failed to sync to staff portal: ${syncResult.error}`)
          setSaving(false)
          return
        }
      }
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
        hr_sanction: hrSanction || null,
        hr_sanction_notes: hrSanctionNotes || null,
        hr_violation: hrViolation || null,
        mgt_notes: mgtNotes || null,
        investigation_findings: investigationFindings || null,
        handbook_ref: handbookRef || null,
        offense_num: offenseNum || null,
        sanction_type: sanctionType || null,
        sanction_notes: sanctionNotes || null,
        sanctioned_staff: sanctionedStaff.join(', ') || null,
        sanctioned_staff_ids: sanctionedStaff.map(n => staffIdMap[n]).filter(Boolean).join(', ') || null,
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
                  {isMgt && (
                    <button onClick={() => setConfirmDelete(true)}
                      style={{ background:'#fff0f0', color:'#c0392b', border:'1px solid #f5c0b8', borderRadius:7, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      🗑️ Delete
                    </button>
                  )}
                  <button onClick={() => setSelected(null)}
                    style={{ background:'#f0ede8', border:'none', borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              </div>

              {/* Stage progress bar */}
              <StageProgress report={selected} />

              {/* Management override — Alex/CJ can send a report back to any stage.
                  Incident reports are sensitive; mistakes or new information can surface
                  after the fact, and the normal flow only moves forward. */}
              {isMgt && (
                <div style={{ background:'#fff3f3', border:'1px solid #f5c6c6', borderRadius:10, padding:'12px 14px', margin:'14px 20px 0' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#c0392b', marginBottom:4 }}>⚠️ Management Override</div>
                  <div style={{ fontSize:10, color:'#7a6a50', marginBottom:8, lineHeight:1.5 }}>
                    Move this report to any stage — forward or back — to correct a mistake or reopen it for further review.
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <select
                      value={stageOverride}
                      onChange={e => { setStageOverride(e.target.value); setPendingStageMove('') }}
                      style={{ flex:1, border:'1px solid #d8cebb', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', background:'white', boxSizing:'border-box' }}>
                      <option value="">— Select a stage —</option>
                      {STAGES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}{s.key === (selected.stage || 'hr_review') ? ' (current)' : ''}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!stageOverride || stageOverride === (selected.stage || 'hr_review')) return
                        setPendingStageMove(stageOverride)
                      }}
                      disabled={saving || !stageOverride || stageOverride === (selected.stage || 'hr_review')}
                      style={{ ...outlineBtn, opacity: (!stageOverride || stageOverride === (selected.stage || 'hr_review')) ? 0.5 : 1, cursor: (!stageOverride || stageOverride === (selected.stage || 'hr_review')) ? 'not-allowed' : 'pointer' }}>
                      Move
                    </button>
                  </div>

                  {/* Inline confirmation — avoids relying on window.confirm(), which some
                      embedded/webview contexts silently suppress with no visible effect. */}
                  {pendingStageMove && (
                    <div style={{ marginTop:10, background:'white', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:12, color:'#3a2a1a', marginBottom:8 }}>
                        Move this report to <strong>{STAGE_MAP[pendingStageMove]?.label || pendingStageMove}</strong>? This bypasses the normal step-by-step workflow.
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button
                          onClick={() => {
                            advanceStage(selected, pendingStageMove)
                            setStageOverride('')
                            setPendingStageMove('')
                          }}
                          disabled={saving}
                          style={{ ...primaryBtn, background:'#c0392b' }}>
                          {saving ? 'Moving…' : 'Confirm Move'}
                        </button>
                        <button
                          onClick={() => setPendingStageMove('')}
                          disabled={saving}
                          style={{ ...outlineBtn }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                      {selected.hr_violation && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Handbook Violation</div>
                          <div style={{ fontSize:12, color:'#1a1208', background:'#f0eaf8', borderRadius:8, padding:'8px 12px', fontWeight:600 }}>📖 {selected.hr_violation}</div>
                        </div>
                      )}
                      {selected.hr_sanction && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Recommended Sanction</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ background:'#7a3a8a', color:'white', borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{selected.hr_sanction}</span>
                            {selected.hr_sanction_notes && <span style={{ fontSize:11, color:'#5a4a3a' }}>{selected.hr_sanction_notes}</span>}
                          </div>
                        </div>
                      )}
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
                  <label style={{ ...labelStyle, marginTop:10 }}>Handbook Violation</label>
                  <select
                    value={hrViolation}
                    onChange={e => setHrViolation(e.target.value)}
                    disabled={!isHR && !isMgt}
                    style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color: hrViolation ? '#1a1208' : '#9a8a7a', outline:'none', background:'white', opacity: (!isHR && !isMgt) ? 0.6 : 1, boxSizing:'border-box' }}>
                    <option value="">— Tag a handbook violation —</option>
                    {Object.entries(
                      handbookEntries.reduce((acc, e) => {
                        if (!acc[e.category]) acc[e.category] = []
                        acc[e.category].push(e)
                        return acc
                      }, {})
                    ).map(([cat, entries]) => (
                      <optgroup key={cat} label={cat}>
                        {entries.map(e => (
                          <option key={e.id} value={`${e.violation_code} — ${e.title}`}>
                            {e.violation_code} — {e.title} ({e.severity})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <label style={{ ...labelStyle, marginTop:10 }}>Recommended Sanction</label>
                  <select
                    value={hrSanction}
                    onChange={e => setHrSanction(e.target.value)}
                    disabled={!isHR && !isMgt}
                    style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color: hrSanction ? '#1a1208' : '#9a8a7a', outline:'none', background:'white', opacity: (!isHR && !isMgt) ? 0.6 : 1, boxSizing:'border-box' }}>
                    <option value="">— Select a sanction —</option>
                    <option value="No Action">No Action</option>
                    <option value="Verbal Warning">Verbal Warning</option>
                    <option value="Written Warning">Written Warning</option>
                    <option value="Retraining">Retraining</option>
                    <option value="Final Warning">Final Warning</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Termination">Termination</option>
                  </select>
                  <label style={{ ...labelStyle, marginTop:8 }}>Sanction Notes <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(duration, conditions, etc.)</span></label>
                  <textarea
                    value={hrSanctionNotes}
                    onChange={e => setHrSanctionNotes(e.target.value)}
                    disabled={!isHR && !isMgt}
                    rows={2}
                    placeholder="e.g. 3-day suspension without pay, effective June 23..."
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
                      <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, background:'#f5e8cc', borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap', marginBottom: parseExplanations(selected.staff_explanations).length ? 10 : 0 }}>
                        {selected.investigation_findings || <em style={{ color:'#9a8a7a' }}>No findings recorded</em>}
                      </div>
                      {parseExplanations(selected.staff_explanations).length > 0 && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Staff Explanations</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {parseExplanations(selected.staff_explanations).map((e, i) => (
                              <div key={i} style={{ fontSize:11, color:'#3a2a1a', lineHeight:1.5, background:'#f5e8cc', borderRadius:8, padding:'8px 10px' }}>
                                <strong>{e.name}:</strong> {e.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  }
                >
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:10 }}>
                    Formal investigation and final findings.<br />
                    <strong>Alex</strong> handles cases involving Richelle or any company-wide matter.<br />
                    <strong>HR (Richelle)</strong> handles all other employee cases.
                  </div>

                  {/* Explanations staff submitted themselves from the Staff Portal —
                      this is their due-process chance to respond before Final Sanction. */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Staff Explanations</div>
                    {parseExplanations(selected.staff_explanations).length === 0 ? (
                      <div style={{ fontSize:12, color:'#9a8a7a', fontStyle:'italic' }}>No explanations submitted yet</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {parseExplanations(selected.staff_explanations).map((e, i) => (
                          <div key={i} style={{ background:'#f5e8cc', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#5a4a3a', marginBottom:4 }}>
                              👤 {e.name} <span style={{ fontWeight:400, color:'#9a8a7a' }}>· {fmtCreated(e.submitted_at)}</span>
                            </div>
                            <div style={{ fontSize:12, color:'#3a2a1a', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{e.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.6, marginBottom:12 }}>
                    Final sanction must be supported by the OHT Employee Handbook.
                  </div>

                  {/* Staff Member(s) — the person(s) the report is about, NOT the person who filed it.
                      Removable chips let mgt exclude anyone who shouldn't be sanctioned. Anyone not
                      yet linked to a real staff record (older reports filed before ID-tracking, or
                      an ambiguous name match) gets a dropdown to match them manually — required
                      before their sanction can sync to their Staff Portal. */}
                  <label style={labelStyle}>
                    Staff Member{sanctionedStaff.length !== 1 ? 's' : ''} Receiving Sanction
                  </label>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:6 }}>
                    {sanctionedStaff.length === 0 && (
                      <div style={{ ...inputStyle, color:'#9a8a7a', fontSize:12 }}>No staff selected</div>
                    )}
                    {sanctionedStaff.map((name, i) => {
                      const resolvedId = staffIdMap[name]
                      const canEdit = isMgt && (selected.stage || 'hr_review') === 'final_sanction'
                      const showPicker = !resolvedId || editingLinks.has(i)
                      const resolvedStaff = resolvedId ? staffDirectory.find(s => s.id === resolvedId) : null
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', background:'#f0ede8', borderRadius: showPicker ? 10 : 20, padding: showPicker ? '8px 10px' : '6px 8px 6px 12px', fontSize:12, color:'#5a4a3a' }}>
                          <span>👤 {name}</span>
                          {resolvedId && !showPicker && (
                            <span style={{ color:'#4a7a1e', fontSize:11 }}>→ {resolvedStaff ? `${resolvedStaff.first_name} ${resolvedStaff.last_name}` : 'linked'}</span>
                          )}
                          {!resolvedId && <span style={{ color:'#c0392b', fontSize:11, fontWeight:600 }}>⚠ not linked</span>}
                          {canEdit && !showPicker && (
                            <button
                              onClick={() => setEditingLinks(s => new Set(s).add(i))}
                              title="Change which staff record this links to"
                              style={{ background:'none', border:'none', color:'#5a4a3a', cursor:'pointer', fontSize:11, padding:0, textDecoration:'underline' }}
                            >✏ change</button>
                          )}
                          {canEdit && showPicker && (
                            <select
                              defaultValue={resolvedId || ''}
                              onChange={e => {
                                setStaffIdMap(m => ({ ...m, [name]: e.target.value }))
                                setEditingLinks(s => { const n = new Set(s); n.delete(i); return n })
                              }}
                              style={{ fontSize:11, border:'1px solid #d8cebb', borderRadius:6, padding:'4px 6px', fontFamily:"'DM Sans',sans-serif", background:'white', color:'#1a1208' }}
                            >
                              <option value="" disabled>Match to staff record…</option>
                              {staffDirectory.map(s => (
                                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>
                              ))}
                            </select>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setSanctionedStaff(list => list.filter((_, idx) => idx !== i))}
                              title="Remove — no sanction for this person"
                              style={{ background:'#e5ded4', border:'none', borderRadius:'50%', width:18, height:18, color:'#c0392b', cursor:'pointer', fontSize:11, lineHeight:1, padding:0, marginLeft:'auto' }}
                            >✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {isMgt && (selected.stage || 'hr_review') === 'final_sanction' && sanctionedStaff.length < splitPersons(selected.persons_involved).length && (
                    <button
                      onClick={() => setSanctionedStaff(splitPersons(selected.persons_involved))}
                      style={{ ...outlineBtn, fontSize:10, padding:'4px 10px', marginBottom:10 }}
                    >↺ Restore all persons involved</button>
                  )}

                  {isMgt && (selected.stage || 'hr_review') === 'final_sanction' && (
                    <select
                      value={addStaffPick}
                      onChange={e => {
                        const id = e.target.value
                        if (!id) return
                        const s = staffDirectory.find(x => x.id === id)
                        if (!s) return
                        const label = `${s.first_name} ${s.last_name} (${s.role || 'Staff'})`
                        setSanctionedStaff(list => list.includes(label) ? list : [...list, label])
                        setStaffIdMap(m => ({ ...m, [label]: id }))
                        setAddStaffPick('')
                      }}
                      style={{ width:'100%', boxSizing:'border-box', fontSize:12, border:'1px dashed #d8cebb', borderRadius:8, padding:'8px 10px', fontFamily:"'DM Sans',sans-serif", background:'white', color:'#7a6a50', marginBottom:10 }}
                    >
                      <option value="">+ Add another staff member to sanction…</option>
                      {staffDirectory
                        .filter(s => !LEADERSHIP_ROLES.includes(s.role))
                        .filter(s => !sanctionedStaff.includes(`${s.first_name} ${s.last_name} (${s.role || 'Staff'})`))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>
                        ))}
                    </select>
                  )}

                  {/* Violation from handbook */}
                  <label style={labelStyle}>Violation *</label>
                  <select
                    value={handbookRef}
                    onChange={e => setHandbookRef(e.target.value)}
                    disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                    style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color: handbookRef ? '#1a1208' : '#9a8a7a', outline:'none', background:'white', opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4 ? 0.5 : 1, boxSizing:'border-box', marginBottom:10 }}>
                    <option value="">— Select violation —</option>
                    {Object.entries(
                      handbookEntries.reduce((acc, e) => {
                        if (!acc[e.category]) acc[e.category] = []
                        acc[e.category].push(e)
                        return acc
                      }, {})
                    ).map(([cat, entries]) => (
                      <optgroup key={cat} label={cat}>
                        {entries.map(e => (
                          <option key={e.id} value={`${e.violation_code} — ${e.title}`}>
                            {e.violation_code} — {e.title} ({e.severity})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Offense Number + Auto-filled Sanction Type */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div>
                      <label style={labelStyle}>Offense Number *</label>
                      <select
                        value={offenseNum}
                        onChange={e => setOffenseNum(e.target.value)}
                        disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                        style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', background:'white', opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4 ? 0.5 : 1, boxSizing:'border-box' }}>
                        <option value="1st">1st Offense</option>
                        <option value="2nd">2nd Offense</option>
                        <option value="3rd">3rd Offense</option>
                        <option value="4th">4th Offense</option>
                        <option value="5th">5th Offense</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Sanction Type</label>
                      <div style={{ ...inputStyle, background:'#f0ede8', color: sanctionType ? '#1a1208' : '#9a8a7a', fontSize:12, minHeight:40, display:'flex', alignItems:'center' }}>
                        {sanctionType || 'Auto-filled from violation'}
                      </div>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <label style={labelStyle}>Admin Notes</label>
                  <textarea
                    value={sanctionNotes}
                    onChange={e => setSanctionNotes(e.target.value)}
                    disabled={STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4}
                    rows={3}
                    placeholder="Context, findings, or additional details..."
                    style={{ ...textareaStyle, opacity: STAGE_MAP[(selected.stage || 'hr_review')]?.num < 4 ? 0.5 : 1 }}
                  />

                  {isMgt && (selected.stage || 'hr_review') === 'final_sanction' && (
                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      <button onClick={() => saveNotes(selected)} disabled={saving}
                        style={{ ...outlineBtn }}>
                        {saving ? 'Saving…' : 'Save Sanction'}
                      </button>
                      <button onClick={() => advanceStage(selected, 'closed')} disabled={saving || !handbookRef.trim() || !sanctionType.trim()}
                        style={{ ...primaryBtn, background: (!handbookRef.trim() || !sanctionType.trim()) ? '#ccc' : '#c0392b', cursor: (!handbookRef.trim() || !sanctionType.trim()) ? 'not-allowed' : 'pointer' }}
                        title={!handbookRef.trim() ? 'Select a violation first' : !sanctionType.trim() ? 'No sanction defined for this offense number in the handbook' : ''}>
                        ⚠️ Issue Sanction
                      </button>
                    </div>
                  )}
                  {!handbookRef.trim() && (selected.stage || 'hr_review') === 'final_sanction' && isMgt && (
                    <div style={{ fontSize:10, color:'#c0392b', marginTop:4 }}>⚠ Violation selection required before issuing sanction</div>
                  )}
                  {handbookRef.trim() && !sanctionType.trim() && (selected.stage || 'hr_review') === 'final_sanction' && isMgt && (
                    <div style={{ fontSize:10, color:'#c0392b', marginTop:4 }}>⚠ This violation has no sanction defined for the {offenseNum} offense in the handbook — update the handbook entry or pick a different offense number</div>
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

      {confirmDelete && selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'white', borderRadius:14, padding:'28px 28px 24px', width:340, boxShadow:'0 8px 40px rgba(0,0,0,.25)', fontFamily:"'DM Sans',sans-serif" }}>
            <div style={{ fontSize:28, marginBottom:12, textAlign:'center' }}>🗑️</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#1a1208', textAlign:'center', marginBottom:8 }}>Delete this report?</div>
            <div style={{ fontSize:12, color:'#7a6a50', textAlign:'center', lineHeight:1.6, marginBottom:20 }}>
              <strong>{selected.incident_type}</strong><br />
              {isHR ? 'Anonymous' : selected.reported_by} · {fmtDate(selected.date_of_report)}<br />
              <span style={{ color:'#c0392b' }}>This cannot be undone.</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex:1, background:'#f0ede8', color:'#3a2a1a', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteReport(selected.id)} disabled={deleting}
                style={{ flex:1, background:'#c0392b', color:'white', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
