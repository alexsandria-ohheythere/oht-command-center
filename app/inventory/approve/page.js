'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'
import { getPurchaseLists, supervisorApproveList, supervisorRejectList, markListPurchased } from '../../../lib/inventory'

const LIST_STATUS_STYLE = {
  pending_supervisor: { bg:'#fef3c7', color:'#92400e' },
  approved:           { bg:'#dcfce7', color:'#166534' },
  rejected:           { bg:'#fee2e2', color:'#991b1b' },
  purchased:          { bg:'#ccfbf1', color:'#065f46' },
  closed:             { bg:'#f3f4f6', color:'#4b5563' },
}
const LIST_STATUS_LABEL = {
  pending_supervisor: 'Awaiting approval',
  approved:           'Approved',
  rejected:           'Returned to support',
  purchased:          'Purchased',
  closed:             'Closed',
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
  const hide = () => setToast(null)
  const el = toast ? <Toast msg={toast.msg} type={toast.type} onClose={hide} /> : null
  return { show, el }
}

function PurchaseListCard({ list, supervisorId, onAction, showToast }) {
  const [expanded, setExpanded] = useState(list.status === 'pending_supervisor')
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showPurchased, setShowPurchased] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actualTotal, setActualTotal] = useState('')
  const [notes, setNotes] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    try { await supervisorApproveList(list.id, supervisorId, notes || undefined); showToast(`${list.list_number} approved — support dispatched`); onAction() }
    catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason', 'error')
    setLoading(true)
    try { await supervisorRejectList(list.id, supervisorId, rejectReason.trim()); showToast(`${list.list_number} returned to support`); onAction() }
    catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const handleMarkPurchased = async () => {
    if (!actualTotal) return showToast('Enter the actual total spent', 'error')
    setLoading(true)
    try { await markListPurchased(list.id, supervisorId, parseFloat(actualTotal)); showToast(`${list.list_number} marked as purchased`); onAction() }
    catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const variance = list.actual_total != null && list.est_total != null
    ? ((list.actual_total - list.est_total) / list.est_total) * 100 : null

  const st = LIST_STATUS_STYLE[list.status] ?? LIST_STATUS_STYLE.closed

  return (
    <div style={{ background:'white', border: list.status==='pending_supervisor' ? '1px solid #fbbf24' : '1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'monospace', color:'#9ca3af' }}>{list.list_number}</span>
            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>{LIST_STATUS_LABEL[list.status]}</span>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:'#111', margin:'3px 0 0' }}>{list.title}</p>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'2px 0 0' }}>
            {list.items?.length ?? 0} items
            {list.est_total != null && ` · Est. ₱ ${list.est_total.toLocaleString('en-PH',{minimumFractionDigits:2})}`}
          </p>
        </div>
        <span style={{ color:'#9ca3af', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 16px' }}>
          {list.supervisor_notes && <p style={{ fontSize:12, color:'#6b7280', fontStyle:'italic', background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>"{list.supervisor_notes}"</p>}

          <div style={{ border:'1px solid #f3f4f6', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead style={{ background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                <tr>{['Item','Qty','Store','Requested by','Est.'].map(h => <th key={h} style={{ textAlign:h==='Est.'?'right':'left', padding:'8px 12px', fontSize:11, fontWeight:600, color:'#6b7280' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.items?.map(item => (
                  <tr key={item.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                    <td style={{ padding:'8px 12px', fontWeight:600, color:'#1f2937' }}>{item.item_name}</td>
                    <td style={{ padding:'8px 12px', color:'#6b7280' }}>{item.quantity} {item.unit}</td>
                    <td style={{ padding:'8px 12px', color:'#6b7280', fontSize:11 }}>{item.preferred_store ?? '—'}</td>
                    <td style={{ padding:'8px 12px', color:'#9ca3af', fontSize:11 }}>{item.requested_by_name ?? '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#374151' }}>{item.est_total != null ? `₱ ${item.est_total.toLocaleString('en-PH',{minimumFractionDigits:2})}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {list.est_total != null && (
                <tfoot style={{ borderTop:'1px solid #e5e7eb', background:'#f9fafb' }}>
                  <tr>
                    <td colSpan={4} style={{ padding:'8px 12px', fontWeight:600, color:'#374151' }}>Total</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700 }}>₱ {list.est_total.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {list.status === 'purchased' && list.actual_total != null && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
              <span style={{ fontSize:13, color:'#166534' }}>Actual spent: <strong>₱ {list.actual_total.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></span>
              {variance != null && <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background: Math.abs(variance)<5?'#dcfce7':'#fef3c7', color: Math.abs(variance)<5?'#166534':'#92400e' }}>{variance>0?'+':''}{variance.toFixed(1)}% vs estimate</span>}
            </div>
          )}

          {list.status === 'pending_supervisor' && !showReject && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'#6b7280' }}>Note for support (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any reminders before they go..."
                style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box', marginTop:4 }} />
            </div>
          )}

          {showReject && (
            <div style={{ marginBottom:12 }}>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for returning to support…"
                style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={() => setShowReject(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleReject} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#dc2626', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>Return to support</button>
              </div>
            </div>
          )}

          {showPurchased && (
            <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:12, marginBottom:12 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#166534', marginBottom:8 }}>Mark as purchased</p>
              <div style={{ display:'flex', border:'1px solid #86efac', borderRadius:8, overflow:'hidden', background:'white' }}>
                <span style={{ padding:'8px 12px', background:'#f9fafb', fontSize:13, color:'#6b7280', borderRight:'1px solid #86efac' }}>₱</span>
                <input type="number" value={actualTotal} onChange={e => setActualTotal(e.target.value)} placeholder="Actual total spent"
                  style={{ flex:1, border:'none', padding:'8px 12px', fontSize:13, outline:'none' }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={() => setShowPurchased(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleMarkPurchased} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#16a34a', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                  {loading ? 'Saving…' : 'Confirm purchased'}
                </button>
              </div>
            </div>
          )}

          {!showReject && !showPurchased && (
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              {list.status === 'pending_supervisor' && (
                <>
                  <button onClick={() => setShowReject(true)} style={{ padding:'7px 14px', fontSize:12, border:'1px solid #fca5a5', borderRadius:8, background:'white', color:'#dc2626', cursor:'pointer' }}>✕ Return to support</button>
                  <button onClick={handleApprove} disabled={loading} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#16a34a', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>
                    {loading ? 'Approving…' : '✓ Approve — dispatch support'}
                  </button>
                </>
              )}
              {list.status === 'approved' && (
                <button onClick={() => setShowPurchased(true)} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#0d9488', color:'white', cursor:'pointer' }}>
                  Mark as purchased
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CJApprovalPage() {
  const [supervisorId, setSupervisorId] = useState(null)
  const [pending, setPending]   = useState([])
  const [approved, setApproved] = useState([])
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    try {
      const [pend, appr, hist] = await Promise.all([
        getPurchaseLists(['pending_supervisor']),
        getPurchaseLists(['approved']),
        getPurchaseLists(['purchased', 'closed']),
      ])
      setPending(pend); setApproved(appr); setHistory(hist)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => { setSupervisorId(data.user?.id ?? null); load() })
  }, [])

  const totalPendingValue = pending.reduce((s, l) => s + (l.est_total ?? 0), 0)

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Purchase Approvals</div>
          <div className="topbar-sub">Review consolidated purchase lists from ops support</div>
        </div>
      </div>

      <div style={{ padding:'24px', maxWidth:760 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Pending your approval', value: pending.length, color:'#d97706' },
            { label:'Approved — on errand', value: approved.length, color:'#16a34a' },
            { label:'Pending value', value:`₱ ${totalPendingValue.toLocaleString('en-PH')}`, color:'#111' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
              <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
              <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {loading ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:40 }}>Loading…</p> : (
          <>
            {pending.length > 0 && (
              <div style={{ marginBottom:32 }}>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Awaiting your approval</p>
                {pending.map(list => <PurchaseListCard key={list.id} list={list} supervisorId={supervisorId} onAction={load} showToast={showToast} />)}
              </div>
            )}
            {approved.length > 0 && (
              <div style={{ marginBottom:32 }}>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Approved — support on errand</p>
                {approved.map(list => <PurchaseListCard key={list.id} list={list} supervisorId={supervisorId} onAction={load} showToast={showToast} />)}
              </div>
            )}
            {history.length > 0 && (
              <div>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Recent history</p>
                {history.map(list => <PurchaseListCard key={list.id} list={list} supervisorId={supervisorId} onAction={load} showToast={showToast} />)}
              </div>
            )}
            {pending.length === 0 && approved.length === 0 && history.length === 0 && (
              <div style={{ textAlign:'center', padding:60, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}>
                <p style={{ color:'#9ca3af', fontSize:13 }}>No purchase lists yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </AuthShell>
  )
}
