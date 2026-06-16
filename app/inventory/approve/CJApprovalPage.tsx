'use client'
// ─────────────────────────────────────────────
// OHT Admin — Inventory / CJ Approval View
// app/inventory/approve/page.tsx
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  getPurchaseLists,
  supervisorApproveList,
  supervisorRejectList,
  markListPurchased,
} from '@/lib/inventory'
import type { PurchaseList } from '@/types/inventory'
import {
  CheckCircleIcon, XCircleIcon, ShoppingCartIcon,
  ChevronDownIcon, ChevronUpIcon, ReceiptRefundIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

const LIST_STATUS_STYLE: Record<string, string> = {
  pending_supervisor: 'bg-amber-100 text-amber-700',
  approved:           'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
  purchased:          'bg-teal-100 text-teal-700',
  closed:             'bg-gray-100 text-gray-600',
}
const LIST_STATUS_LABEL: Record<string, string> = {
  pending_supervisor: 'Awaiting approval',
  approved:           'Approved',
  rejected:           'Returned to support',
  purchased:          'Purchased',
  closed:             'Closed',
}

// ─── Purchase list card ───────────────────────
function PurchaseListCard({
  list,
  supervisorId,
  onAction,
}: {
  list: PurchaseList
  supervisorId: string
  onAction: () => void
}) {
  const [expanded, setExpanded] = useState(list.status === 'pending_supervisor')
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showPurchased, setShowPurchased] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actualTotal, setActualTotal] = useState('')
  const [notes, setNotes] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    try {
      await supervisorApproveList(list.id, supervisorId, notes || undefined)
      toast.success(`${list.list_number} approved — support dispatched`)
      onAction()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error('Add a reason')
    setLoading(true)
    try {
      await supervisorRejectList(list.id, supervisorId, rejectReason.trim())
      toast.success(`${list.list_number} returned to support`)
      onAction()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPurchased = async () => {
    if (!actualTotal) return toast.error('Enter the actual total spent')
    setLoading(true)
    try {
      await markListPurchased(list.id, supervisorId, parseFloat(actualTotal))
      toast.success(`${list.list_number} marked as purchased`)
      onAction()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const variance = list.actual_total != null && list.est_total != null
    ? ((list.actual_total - list.est_total) / list.est_total) * 100
    : null

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${
      list.status === 'pending_supervisor' ? 'border-amber-300 shadow-sm' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{list.list_number}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${LIST_STATUS_STYLE[list.status]}`}>
              {LIST_STATUS_LABEL[list.status]}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{list.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {list.sent_to_supervisor_at
              ? formatDistanceToNow(new Date(list.sent_to_supervisor_at), { addSuffix: true })
              : format(new Date(list.created_at), 'MMM d, h:mm a')}
            {' · '}
            {list.items?.length ?? 0} items
            {list.est_total != null && (
              <> · Est. ₱ {list.est_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</>
            )}
          </p>
        </div>
        {expanded
          ? <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 space-y-4 p-4">

          {/* Supervisor's own notes from before */}
          {list.supervisor_notes && (
            <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500 italic">
              "{list.supervisor_notes}"
            </div>
          )}

          {/* Line items table */}
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Item</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Qty</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Store</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Requested by</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.items?.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{item.item_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{item.quantity} {item.unit}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{item.preferred_store ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{item.requested_by_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {item.est_total != null
                        ? `₱ ${item.est_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {list.est_total != null && (
                <tfoot className="border-t border-gray-100 bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">
                      ₱ {list.est_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Actual vs est (for purchased) */}
          {list.status === 'purchased' && list.actual_total != null && (
            <div className="flex items-center justify-between bg-teal-50 rounded-lg px-4 py-3">
              <span className="text-sm text-teal-800">
                Actual spent: <strong>₱ {list.actual_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
              </span>
              {variance != null && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  Math.abs(variance) < 5
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(1)}% vs estimate
                </span>
              )}
            </div>
          )}

          {/* Optional notes for approval */}
          {list.status === 'pending_supervisor' && !showReject && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Note for support (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any changes or reminders before they go..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={2}
                placeholder="Reason for returning to support…"
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
                  Return to support
                </button>
              </div>
            </div>
          )}

          {/* Mark purchased form */}
          {showPurchased && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-teal-800">Mark as purchased</p>
              <div className="flex items-center border border-teal-300 rounded-lg overflow-hidden bg-white">
                <span className="px-3 text-sm text-gray-500 bg-gray-50 border-r border-teal-200 py-2">₱</span>
                <input
                  type="number"
                  value={actualTotal}
                  onChange={e => setActualTotal(e.target.value)}
                  placeholder="Actual total spent"
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowPurchased(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkPurchased}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Confirm purchased'}
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showReject && !showPurchased && (
            <div className="flex justify-end gap-2">
              {list.status === 'pending_supervisor' && (
                <>
                  <button
                    onClick={() => setShowReject(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <XCircleIcon className="w-4 h-4" /> Return to support
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    {loading ? 'Approving…' : 'Approve — dispatch support'}
                  </button>
                </>
              )}
              {list.status === 'approved' && (
                <button
                  onClick={() => setShowPurchased(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
                >
                  <ShoppingCartIcon className="w-4 h-4" /> Mark as purchased
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────
export default function CJApprovalPage() {
  const supabase = createClientComponentClient()
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [pending, setPending]   = useState<PurchaseList[]>([])
  const [approved, setApproved] = useState<PurchaseList[]>([])
  const [history, setHistory]   = useState<PurchaseList[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    const [pend, appr, hist] = await Promise.all([
      getPurchaseLists(['pending_supervisor']),
      getPurchaseLists(['approved']),
      getPurchaseLists(['purchased', 'closed']),
    ])
    setPending(pend)
    setApproved(appr)
    setHistory(hist)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSupervisorId(data.user?.id ?? null)
      load()
    })
  }, [])

  const totalPendingValue = pending.reduce((s, l) => s + (l.est_total ?? 0), 0)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Purchase approvals</h1>
        <p className="text-sm text-gray-500">Review consolidated purchase lists from ops support</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending your approval', value: pending.length, color: 'text-amber-600' },
          { label: 'Approved — on errand', value: approved.length, color: 'text-green-600' },
          { label: 'Pending value', value: `₱ ${totalPendingValue.toLocaleString('en-PH')}`, color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-12">Loading…</p>
      ) : (
        <>
          {/* Pending approval */}
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                Awaiting your approval
              </h2>
              {pending.map(list => (
                <PurchaseListCard
                  key={list.id}
                  list={list}
                  supervisorId={supervisorId!}
                  onAction={load}
                />
              ))}
            </section>
          )}

          {/* Approved / on errand */}
          {approved.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                Approved — support on errand
              </h2>
              {approved.map(list => (
                <PurchaseListCard
                  key={list.id}
                  list={list}
                  supervisorId={supervisorId!}
                  onAction={load}
                />
              ))}
            </section>
          )}

          {/* History */}
          {history.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                Recent history
              </h2>
              {history.map(list => (
                <PurchaseListCard
                  key={list.id}
                  list={list}
                  supervisorId={supervisorId!}
                  onAction={load}
                />
              ))}
            </section>
          )}

          {pending.length === 0 && approved.length === 0 && history.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <ReceiptRefundIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No purchase lists yet</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
