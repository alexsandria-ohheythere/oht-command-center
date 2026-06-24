// lib/notifBadges.js
// Returns a { moduleId: count } map of items "needing attention" per sidebar module.
// Each query is isolated with Promise.allSettled so a missing table or failed query
// never blanks out the others — core badges always render.
//
// Module IDs MUST match the `id` values used in components/Sidebar.js NAV_BASE.

import { createClient } from './supabase'

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString)
function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Count calendar days between earliest entry and yesterday that have NO row.
// `rows` is an array of objects each having a date string in `dateField`.
function countMissingDays(rows, dateField) {
  if (!rows || rows.length === 0) return 0

  const present = new Set()
  let earliest = null
  for (const r of rows) {
    const v = r[dateField]
    if (!v) continue
    const dayStr = String(v).slice(0, 10) // normalize timestamp -> date
    present.add(dayStr)
    if (earliest === null || dayStr < earliest) earliest = dayStr
  }
  if (!earliest) return 0

  // Cutoff = yesterday (today isn't "unreported" until the day is over)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const cutoff = ymd(yesterday)
  if (cutoff < earliest) return 0

  let missing = 0
  const cur = new Date(earliest + 'T00:00:00')
  const end = new Date(cutoff + 'T00:00:00')
  while (cur <= end) {
    if (!present.has(ymd(cur))) missing++
    cur.setDate(cur.getDate() + 1)
  }
  return missing
}

export async function getNotifBadges() {
  const sb = createClient()

  // Run all source queries in parallel; isolate failures.
  const results = await Promise.allSettled([
    sb.from('sales').select('sale_date'),                                   // 0 sales
    sb.from('expenses').select('expense_date'),                             // 1 expenses
    sb.from('schedules').select('week_start,published').eq('published', false), // 2 schedule
    sb.from('leave_requests').select('id').eq('status', 'pending'),         // 3 leave
    sb.from('tasks').select('id').eq('status', 'todo'),                     // 4 tasks
    sb.from('incident_reports').select('stage'),                           // 5 incidents
    sb.from('purchase_requests').select('id').eq('status', 'queued'),       // 6 purchase approvals
  ])

  const val = i => (results[i].status === 'fulfilled' ? (results[i].value?.data || []) : [])

  // Sales / Expenses — missing calendar days
  const sales    = countMissingDays(val(0), 'sale_date')
  const expenses = countMissingDays(val(1), 'expense_date')

  // Scheduling — distinct weeks that have unpublished changes
  const schedule = new Set(val(2).map(r => r.week_start).filter(Boolean)).size

  // Leave — pending requests
  const leave = val(3).length

  // Job Orders — tasks in the To Do column
  const tasks = val(4).length

  // Incident Reports — anything not closed (null stage treated as open)
  const reportsIncident = val(5).filter(r => (r.stage || 'hr_review') !== 'closed').length

  // Purchase Approvals — items queued for approval
  const invApprove = val(6).length

  // Keys MUST match Sidebar NAV_BASE item ids
  return {
    sales,
    expenses,
    schedule,
    leave,
    tasks,
    'reports-incident': reportsIncident,
    'inv-approve': invApprove,
  }
}
