// ─────────────────────────────────────────────
// OHT Inventory Module — Types
// ─────────────────────────────────────────────

export type ItemCategory =
  | 'Dairy' | 'Coffee' | 'Packaging'
  | 'Cleaning' | 'Food' | 'Beverage'
  | 'Equipment' | 'Other'

export type Urgency = 'low' | 'normal' | 'high'

export type PurchaseRequestStatus =
  | 'draft'
  | 'submitted'
  | 'queued'
  | 'rejected_by_support'
  | 'pending_supervisor'
  | 'approved'
  | 'rejected_by_supervisor'
  | 'purchased'
  | 'done'

export type PurchaseListStatus =
  | 'draft'
  | 'pending_supervisor'
  | 'approved'
  | 'rejected'
  | 'purchased'
  | 'closed'

// ─── Catalog ─────────────────────────────────

export interface CatalogItem {
  id: string
  name: string
  sku: string | null
  category: ItemCategory
  unit: string
  avg_price: number | null
  preferred_store: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Purchase Request ─────────────────────────

export interface PurchaseRequestItem {
  id: string
  request_id: string
  catalog_item_id: string | null
  item_name: string
  category: ItemCategory | null
  quantity: number
  unit: string
  staff_notes: string | null
  est_unit_price: number | null
  est_total: number | null
  preferred_store: string | null
  actual_unit_price: number | null
  actual_total: number | null
  created_at: string
}

export interface PurchaseRequest {
  id: string
  pr_number: string
  title: string
  submitted_by: string | null
  urgency: Urgency
  notes: string | null
  status: PurchaseRequestStatus
  support_notes: string | null
  supervisor_notes: string | null
  reviewed_by: string | null
  approved_by: string | null
  purchase_list_id: string | null
  submitted_at: string | null
  reviewed_at: string | null
  approved_at: string | null
  purchased_at: string | null
  created_at: string
  updated_at: string
  // joined
  items?: PurchaseRequestItem[]
  submitted_by_staff?: { id: string; full_name: string }
}

// ─── Purchase List ────────────────────────────

export interface PurchaseListItem {
  id: string
  list_id: string
  request_item_id: string | null
  item_name: string
  category: ItemCategory | null
  quantity: number
  unit: string
  requested_by_name: string | null
  preferred_store: string | null
  est_unit_price: number | null
  est_total: number | null
  actual_unit_price: number | null
  actual_total: number | null
  created_at: string
}

export interface PurchaseList {
  id: string
  list_number: string
  title: string
  created_by: string | null
  status: PurchaseListStatus
  supervisor_notes: string | null
  approved_by: string | null
  est_total: number | null
  actual_total: number | null
  receipt_url: string | null
  sent_to_supervisor_at: string | null
  approved_at: string | null
  purchased_at: string | null
  created_at: string
  updated_at: string
  // joined
  items?: PurchaseListItem[]
  requests?: PurchaseRequest[]
}

// ─── Activity Log ─────────────────────────────

export interface InventoryActivityLog {
  id: string
  entity_type: 'purchase_request' | 'purchase_list'
  entity_id: string
  actor_id: string | null
  actor_role: string | null
  action: string
  from_status: string | null
  to_status: string | null
  comment: string | null
  created_at: string
}

// ─── Form payloads ────────────────────────────

export interface NewRequestPayload {
  title: string
  urgency: Urgency
  notes: string
  items: {
    catalog_item_id?: string
    item_name: string
    category: ItemCategory
    quantity: number
    unit: string
    staff_notes?: string
  }[]
}

export interface ReviewItemPayload {
  id: string
  est_unit_price: number
  preferred_store: string
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  low: 'Can wait',
  normal: 'Normal',
  high: 'Urgent — today',
}

export const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  queued: 'In purchase list',
  rejected_by_support: 'Returned by support',
  pending_supervisor: 'Awaiting CJ',
  approved: 'Approved',
  rejected_by_supervisor: 'Returned by CJ',
  purchased: 'Purchased',
  done: 'Done',
}
