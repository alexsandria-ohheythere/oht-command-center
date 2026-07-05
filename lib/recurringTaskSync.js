// lib/recurringTaskSync.js
// Generates recurring_task_assignments for staff whose schedule + role + day-of-week
// matches an active recurring_tasks template. Safe to call repeatedly — only inserts
// what's missing, never overwrites completed rows.

const DOW = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export function dayNameFromISO(dateISO) {
  // dateISO = 'YYYY-MM-DD' — parse as local date, not UTC, to avoid off-by-one
  const [y, m, d] = dateISO.split('-').map(Number)
  return DOW[new Date(y, m - 1, d).getDay()]
}

/**
 * @param {*} supabase - supabase client
 * @param {string} dateISO - target date, 'YYYY-MM-DD'
 * @param {string|null} staffId - if provided, only sync this staff member (use from Staff Portal,
 *   where RLS-safe self-service inserts are all that's needed). Leave null for admin-side sync
 *   across everyone scheduled that day.
 */
export async function syncRecurringTasksForDate(supabase, dateISO, staffId = null) {
  const dayName = dayNameFromISO(dateISO)

  let scheduleQuery = supabase.from('schedules').select('id, staff_id, shift_type').eq('shift_date', dateISO)
  if (staffId) scheduleQuery = scheduleQuery.eq('staff_id', staffId)
  const { data: scheduleRows } = await scheduleQuery
  if (!scheduleRows || scheduleRows.length === 0) return []

  const staffIds = [...new Set(scheduleRows.map(s => s.staff_id))]

  const [{ data: staffRows }, { data: templates }, { data: existing }] = await Promise.all([
    supabase.from('staff').select('id, role').in('id', staffIds),
    supabase.from('recurring_tasks').select('*').eq('is_active', true).contains('days_of_week', [dayName]),
    supabase.from('recurring_task_assignments').select('recurring_task_id, staff_id').eq('shift_date', dateISO),
  ])

  if (!templates || templates.length === 0) return []

  const roleByStaff = Object.fromEntries((staffRows || []).map(s => [s.id, s.role]))
  const existingKeys = new Set((existing || []).map(e => `${e.recurring_task_id}::${e.staff_id}`))

  const inserts = []
  for (const sched of scheduleRows) {
    const role = roleByStaff[sched.staff_id]
    if (!role) continue
    const matching = templates.filter(t =>
      t.role === role && (!t.shift_type || t.shift_type === sched.shift_type)
    )
    for (const t of matching) {
      const key = `${t.id}::${sched.staff_id}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key) // avoid dup inserts within same batch (e.g. multiple shifts)
      inserts.push({
        recurring_task_id: t.id,
        staff_id: sched.staff_id,
        schedule_id: sched.id,
        shift_date: dateISO,
        shift_type: sched.shift_type,
        completed: false,
      })
    }
  }

  if (inserts.length === 0) return []

  const { data, error } = await supabase
    .from('recurring_task_assignments')
    .insert(inserts)
    .select('*, recurring_tasks(task_name, category, description)')

  if (error) {
    // Unique constraint races are harmless (another tab/user synced first) — swallow those
    if (!String(error.message || '').includes('duplicate key')) {
      console.error('syncRecurringTasksForDate error:', error)
    }
    return []
  }
  return data || []
}
