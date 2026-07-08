// lib/roleTaskSync.js
// Generates shift_task_assignments ("the checklist") for staff whose schedule + role + shift
// matches an active role_tasks template for that day. Mirrors recurringTaskSync.js.
// Safe to call repeatedly — only inserts what's missing, never overwrites completed rows.
//
// Previously, these rows were only created lazily inside openDetail() when an admin clicked
// into a specific staff member's card on this page. That meant the Staff Portal checklist
// wouldn't appear for that person/shift until an admin had opened them here first. Calling
// this during fetchAll() (like syncRecurringTasksForDate already is) seeds the checklist for
// everyone scheduled that day automatically — no admin click required, and the Staff Portal
// (which calls the identical function) picks up the same rows in real time.

/**
 * @param {*} supabase - supabase client
 * @param {string} dateISO - target date, 'YYYY-MM-DD'
 * @param {string|null} staffId - if provided, only sync this staff member. Leave null for
 *   admin-side sync across everyone scheduled that day.
 */
export async function syncRoleTasksForDate(supabase, dateISO, staffId = null) {
  let scheduleQuery = supabase.from('schedules').select('id, staff_id, shift_type').eq('shift_date', dateISO)
  if (staffId) scheduleQuery = scheduleQuery.eq('staff_id', staffId)
  const { data: scheduleRows } = await scheduleQuery
  if (!scheduleRows || scheduleRows.length === 0) return []

  const staffIds = [...new Set(scheduleRows.map(s => s.staff_id))]

  const [{ data: staffRows }, { data: templates }, { data: existing }] = await Promise.all([
    supabase.from('staff').select('id, role').in('id', staffIds),
    supabase.from('role_tasks').select('*').eq('is_active', true),
    supabase.from('shift_task_assignments').select('task_id, staff_id').eq('shift_date', dateISO),
  ])

  if (!templates || templates.length === 0) return []

  const roleByStaff = Object.fromEntries((staffRows || []).map(s => [s.id, s.role]))
  const existingKeys = new Set((existing || []).map(e => `${e.task_id}::${e.staff_id}`))

  const inserts = []
  for (const sched of scheduleRows) {
    const role = roleByStaff[sched.staff_id]
    if (!role) continue
    const matching = templates.filter(t => t.role === role && t.shift_type === sched.shift_type)
    for (const t of matching) {
      const key = `${t.id}::${sched.staff_id}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key) // avoid dup inserts within same batch (e.g. multiple shifts)
      inserts.push({
        schedule_id: sched.id,
        task_id: t.id,
        staff_id: sched.staff_id,
        shift_date: dateISO,
        shift_type: sched.shift_type,
        completed: false,
        completed_at: null,
      })
    }
  }

  if (inserts.length === 0) return []

  const { data, error } = await supabase
    .from('shift_task_assignments')
    .insert(inserts)
    .select('*, role_tasks!shift_task_assignments_task_id_fkey(task_name, category)')

  if (error) {
    // Unique constraint races are harmless (another tab/user synced first) — swallow those
    if (!String(error.message || '').includes('duplicate key')) {
      console.error('syncRoleTasksForDate error:', error)
    }
    return []
  }
  return data || []
}
