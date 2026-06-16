'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'
import {
  getSubmittedRequests, getQueuedRequests,
  supportQueueRequest, supportRejectRequest,
  createPurchaseList, sendListToSupervisor,
} from '../../../lib/inventory'

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, padding:'12px 18px', borderRadius:12, background: type==='error'?'#dc2626':'#111', color:'white', fontSize:13, fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
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

function ItemPriceEditor({ item, onChange }) {
  const [price, setPrice] = useState(item.est_unit_price?.toString() ?? '')
  const [store, setStore] = useState(item.preferred_store ?? '')
  useEffect(() => { if (price && store) onChange(item.id, parseFloat(price), store) }, [price, store])
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:8, marginTop:8 }}>
      <input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="Store / supplier"
        style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none' }} />
      <div style={{ display:'flex', border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
        <span style={{ padding:'6px 8px', background:'#f9fafb', fontSize:12, color:'#9ca3af', borderRight:'1px solid #e5e7eb' }}>₱</span>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
          style={{ flex:1, border:'none', padding:'6px 8px', fontSize:12, outline:'none', width:'100%' }} />
      </div>
    </div>
  )
}

function staffName(s) {
  if (!s) return 'Staff'
  if (s.full_name) return s.full_name
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff'
}

function RequestCard({ req, supportId, onAction, showToast }) {
  const [expanded, setExpanded] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [itemPrices, setItemPrices] = useState({})
  const [loading, setLoading] = useState(false)

  const handlePriceChange = (id, price, store) => setItemPrices(prev => ({ ...prev, [id]: { price, store } }))
  const allPriced = req.items?.every(i => itemPrices[i.id]?.price && itemPrices[i.id]?.store)

  const handleQueue = async () => {
    if (!allPriced) return showToast('Add est. price and store for every item', 'error')
    setLoading(true)
    try {
      await supportQueueRequest(req.id, supportId, req.items.map(i => ({ id: i.id, est_unit_price: itemPrices[i.id].price, preferred_store: itemPrices[i.id].store })))
      showToast(`${req.pr_number} added to purchase list`)
      onAction()
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason', 'error')
    setLoading(true)
    try {
      await supportRejectRequest(req.id, supportId, rejectReason.trim())
      showToast(`${req.pr_number} returned to staff`)
      onAction()
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const estTotal = req.items?.reduce((sum, i) => sum + (itemPrices[i.id]?.price ?? 0) * i.quantity, 0) ?? 0

  return (
    <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontFamily:'monospace', color:'#9ca3af' }}>{req.pr_number}</span>
            {req.urgency === 'high' && <span style={{ padding:'2px 8px', background:'#fee2e2', color:'#b91c1c', fontSize:11, borderRadius:20, fontWeight:600 }}>Urgent</span>}
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:'#111', margin:'3px 0 0' }}>{req.title}</p>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'2px 0 0' }}>{staffName(req.submitted_by_staff)}</p>
        </div>
        <span style={{ color:'#9ca3af', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 16px' }}>
          {req.notes && <p style={{ fontSize:12, color:'#6b7280', fontStyle:'italic', background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>"{req.notes}"</p>}

          {req.items?.map(item => (
            <div key={item.id} style={{ background:'#f9fafb', borderRadius:8, padding:12, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:'#1f2937', margin:0 }}>{item.item_name}</p>
                  <p style={{ fontSize:11, color:'#6b7280', margin:'2px 0 0' }}>{item.quantity} {item.unit}{item.staff_notes && ` · "${item.staff_notes}"`}</p>
                </div>
                <span style={{ fontSize:11, color:'#6b7280', background:'#e5e7eb', padding:'2px 8px', borderRadius:20 }}>{item.category}</span>
              </div>
              <ItemPriceEditor item={item} onChange={handlePriceChange} />
            </div>
          ))}

          {estTotal > 0 && <p style={{ textAlign:'right', fontSize:13, fontWeight:600, color:'#374151', margin:'8px 0' }}>Est. total: ₱ {estTotal.toLocaleString('en-PH', { minimumFractionDigits:2 })}</p>}

          {showReject && (
            <div style={{ marginTop:8 }}>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for returning to staff…"
                style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={() => setShowReject(false)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleReject} disabled={loading} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#dc2626', color:'white', cursor:'pointer', opacity:loading?0.5:1 }}>Return to staff</button>
              </div>
            </div>
          )}

          {!showReject && (
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={() => setShowReject(true)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #fca5a5', borderRadius:8, background:'white', color:'#dc2626', cursor:'pointer' }}>✕ Return to staff</button>
              <button onClick={handleQueue} disabled={loading || !allPriced} style={{ padding:'6px 14px', fontSize:12, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity:(loading||!allPriced)?0.5:1 }}>
                {loading ? 'Saving…' : '✓ Add to purchase list'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SupportQueuePage() {
  const [supportId, setSupportId] = useState(null)
  const [incoming, setIncoming]   = useState([])
  const [queued, setQueued]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [sendingList, setSendingList] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [showListForm, setShowListForm] = useState(false)
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    try {
      const [inc, q] = await Promise.all([getSubmittedRequests(), getQueuedRequests()])
      setIncoming(inc)
      setQueued(q)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      // Look up staff row by email to get the correct staff.id
      const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      setSupportId(staff?.id ?? session.user.id)
      load()
    })
  }, [])

  const handleSendToCJ = async () => {
    if (!listTitle.trim()) return showToast('Give the purchase list a title', 'error')
    if (queued.length === 0) return showToast('No items queued yet', 'error')
    setSendingList(true)
    try {
      const list = await createPurchaseList(supportId, listTitle.trim(), queued.map(r => r.id))
      await sendListToSupervisor(list.id, supportId)
      showToast(`"${listTitle}" sent to CJ`)
      setListTitle(''); setShowListForm(false); load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSendingList(false) }
  }

  const queuedEstTotal = queued.reduce((sum, req) => sum + (req.items?.reduce((s, i) => s + (i.est_total ?? 0), 0) ?? 0), 0)

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Purchase Queue</div>
          <div className="topbar-sub">Review staff requests, price them up, then send to CJ</div>
        </div>
      </div>

      <div style={{ padding:'24px', maxWidth:760 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Needs review',  value: incoming.length, color:'#d97706' },
            { label:'Queued for CJ', value: queued.length,   color:'#EF4576' },
            { label:'Est. total',    value:`₱ ${queuedEstTotal.toLocaleString('en-PH')}`, color:'#111' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
              <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
              <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>
          Incoming from staff {incoming.length > 0 && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, marginLeft:8 }}>{incoming.length}</span>}
        </p>

        {loading
          ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:40 }}>Loading…</p>
          : incoming.length === 0
            ? <div style={{ textAlign:'center', padding:40, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}><p style={{ color:'#9ca3af', fontSize:13 }}>No pending requests</p></div>
            : incoming.map(req => <RequestCard key={req.id} req={req} supportId={supportId} onAction={load} showToast={showToast} />)
        }

        {queued.length > 0 && (
          <div style={{ marginTop:32 }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:12 }}>Purchase list — ready for CJ</p>
            <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead style={{ background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                  <tr>{['Item','Qty','Store','Requested by','Est. cost'].map(h => <th key={h} style={{ textAlign:h==='Est. cost'?'right':'left', padding:'10px 14px', fontSize:11, fontWeight:600, color:'#6b7280' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {queued.flatMap(req => req.items?.map(item => (
                    <tr key={item.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:'#1f2937' }}>{item.item_name}</td>
                      <td style={{ padding:'10px 14px', color:'#6b7280' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding:'10px 14px', color:'#6b7280' }}>{item.preferred_store ?? '—'}</td>
                      <td style={{ padding:'10px 14px', color:'#9ca3af', fontSize:11 }}>{staffName(req.submitted_by_staff)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:'#374151' }}>{item.est_total != null ? `₱ ${item.est_total.toLocaleString('en-PH',{minimumFractionDigits:2})}` : '—'}</td>
                    </tr>
                  )) ?? [])}
                </tbody>
                <tfoot style={{ borderTop:'1px solid #e5e7eb', background:'#f9fafb' }}>
                  <tr>
                    <td colSpan={4} style={{ padding:'10px 14px', fontWeight:600, color:'#374151' }}>Total</td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'#111' }}>₱ {queuedEstTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!showListForm
              ? <div style={{ textAlign:'right' }}>
                  <button onClick={() => setShowListForm(true)} style={{ padding:'10px 20px', fontSize:13, fontWeight:600, background:'#16a34a', color:'white', border:'none', borderRadius:10, cursor:'pointer' }}>Send to CJ for approval →</button>
                </div>
              : <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Name this purchase run</p>
                  <input type="text" value={listTitle} onChange={e => setListTitle(e.target.value)} placeholder="e.g. June 16 AM run"
                    style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:12 }} />
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button onClick={() => setShowListForm(false)} style={{ padding:'8px 16px', fontSize:13, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                    <button onClick={handleSendToCJ} disabled={sendingList} style={{ padding:'8px 16px', fontSize:13, fontWeight:600, background:'#16a34a', color:'white', border:'none', borderRadius:8, cursor:'pointer', opacity:sendingList?0.5:1 }}>
                      {sendingList ? 'Sending…' : 'Send to CJ'}
                    </button>
                  </div>
                </div>
            }
          </div>
        )}
      </div>
    </AuthShell>
  )
}
