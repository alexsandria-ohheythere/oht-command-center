// ─────────────────────────────────────────────
// OHT Inventory — Supabase queries
// Place at: lib/inventory.js  (same folder as lib/supabase.js)
// ─────────────────────────────────────────────
import { createClient } from './supabase'

const sb = () => createClient()

// ─── Catalog ─────────────────────────────────

export async function getCatalog() {
  const { data, error } = await sb()
    .from('inventory_catalog')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw error
  return data ?? []
}

// ─── Purchase Requests ────────────────────────

export async function getMyRequests(staffId) {
  const { data, error } = await sb()
    .from('purchase_requests')
    .select('*, items:purchase_request_items(*)')
    .eq('submitted_by', staffId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSubmittedRequests() {
  const { data, error } = await sb()
    .from('purchase_requests')
    .select('*, items:purchase_request_items(*), submitted_by_staff:staff!submitted_by(id, full_name)')
    .in('status', ['submitted', 'rejected_by_support'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getQueuedRequests() {
  const { data, error } = await sb()
    .from('purchase_requests')
    .select('*, items:purchase_request_items(*), submitted_by_staff:staff!submitted_by(id, full_name)')
    .eq('status', 'queued')
    .is('purchase_list_id', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createRequest(staffId, payload) {
  const { data: req, error: reqErr } = await sb()
    .from('purchase_requests')
    .insert({
      title: payload.title,
      submitted_by: staffId,
      urgency: payload.urgency,
      notes: payload.notes,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (reqErr) throw reqErr

  if (payload.items.length > 0) {
    const { error: itemErr } = await sb()
      .from('purchase_request_items')
      .insert(payload.items.map(i => ({ ...i, request_id: req.id })))
    if (itemErr) throw itemErr
  }

  await logActivity({
    entity_type: 'purchase_request', entity_id: req.id,
    actor_id: staffId, actor_role: 'staff',
    action: 'submitted', to_status: 'submitted',
  })

  return req
}

export async function supportRejectRequest(requestId, supportId, reason) {
  const { data: current } = await sb()
    .from('purchase_requests').select('status').eq('id', requestId).single()

  const { error } = await sb()
    .from('purchase_requests')
    .update({
      status: 'rejected_by_support',
      support_notes: reason,
      reviewed_by: supportId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  if (error) throw error

  await logActivity({
    entity_type: 'purchase_request', entity_id: requestId,
    actor_id: supportId, actor_role: 'support',
    action: 'rejected', from_status: current?.status,
    to_status: 'rejected_by_support', comment: reason,
  })
}

export async function supportQueueRequest(requestId, supportId, items) {
  const { data: current } = await sb()
    .from('purchase_requests').select('status').eq('id', requestId).single()

  for (const item of items) {
    await sb()
      .from('purchase_request_items')
      .update({ est_unit_price: item.est_unit_price, preferred_store: item.preferred_store })
      .eq('id', item.id)
  }

  const { error } = await sb()
    .from('purchase_requests')
    .update({ status: 'queued', reviewed_by: supportId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error

  await logActivity({
    entity_type: 'purchase_request', entity_id: requestId,
    actor_id: supportId, actor_role: 'support',
    action: 'queued', from_status: current?.status, to_status: 'queued',
  })
}

// ─── Purchase Lists ───────────────────────────

export async function getPurchaseLists(statuses) {
  let query = sb()
    .from('purchase_lists')
    .select('*, items:purchase_list_items(*)')
    .order('created_at', { ascending: false })
  if (statuses?.length) query = query.in('status', statuses)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createPurchaseList(supportId, title, requestIds) {
  const { data: list, error: listErr } = await sb()
    .from('purchase_lists')
    .insert({ title, created_by: supportId, status: 'draft' })
    .select().single()
  if (listErr) throw listErr

  const { data: reqItems, error: itemsErr } = await sb()
    .from('purchase_request_items')
    .select('*, purchase_requests!inner(submitted_by, staff!submitted_by(full_name))')
    .in('request_id', requestIds)
  if (itemsErr) throw itemsErr

  if (reqItems?.length > 0) {
    const listItems = reqItems.map(ri => ({
      list_id: list.id,
      request_item_id: ri.id,
      item_name: ri.item_name,
      category: ri.category,
      quantity: ri.quantity,
      unit: ri.unit,
      requested_by_name: ri.purchase_requests?.staff?.full_name ?? 'Staff',
      preferred_store: ri.preferred_store,
      est_unit_price: ri.est_unit_price,
    }))
    const { error: liErr } = await sb().from('purchase_list_items').insert(listItems)
    if (liErr) throw liErr
  }

  await sb().from('purchase_requests')
    .update({ purchase_list_id: list.id }).in('id', requestIds)

  await logActivity({
    entity_type: 'purchase_list', entity_id: list.id,
    actor_id: supportId, actor_role: 'support',
    action: 'created', to_status: 'draft',
  })

  return list
}

export async function sendListToSupervisor(listId, supportId) {
  const { data: items } = await sb()
    .from('purchase_list_items').select('est_total').eq('list_id', listId)

  const estTotal = (items ?? []).reduce((sum, i) => sum + (i.est_total ?? 0), 0)

  const { error } = await sb()
    .from('purchase_lists')
    .update({
      status: 'pending_supervisor',
      est_total: estTotal,
      sent_to_supervisor_at: new Date().toISOString(),
    })
    .eq('id', listId)
  if (error) throw error

  await sb().from('purchase_requests')
    .update({ status: 'pending_supervisor' }).eq('purchase_list_id', listId)

  await logActivity({
    entity_type: 'purchase_list', entity_id: listId,
    actor_id: supportId, actor_role: 'support',
    action: 'sent_to_supervisor', from_status: 'draft', to_status: 'pending_supervisor',
  })
}

export async function supervisorApproveList(listId, supervisorId, notes) {
  const now = new Date().toISOString()
  const { error } = await sb()
    .from('purchase_lists')
    .update({ status: 'approved', approved_by: supervisorId, approved_at: now, supervisor_notes: notes ?? null })
    .eq('id', listId)
  if (error) throw error

  await sb().from('purchase_requests')
    .update({ status: 'approved', approved_by: supervisorId, approved_at: now })
    .eq('purchase_list_id', listId)

  await logActivity({
    entity_type: 'purchase_list', entity_id: listId,
    actor_id: supervisorId, actor_role: 'supervisor',
    action: 'approved', from_status: 'pending_supervisor', to_status: 'approved', comment: notes,
  })
}

export async function supervisorRejectList(listId, supervisorId, reason) {
  const { error } = await sb()
    .from('purchase_lists')
    .update({ status: 'rejected', supervisor_notes: reason })
    .eq('id', listId)
  if (error) throw error

  await sb().from('purchase_requests')
    .update({ status: 'queued', purchase_list_id: null })
    .eq('purchase_list_id', listId)

  await logActivity({
    entity_type: 'purchase_list', entity_id: listId,
    actor_id: supervisorId, actor_role: 'supervisor',
    action: 'rejected', from_status: 'pending_supervisor', to_status: 'rejected', comment: reason,
  })
}

export async function markListPurchased(listId, supportId, actualTotal, receiptUrl) {
  const now = new Date().toISOString()
  const { error } = await sb()
    .from('purchase_lists')
    .update({ status: 'purchased', actual_total: actualTotal, receipt_url: receiptUrl ?? null, purchased_at: now })
    .eq('id', listId)
  if (error) throw error

  await sb().from('purchase_requests')
    .update({ status: 'purchased', purchased_at: now })
    .eq('purchase_list_id', listId)

  await logActivity({
    entity_type: 'purchase_list', entity_id: listId,
    actor_id: supportId, actor_role: 'support',
    action: 'purchased', from_status: 'approved', to_status: 'purchased',
  })
}

async function logActivity(entry) {
  await sb().from('inventory_activity_log').insert(entry)
}
