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

function ReportCard({ report, ceoId, onAction, showToast }) {
  const [expanded, setExpanded] = useState(report.status === 'reviewed')
  const [loading, setLoading]   = useState(false)
  const [ceoNote, setCeoNote]   = useState('')
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const flagged = report.items?.filter(i => i.flag !== 'ok') ?? []
  const sections = (report.items ?? []).reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const handleApprove = async () => {
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_reports').update({
      status: 'approved',
      approved_by: ceoId,
      approved_at: new Date().toISOString(),
      ceo_notes: ceoNote.trim() || null,
    }).eq('id', report.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Report approved — supervisor notified'); onAction() }
    setLoading(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason', 'error')
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_reports').update({
      status: 'rejected',
      approved_by: ceoId,
      approved_at: new Date().toISOString(),
      ceo_notes: rejectReason.trim(),
    }).eq('id', report.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Report sent back to supervisor'); onAction() }
    setLoading(false)
  }

  return (
    <div style={{ background:'white', border:`1px solid ${report.status==='reviewed'?'#fbbf24':'#e5e7eb'}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
            <span style={{ fontSize:16 }}>{DEPT_ICON[report.department]}</span>
            <span style={{ fontSize:14, fontWeight:600, color:'#111' }}>{DEPT_LABEL[report.department]} — {report.shift?.toUpperCase()} Shift</span>
            {flagged.length > 0 && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fef3c7', color:'#92400e' }}>🚩 {flagged.length} need restock</span>}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af' }}>
            {new Date(report.report_date).toLocaleDateString('en-PH', { month:'short', day:'numeric' })}
            {report.supervisor_notes && <span style={{ marginLeft:8, color:'#6b7280' }}>· Supervisor: "{report.supervisor_notes}"</span>}
          </div>
        </div>
        <span style={{ color:'#9ca3af', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 16px' }}>

          {/* Flagged items highlight */}
          {flagged.length > 0 && (
            <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:12, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:10 }}>🚩 Restock Request</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', padding:'4px 0', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Item</th>
                    <th style={{ textAlign:'right', padding:'4px 0', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Count</th>
                    <th style={{ textAlign:'right', padding:'4px 0', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Threshold</th>
                    <th style={{ textAlign:'center', padding:'4px 0', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding:'5px 0', fontWeight:600, color:'#92400e' }}>{item.item_name}</td>
                      <td style={{ padding:'5px 0', textAlign:'right', color:'#92400e' }}>{item.supervisor_corrected_qty ?? item.actual_qty} {item.unit}</td>
                      <td style={{ padding:'5px 0', textAlign:'right', color:'#9ca3af' }}>{item.threshold_qty} {item.unit}</td>
                      <td style={{ padding:'5px 0', textAlign:'center' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:4, background: item.flag==='86'?'#fee2e2':'#fef3c7', color: item.flag==='86'?'#991b1b':'#92400e' }}>
                          {item.flag.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Full inventory */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:10 }}>Full Inventory Report</div>
            {Object.entries(sections).map(([section, sectionItems]) => (
              <div key={section} style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#9ca3af', marginBottom:5 }}>{section}</div>
                <div style={{ border:'1px solid #f3f4f6', borderRadius:8, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <tbody>
                      {sectionItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: idx < sectionItems.length-1 ? '1px solid #f9fafb':'none', background: item.flag!=='ok'?'#fffbeb':'white' }}>
                          <td style={{ padding:'7px 12px', color:'#1f2937', fontWeight:item.flag!=='ok'?600:400 }}>{item.item_name}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', color:'#374151' }}>{item.supervisor_corrected_qty ?? item.actual_qty} {item.unit}</td>
                          <td style={{ padding:'7px 12px', width:40, textAlign:'center' }}>
                            {item.flag !== 'ok' && (
                              <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4, background:item.flag==='86'?'#fee2e2':'#fef3c7', color:item.flag==='86'?'#991b1b':'#92400e' }}>
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

          {report.status === 'reviewed' && !showReject && (
            <>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Note for supervisor (optional)</label>
                <input type="text" value={ceoNote} onChange={e => setCeoNote(e.target.value)} placeholder="Any instructions…"
                  style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setShowReject(true)} style={{ padding:'7px 14px', fontSize:12, border:'1px solid #fca5a5', borderRadius:8, background:'white', color:'#dc2626', cursor:'pointer' }}>✕ Send back</button>
                <button onClick={handleApprove} disabled={loading} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#16a34a', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                  {loading ? 'Approving…' : '✓ Approve & notify supervisor'}
                </button>
              </div>
            </>
          )}

          {showReject && (
            <div>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for sending back…"
                style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={() => setShowReject(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleReject} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#dc2626', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>Send back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CEOInventoryPage() {
  const [ceoId, setCeoId]       = useState(null)
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
          .select('*, items:inventory_report_items(*)')
          .eq('status', 'reviewed')
          .order('created_at', { ascending: false }),
        sb.from('inventory_reports')
          .select('*, items:inventory_report_items(*)')
          .in('status', ['approved', 'rejected'])
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
      setCeoId(staff?.id ?? session.user.id)
      load()
    })
  }, [])

  useEffect(() => { load() }, [dateFilter] )

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Inventory Approvals</div>
          <div className="topbar-sub">Approve inventory reports forwarded by the cafe supervisor</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ maxWidth:800 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'Awaiting approval', value: pending.length, color:'#d97706' },
              { label:'Approved today', value: history.filter(r=>r.status==='approved').length, color:'#16a34a' },
              { label:'Sent back today', value: history.filter(r=>r.status==='rejected').length, color:'#9ca3af' },
            ].map(s => (
              <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
                <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
                <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {loading ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:40 }}>Loading…</p> : (
            <>
              {pending.length === 0 ? (
                <div style={{ textAlign:'center', padding:60, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb', marginBottom:24 }}>
                  <p style={{ color:'#9ca3af', fontSize:13 }}>No reports awaiting approval</p>
                </div>
              ) : (
                <div style={{ marginBottom:32 }}>
                  <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Awaiting your approval</p>
                  {pending.map(r => <ReportCard key={r.id} report={r} ceoId={ceoId} onAction={load} showToast={showToast} />)}
                </div>
              )}

              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', margin:0 }}>History by date</p>
                  <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                    style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none' }} />
                </div>
                {history.length === 0
                  ? <div style={{ textAlign:'center', padding:40, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}><p style={{ color:'#9ca3af', fontSize:13 }}>No reports for this date</p></div>
                  : history.map(r => (
                    <div key={r.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span>{DEPT_ICON[r.department]}</span>
                          <span style={{ fontSize:13, fontWeight:600, color:'#111' }}>{DEPT_LABEL[r.department]} — {r.shift?.toUpperCase()}</span>
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: r.status==='approved'?'#dcfce7':'#fee2e2', color: r.status==='approved'?'#166534':'#991b1b' }}>
                            {r.status==='approved'?'Approved ✓':'Sent back'}
                          </span>
                        </div>
                        {r.ceo_notes && <div style={{ fontSize:11, color:'#6b7280' }}>"{r.ceo_notes}"</div>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
