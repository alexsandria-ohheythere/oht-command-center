'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Admin — Inventory / Support Review Queue
// Place at: app/inventory/support/page.js
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'
import {
  getSubmittedRequests, getQueuedRequests,
  supportQueueRequest, supportRejectRequest,
  createPurchaseList, sendListToSupervisor,
} from '../../../lib/inventory'

const URGENCY_DOT = { low: 'bg-gray-300', normal: 'bg-green-500', high: 'bg-red-500' }

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
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

  useEffect(() => {
    if (price && store) onChange(item.id, parseFloat(price), store)
  }, [price, store])

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      <div className="col-span-2">
        <input
          type="text" value={store} onChange={e => setStore(e.target.value)}
          placeholder="Store / supplier"
          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 py-1.5">₱</span>
        <input
          type="number" value={price} onChange={e => setPrice(e.target.value)}
          placeholder="0"
          className="flex-1 px-2 py-1.5 text-xs focus:outline-none w-full"
        />
      </div>
    </div>
  )
}

function RequestCard({ req, supportId, onAction, showToast }) {
  const [expanded, setExpanded] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [itemPrices, setItemPrices] = useState({})
  const [loading, setLoading] = useState(false)

  const handlePriceChange = (id, price, store) =>
    setItemPrices(prev => ({ ...prev, [id]: { price, store } }))

  const allPriced = req.items?.every(i => itemPrices[i.id]?.price && itemPrices[i.id]?.store)

  const handleQueue = async () => {
    if (!allPriced) return showToast('Add est. price and store for every item', 'error')
    setLoading(true)
    try {
      const items = req.items.map(i => ({
        id: i.id,
        est_unit_price: itemPrices[i.id].price,
        preferred_store: itemPrices[i.id].store,
      }))
      await supportQueueRequest(req.id, supportId, items)
      showToast(`${req.pr_number} added to purchase list`)
      onAction()
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Add a reason for returning', 'error')
    setLoading(true)
    try {
      await supportRejectRequest(req.id, supportId, rejectReason.trim())
      showToast(`${req.pr_number} returned to staff`)
      onAction()
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const estTotal = req.items?.reduce((sum, i) =>
    sum + (itemPrices[i.id]?.price ?? 0) * i.quantity, 0) ?? 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{req.pr_number}</span>
            {req.urgency === 'high' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Urgent</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{req.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${URGENCY_DOT[req.urgency]} mr-1 align-middle`} />
            {req.submitted_by_staff?.full_name ?? 'Staff'}
          </p>
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {req.notes && (
            <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">"{req.notes}"</p>
          )}
          <div className="space-y-3">
            {req.items?.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.item_name}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit}
                      {item.staff_notes && ` · "${item.staff_notes}"`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span>
                </div>
                <ItemPriceEditor item={item} onChange={handlePriceChange} />
              </div>
            ))}
          </div>

          {estTotal > 0 && (
            <p className="text-right text-sm font-medium text-gray-700">
              Est. total: ₱ {estTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          )}

          {showReject && (
            <div className="space-y-2">
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={2} placeholder="Reason for returning to staff…"
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReject(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={loading}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  Return to staff
                </button>
              </div>
            </div>
          )}

          {!showReject && (
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(true)}
                className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                ✕ Return to staff
              </button>
              <button onClick={handleQueue} disabled={loading || !allPriced}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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
  const [incoming, setIncoming] = useState([])
  const [queued, setQueued] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingList, setSendingList] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [showListForm, setShowListForm] = useState(false)
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    const [inc, q] = await Promise.all([getSubmittedRequests(), getQueuedRequests()])
    setIncoming(inc)
    setQueued(q)
    setLoading(false)
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setSupportId(data.user?.id ?? null)
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
      setListTitle('')
      setShowListForm(false)
      load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSendingList(false) }
  }

  const queuedEstTotal = queued.reduce((sum, req) =>
    sum + (req.items?.reduce((s, i) => s + (i.est_total ?? 0), 0) ?? 0), 0)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {toastEl}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Support review queue</h1>
        <p className="text-sm text-gray-500">Review staff requests, price them up, then send to CJ</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Needs review', value: incoming.length, color: 'text-amber-600' },
          { label: 'Queued for CJ', value: queued.length, color: 'text-indigo-600' },
          { label: 'Est. total', value: `₱ ${queuedEstTotal.toLocaleString('en-PH')}`, color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Incoming from staff
          {incoming.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{incoming.length}</span>
          )}
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : incoming.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No pending requests</p>
          </div>
        ) : (
          incoming.map(req => (
            <RequestCard key={req.id} req={req} supportId={supportId} onAction={load} showToast={showToast} />
          ))
        )}
      </div>

      {queued.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Purchase list — ready for CJ</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {['Item', 'Qty', 'Store', 'Requested by', 'Est. cost'].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-medium text-gray-500 ${h === 'Est. cost' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {queued.flatMap(req =>
                  req.items?.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{item.item_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.preferred_store ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{req.submitted_by_staff?.full_name ?? 'Staff'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {item.est_total != null ? `₱ ${item.est_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  )) ?? []
                )}
              </tbody>
              <tfoot className="border-t border-gray-100 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-medium text-gray-700">Total</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    ₱ {queuedEstTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!showListForm ? (
            <div className="flex justify-end">
              <button onClick={() => setShowListForm(true)}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Send to CJ for approval →
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Name this purchase run</p>
              <input type="text" value={listTitle} onChange={e => setListTitle(e.target.value)}
                placeholder="e.g. June 16 AM run"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowListForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSendToCJ} disabled={sendingList}
                  className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {sendingList ? 'Sending…' : 'Send to CJ'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
