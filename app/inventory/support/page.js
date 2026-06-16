'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const URGENCY = {
  high:   { label:'Urgent',  bg:'#fee2e2', color:'#b91c1c' },
  normal: { label:'Normal',  bg:'#e0f2fe', color:'#0369a1' },
  low:    { label:'Low',     bg:'#f3f4f6', color:'#6b7280' },
}

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

function staffName(s) {
  if (!s) return 'Staff'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff'
}

function RequestCard({ req, supervisorId, onAction, showToast }) {
  const [expanded, setExpanded]     = useState(true)
  const [loading, setLoading]       = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showFulfill, setShowFulfill] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [estCost, setEstCost]       = useState('')
  const [supplier, setSupplier]     = useState('')
  const [fulfillNote, setFulfillNote] = useState('')
  const urg = URGENCY[req.urgency] ?? URGENCY.normal

  // ── Review & forward to CEO ──────────────────
  const handleForwardToCEO = async () => {
    if (!supplier.trim()) return showToast('Add a supplier / store', 'error')
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('purchase_requests').update({
      status: 'queued',
      reviewed_by: supervisorId,
      reviewed_at: new Date().toISOString(),
      support_notes: `Supplier: ${supplier.trim()}${estCost ? ` · Est. ₱${estCost}` : ''}`,
    }).eq('id', req.id)
    if (error) showToast(error.message, 'error')
    else { showToast(`${req.pr_number} forwarded to CEO`); onAction() }
    setLoading(false)
  }

  // ── Return to staff ──────────────────────────
  const handleReturn = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason', 'error')
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('purchase_requests').update({
      status: 'rejected_by_support',
      reviewed_by: supervisorId,
      reviewed_at: new Date().toISOString(),
      support_notes: rejectReason.trim(),
    }).eq('id', req.id)
    if (error) showToast(error.message, 'error')
    else { showToast(`${req.pr_number} returned to staff`); onAction() }
    setLoading(false)
  }

  // ── Mark fulfilled ───────────────────────────
  const handleFulfill = async () => {
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('purchase_requests').update({
      status: 'purchased',
      purchased_at: new Date().toISOString(),
      supervisor_notes: fulfillNote.trim() || null,
    }).eq('id', req.id)
    if (error) showToast(error.message, 'error')
    else { showToast(`${req.pr_number} marked as fulfilled`); onAction() }
    setLoading(false)
  }

  return (
    <div style={{ background:'white', border:`1px solid ${req.status==='pending_supervisor'?'#86efac':'#e5e7eb'}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'monospace', color:'#9ca3af' }}>{req.pr_number}</span>
            <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:urg.bg, color:urg.color }}>{urg.label}</span>
            {req.status === 'pending_supervisor' && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'#dcfce7', color:'#166534' }}>✓ CEO Approved</span>}
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:'#111', margin:'3px 0 0' }}>{req.title}</p>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'2px 0 0' }}>
            {staffName(req.submitted_by_staff)}
            {req.items?.length > 0 && ` · ${req.items.length} item${req.items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <span style={{ color:'#9ca3af', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 16px' }}>
          {req.notes && <p style={{ fontSize:12, color:'#6b7280', fontStyle:'italic', background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>"{req.notes}"</p>}
          {req.supervisor_notes && req.status === 'pending_supervisor' && (
            <p style={{ fontSize:12, color:'#166534', background:'#dcfce7', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
              <strong>CEO note:</strong> {req.supervisor_notes}
            </p>
          )}

          {/* Items */}
          {req.items?.map(item => (
            <div key={item.id} style={{ background:'#f9fafb', borderRadius:8, padding:12, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'#1f2937', margin:0 }}>{item.item_name}</p>
                <p style={{ fontSize:11, color:'#6b7280', margin:'2px 0 0' }}>{item.quantity} {item.unit}{item.staff_notes ? ` · "${item.staff_notes}"` : ''}</p>
              </div>
              <span style={{ fontSize:11, color:'#6b7280', background:'#e5e7eb', padding:'2px 8px', borderRadius:20 }}>{item.category}</span>
            </div>
          ))}

          {/* Incoming: add supplier + cost, forward to CEO */}
          {req.status === 'submitted' && !showReject && (
            <div style={{ marginTop:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:8, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Supplier / store *</label>
                  <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. S&R Cubao"
                    style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Est. cost (₱)</label>
                  <input type="number" value={estCost} onChange={e => setEstCost(e.target.value)} placeholder="0"
                    style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setShowReject(true)} style={{ padding:'7px 14px', fontSize:12, border:'1px solid #fca5a5', borderRadius:8, background:'white', color:'#dc2626', cursor:'pointer' }}>✕ Return to staff</button>
                <button onClick={handleForwardToCEO} disabled={loading} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                  {loading ? 'Sending…' : '→ Forward to CEO'}
                </button>
              </div>
            </div>
          )}

          {/* CEO Approved: mark fulfilled */}
          {req.status === 'pending_supervisor' && !showFulfill && (
            <div style={{ marginTop:12, display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setShowFulfill(true)} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#16a34a', color:'white', cursor:'pointer' }}>
                ✓ Mark as fulfilled
              </button>
            </div>
          )}

          {showFulfill && (
            <div style={{ marginTop:12, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:12 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#166534', marginBottom:8 }}>Mark as fulfilled</p>
              <input type="text" value={fulfillNote} onChange={e => setFulfillNote(e.target.value)} placeholder="Optional note (e.g. purchased at S&R, now on hand)"
                style={{ width:'100%', border:'1px solid #86efac', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:10 }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setShowFulfill(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleFulfill} disabled={loading} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#16a34a', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                  {loading ? 'Saving…' : 'Confirm fulfilled'}
                </button>
              </div>
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div style={{ marginTop:12 }}>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for returning to staff…"
                style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={() => setShowReject(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleReturn} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#dc2626', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>Return to staff</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SupervisorQueuePage() {
  const [supervisorId, setSupervisorId] = useState(null)
  const [incoming, setIncoming]         = useState([])
  const [approved, setApproved]         = useState([])
  const [history, setHistory]           = useState([])
  const [loading, setLoading]           = useState(true)
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    const sb = createClient()
    try {
      const [inc, appr, hist] = await Promise.all([
        sb.from('purchase_requests')
          .select('*, items:purchase_request_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .eq('status', 'submitted')
          .order('created_at', { ascending: false }),
        sb.from('purchase_requests')
          .select('*, items:purchase_request_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .eq('status', 'pending_supervisor')
          .order('created_at', { ascending: false }),
        sb.from('purchase_requests')
          .select('*, items:purchase_request_items(*), submitted_by_staff:staff!submitted_by(id, first_name, last_name)')
          .in('status', ['purchased', 'rejected_by_support', 'rejected_by_supervisor'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      setIncoming(inc.data ?? [])
      setApproved(appr.data ?? [])
      setHistory(hist.data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      setSupervisorId(staff?.id ?? session.user.id)
      load()
    })
  }, [])

  const HIST_LABEL = {
    purchased:            { label:'Fulfilled',         bg:'#dcfce7', color:'#166534' },
    rejected_by_support:  { label:'Returned to staff', bg:'#fee2e2', color:'#991b1b' },
    rejected_by_supervisor:{ label:'Rejected by CEO',  bg:'#fee2e2', color:'#991b1b' },
  }

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Stock Requests</div>
          <div className="topbar-sub">Review running-low flags from staff, forward to CEO for approval</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ maxWidth:760 }}>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'Needs your review', value: incoming.length, color:'#d97706' },
              { label:'CEO approved — action needed', value: approved.length, color:'#16a34a' },
              { label:'Completed this month', value: history.filter(r => r.status === 'purchased').length, color:'#6b7280' },
            ].map(s => (
              <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
                <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
                <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* CEO Approved — needs fulfillment */}
          {approved.length > 0 && (
            <div style={{ marginBottom:32 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#16a34a', marginBottom:12 }}>
                ✓ CEO Approved — fulfill these
              </p>
              {approved.map(req => <RequestCard key={req.id} req={req} supervisorId={supervisorId} onAction={load} showToast={showToast} />)}
            </div>
          )}

          {/* Incoming from staff */}
          <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>
            Incoming from staff {incoming.length > 0 && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, marginLeft:8 }}>{incoming.length}</span>}
          </p>

          {loading ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:40 }}>Loading…</p>
            : incoming.length === 0
              ? <div style={{ textAlign:'center', padding:40, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}><p style={{ color:'#9ca3af', fontSize:13 }}>No new requests</p></div>
              : incoming.map(req => <RequestCard key={req.id} req={req} supervisorId={supervisorId} onAction={load} showToast={showToast} />)
          }

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop:32 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Recent history</p>
              {history.map(req => {
                const hl = HIST_LABEL[req.status] ?? { label: req.status, bg:'#f3f4f6', color:'#6b7280' }
                return (
                  <div key={req.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <span style={{ fontSize:11, fontFamily:'monospace', color:'#9ca3af' }}>{req.pr_number}</span>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:hl.bg, color:hl.color }}>{hl.label}</span>
                      </div>
                      <p style={{ fontSize:13, fontWeight:600, color:'#111', margin:0 }}>{req.title}</p>
                      <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>{staffName(req.submitted_by_staff)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
