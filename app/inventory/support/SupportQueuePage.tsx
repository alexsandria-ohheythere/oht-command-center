'use client'
// ─────────────────────────────────────────────
// OHT Admin — Inventory / Support Review Queue
// app/inventory/support/page.tsx
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  getSubmittedRequests, getQueuedRequests,
  supportQueueRequest, supportRejectRequest,
  createPurchaseList, sendListToSupervisor,
} from '@/lib/inventory'
import type { PurchaseRequest, PurchaseRequestItem } from '@/types/inventory'
import {
  CheckCircleIcon, XCircleIcon, QueueListIcon,
  PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

const URGENCY_COLOR = { low: 'text-gray-400', normal: 'text-green-600', high: 'text-red-600' }
const URGENCY_DOT   = { low: 'bg-gray-300',   normal: 'bg-green-500',   high: 'bg-red-500' }

// ─── Item price editor ────────────────────────
function ItemPriceEditor({
  item,
  onChange,
}: {
  item: PurchaseRequestItem
  onChange: (id: string, price: number, store: string) => void
}) {
  const [price, setPrice] = useState(item.est_unit_price?.toString() ?? '')
  const [store, setStore] = useState(item.preferred_store ?? '')

  useEffect(() => {
    if (price && store) onChange(item.id, parseFloat(price), store)
  }, [price, store])

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      <div className="col-span-2">
        <input
          type="text"
          value={store}
          onChange={e => setStore(e.target.value)}
          placeholder="Store / supplier"
          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
      <div>
        <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
          <span className="px-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 py-1.5">₱</span>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0"
            className="flex-1 px-2 py-1.5 text-xs focus:outline-none w-full"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Single request card ──────────────────────
function RequestCard({
  req,
  supportId,
  onAction,
}: {
  req: PurchaseRequest
  supportId: string
  onAction: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [itemPrices, setItemPrices] = useState<Record<string, { price: number; store: string }>>({})
  const [loading, setLoading] = useState(false)

  const handlePriceChange = (id: string, price: number, store: string) => {
    setItemPrices(prev => ({ ...prev, [id]: { price, store } }))
  }

  const allPriced = req.items?.every(i => itemPrices[i.id]?.price && itemPrices[i.id]?.store)

  const handleQueue = async () => {
    if (!allPriced) return toast.error('Add est. price and store for every item')
    setLoading(true)
    try {
      const items = req.items!.map(i => ({
        id: i.id,
        est_unit_price: itemPrices[i.id].price,
        preferred_store: itemPrices[i.id].store,
      }))
      await supportQueueRequest(req.id, supportId, items)
      toast.success(`${req.pr_number} added to purchase list`)
      onAction()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error('Add a reason for returning')
    setLoading(true)
    try {
      await supportRejectRequest(req.id, supportId, rejectReason.trim())
      toast.success(`${req.pr_number} returned to staff`)
      onAction()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const estTotal = req.items?.reduce((sum, i) => {
    const p = itemPrices[i.id]?.price ?? 0
    return sum + p * i.quantity
  }, 0) ?? 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{req.pr_number}</span>
            {req.urgency === 'high' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                Urgent
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{req.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${URGENCY_DOT[req.urgency]} mr-1 align-middle`} />
            {(req as any).submitted_by_staff?.full_name ?? 'Staff'} ·{' '}
            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
          </p>
        </div>
        {expanded
          ? <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Staff notes */}
          {req.notes && (
            <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">
              "{req.notes}"
            </p>
          )}

          {/* Items */}
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
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </div>
                <ItemPriceEditor item={item} onChange={handlePriceChange} />
              </div>
            ))}
          </div>

          {/* Est total */}
          {estTotal > 0 && (
            <p className="text-right text-sm font-medium text-gray-700">
              Est. total: ₱ {estTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          )}

          {/* Reject form */}
          {showReject && (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={2}
                placeholder="Reason for returning to staff…"
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowReject(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Return to staff
                </button>
              </div>
            </div>
          )}

          {/* Action row */}
          {!showReject && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReject(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                <XCircleIcon className="w-4 h-4" /> Return to staff
              </button>
              <button
                onClick={handleQueue}
                disabled={loading || !allPriced}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {loading ? 'Saving…' : 'Add to purchase list'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────
export default function SupportQueuePage() {
  const supabase = createClientComponentClient()
  const [supportId, setSupportId] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<PurchaseRequest[]>([])
  const [queued, setQueued] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingList, setSendingList] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [showListForm, setShowListForm] = useState(false)

  const load = useCallback(async () => {
    const [inc, q] = await Promise.all([getSubmittedRequests(), getQueuedRequests()])
    setIncoming(inc)
    setQueued(q)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSupportId(data.user?.id ?? null)
      load()
    })
  }, [])

  const handleSendToCJ = async () => {
    if (!supportId) return
    if (!listTitle.trim()) return toast.error('Give the purchase list a title')
    if (queued.length === 0) return toast.error('No items queued yet')
    setSendingList(true)
    try {
      const list = await createPurchaseList(supportId, listTitle.trim(), queued.map(r => r.id))
      await sendListToSupervisor(list.id, supportId)
      toast.success(`Purchase list "${listTitle}" sent to CJ`)
      setListTitle('')
      setShowListForm(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSendingList(false)
    }
  }

  const queuedEstTotal = queued.reduce((sum, req) =>
    sum + (req.items?.reduce((s, i) => s + (i.est_total ?? 0), 0) ?? 0), 0
  )

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Support review queue</h1>
        <p className="text-sm text-gray-500">Review staff requests, price them up, then send to CJ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Needs review', value: incoming.length, color: 'text-amber-600' },
          { label: 'Queued for CJ', value: queued.length, color: 'text-indigo-600' },
          { label: 'Est. total', value: `₱ ${queuedEstTotal.toLocaleString('en-PH')}`, color: 'text-gray-900' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Incoming requests */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <QueueListIcon className="w-4 h-4" /> Incoming from staff
          {incoming.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {incoming.length}
            </span>
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
            <RequestCard
              key={req.id}
              req={req}
              supportId={supportId!}
              onAction={load}
            />
          ))
        )}
      </div>

      {/* Queued items — ready to send CJ */}
      {queued.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Purchase list — ready for CJ
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Store</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Requested by</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {queued.flatMap(req =>
                  req.items?.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{item.item_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.preferred_store ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {(req as any).submitted_by_staff?.full_name ?? 'Staff'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {item.est_total != null
                          ? `₱ ${item.est_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                    </tr>
                  )) ?? []
                )}
              </tbody>
              <tfoot className="border-t border-gray-100 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-medium text-gray-700">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    ₱ {queuedEstTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Send to CJ */}
          {!showListForm ? (
            <div className="flex justify-end">
              <button
                onClick={() => setShowListForm(true)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <PaperAirplaneIcon className="w-4 h-4" /> Send to CJ for approval
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Name this purchase run</p>
              <input
                type="text"
                value={listTitle}
                onChange={e => setListTitle(e.target.value)}
                placeholder="e.g. June 16 AM run"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowListForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToCJ}
                  disabled={sendingList}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
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
