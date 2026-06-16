'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const DEPT_LABEL = { bar:'Bar', commissary:'Commissary', utility:'Utility', operations:'Operations' }
const DEPT_ICON  = { bar:'🍵', commissary:'🍳', utility:'🧹', operations:'📋' }

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, padding:'12px 18px', borderRadius:12, background:type==='error'?'#dc2626':'#111', color:'white', fontSize:13, fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
      {msg}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'success') => setToast({ msg, type })
  const el = toast ? <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, el }
}

function ReportCard({ report, supervisorId, onAction, showToast }) {
  const [expanded, setExpanded]   = useState(report.status === 'submitted')
  const [loading, setLoading]     = useState(false)
  const [corrections, setCorrections] = useState({})
  const [note, setNote]           = useState('')
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const flagged = report.items?.filter(i => i.flag !== 'ok') ?? []
  const sections = (report.items ?? []).reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const handleForward = async () => {
    setLoading(true)
    const sb = createClient()

    // Save corrections
    for (const [itemId, qty] of Object.entries(corrections)) {
      await sb.from('inventory_report_items').update({ supervisor_corrected_qty: parseFloat(qty) }).eq('id', itemId)
    }

    const { error } = await sb.from('inventory_reports').update({
      status: 'reviewed',
      reviewed_by: supervisorId,
      reviewed_at: new Date().toISOString(),
      supervisor_notes: note.trim() || null,
    }).eq('id', report.id)

    if (error) showToast(error.message, 'error')
    else { showToast('Report forwarded to CEO'); onAction() }
    setLoading(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason', 'error')
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_reports').update({
      status: 'rejected',
      reviewed_by: supervisorId,
      reviewed_at: new Date().toISOString(),
      supervisor_notes: rejectReason.trim(),
    }).eq('id', report.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Report returned to staff'); onAction() }
    setLoading(false)
  }

  return (
    <div style={{ background:'white', border:`1px solid ${report.status==='submitted'?'#fbbf24':'#e5e7eb'}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
            <span style={{ fontSize:16 }}>{DEPT_ICON[report.department]}</span>
            <span style={{ fontSize:14, fontWeight:600, color:'#111' }}>{DEPT_LABEL[report.department]} — {report.shift?.toUpperCase()} Shift</span>
            {flagged.length > 0 && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fef3c7', color:'#92400e' }}>🚩 {flagged.length} need restock</span>}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af' }}>
            {new Date(report.report_date).toLocaleDateString('en-PH', { month:'short', day:'numeric' })}
            {report.submitted_by_staff && ` · ${[report.submitted_by_staff.first_name, report.submitted_by_staff.last_name].filter(Boolean).join(' ')}`}
          </div>
        </div>
        <span style={{ color:'#9ca3af', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 16px' }}>

          {/* Needs Restocking highlight */}
          {flagged.length > 0 && (
            <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:12, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:10 }}>🚩 Needs Restocking</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'6px 12px', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Item</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Count</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Correct</span>
                {flagged.map(item => (
                  <>
                    <span key={`n-${item.id}`} style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>{item.item_name} <span style={{ fontWeight:400, fontSize:10, padding:'1px 6px', borderRadius:4, background: item.flag==='86'?'#fee2e2':'#fef3c7', color: item.flag==='86'?'#991b1b':'#92400e' }}>{item.flag.toUpperCase()}</span></span>
                    <span key={`q-${item.id}`} style={{ fontSize:12, color:'#92400e', textAlign:'right' }}>{item.actual_qty} {item.unit}</span>
                    <input key={`c-${item.id}`} type="number" min="0"
                      value={corrections[item.id] ?? ''}
                      onChange={e => setCorrections(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="—"
                      style={{ width:60, border:'1px solid #fcd34d', borderRadius:6, padding:'4px 6px', fontSize:12, outline:'none', textAlign:'center', background:'white' }} />
                  </>
                ))}
              </div>
            </div>
          )}

          {/* Full inventory by section */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:10 }}>Full Inventory Report</div>
            {Object.entries(sections).map(([section, sectionItems]) => (
              <div key={section} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#9ca3af', marginBottom:6 }}>{section}</div>
                <div style={{ border:'1px solid #f3f4f6', borderRadius:8, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <tbody>
                      {sectionItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: idx < sectionItems.length-1 ? '1px solid #f9fafb' : 'none', background: item.flag!=='ok' ? '#fffbeb' : 'white' }}>
                          <td style={{ padding:'7px 12px', color:'#1f2937', fontWeight: item.flag!=='ok'?600:400 }}>{item.item_name}</td>
                          <td style={{ padding:'7px 12px', color:'#6b7280', textAlign:'right' }}>{item.actual_qty} {item.unit}</td>
                          <td style={{ padding:'7px 12px', width:50 }}>
                            {item.flag !== 'ok' && (
                              <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4, background: item.flag==='86'?'#fee2e2':'#fef3c7', color: item.flag==='86'?'#991b1b':'#92400e' }}>
                                {item.flag.toUpperCase()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {report.status === 'submitted' && (
            <>
              {!showReject && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Note for CEO (optional)</label>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Any context before forwarding…"
                    style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              )}

              {showReject && (
                <div style={{ marginBottom:12 }}>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for returning to staff…"
                    style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                    <button onClick={() => setShowReject(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                    <button onClick={handleReject} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#dc2626', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>Return to staff</button>
                  </div>
                </div>
              )}

              {!showReject && (
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={() => setShowReject(true)} style={{ padding:'7px 14px', fontSize:12, border:'1px solid #fca5a5', borderRadius:8, background:'white', color:'#dc2626', cursor:'pointer' }}>✕ Return to staff</button>
                  <button onClick={handleForward} disabled={loading} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                    {loading ? 'Forwarding…' : '→ Forward to CEO'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function SupervisorReportsPage() {
  const [supervisorId, setSupervisorId] = useState(null)
  const [pending, setPending]   = useState([])
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    const sb = createClient()
    try {
      const [pend, hist] = await Promise.all([
        sb.from('inventory_reports')
          .select('*, items:inventory_report_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .eq('status', 'submitted')
          .order('created_at', { ascending: false }),
        sb.from('inventory_reports')
          .select('*, items:inventory_report_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .in('status', ['reviewed', 'approved', 'rejected'])
          .eq('report_date', dateFilter)
          .order('created_at', { ascending: false }),
      ])
      setPending(pend.data ?? [])
      setHistory(hist.data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [dateFilter])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      const id = staff?.id ?? session.user.id
      setSupervisorId(id)
      // Load with the id directly instead of relying on state
      const [pend, hist] = await Promise.all([
        sb.from('inventory_reports')
          .select('*, items:inventory_report_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .eq('status', 'submitted')
          .order('created_at', { ascending: false }),
        sb.from('inventory_reports')
          .select('*, items:inventory_report_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .in('status', ['reviewed', 'approved', 'rejected'])
          .eq('report_date', dateFilter)
          .order('created_at', { ascending: false }),
      ])
      setPending(pend.data ?? [])
      setHistory(hist.data ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [dateFilter])

  const STATUS_BADGE = {
    reviewed: { label:'Forwarded to CEO', bg:'#fef3c7', color:'#92400e' },
    approved: { label:'CEO Approved ✓',   bg:'#dcfce7', color:'#166534' },
    rejected: { label:'Returned',          bg:'#fee2e2', color:'#991b1b' },
  }

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Inventory Reports</div>
          <div className="topbar-sub">Review staff inventory counts and forward to CEO</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ maxWidth:800 }}>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'Awaiting review', value: pending.length, color:'#d97706' },
              { label:'Forwarded today', value: history.filter(r=>r.status==='reviewed').length, color:'#EF4576' },
              { label:'CEO Approved today', value: history.filter(r=>r.status==='approved').length, color:'#16a34a' },
            ].map(s => (
              <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
                <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
                <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div style={{ marginBottom:32 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#d97706', marginBottom:12 }}>
                Awaiting your review {pending.length > 0 && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, marginLeft:8 }}>{pending.length}</span>}
              </p>
              {loading ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:40 }}>Loading…</p>
                : pending.map(r => <ReportCard key={r.id} report={r} supervisorId={supervisorId} onAction={load} showToast={showToast} />)}
            </div>
          )}

          {/* History by date */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', margin:0 }}>Reports by date</p>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none' }} />
            </div>
            {history.length === 0
              ? <div style={{ textAlign:'center', padding:40, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}><p style={{ color:'#9ca3af', fontSize:13 }}>No reports for this date</p></div>
              : history.map(r => {
                  const sb = STATUS_BADGE[r.status] ?? { label:r.status, bg:'#f3f4f6', color:'#6b7280' }
                  const flagged = r.items?.filter(i => i.flag !== 'ok') ?? []
                  return (
                    <div key={r.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span>{DEPT_ICON[r.department]}</span>
                          <span style={{ fontSize:13, fontWeight:600, color:'#111' }}>{DEPT_LABEL[r.department]} — {r.shift?.toUpperCase()}</span>
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:sb.bg, color:sb.color }}>{sb.label}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>
                          {[r.submitted_by_staff?.first_name, r.submitted_by_staff?.last_name].filter(Boolean).join(' ')}
                          {flagged.length > 0 && <span style={{ marginLeft:8, color:'#92400e' }}>· 🚩 {flagged.length} flagged</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
