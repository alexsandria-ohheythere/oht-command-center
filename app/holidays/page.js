// ── HOLIDAYS (shared by Holidays module, Scheduling and Payroll) ──────────────
// Source of truth is the `holidays` table in Supabase (managed at /holidays).
// If the table can't be read (not created yet, network hiccup), callers fall back to the
// built-in 2026 list in lib/payroll.js (PH_HOLIDAYS) so nothing breaks.

export const HOLIDAY_TYPES = {
  regular:         { label:'Regular Holiday',     short:'Regular',     color:'#c0392b', bg:'#fdecea', border:'#e57373', pay:'200% if worked · 100% if not (full-time)' },
  special:         { label:'Special Non-Working', short:'Special',     color:'#a06000', bg:'#fef3e2', border:'#d4a843', pay:'130% if worked · no work, no pay' },
  special_working: { label:'Special Working Day', short:'Working day', color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4', pay:'Ordinary day — regular pay' },
  company:         { label:'OHT Event / Closure', short:'OHT Event',   color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5', pay:'No pay effect — scheduling note only' },
}

export const getHolidayType = t => HOLIDAY_TYPES[t] || HOLIDAY_TYPES.regular

// Returns [{ id, date:'YYYY-MM-DD', name, type, notes }] sorted by date, or null on error.
export async function fetchHolidays(supabase) {
  try {
    const { data, error } = await supabase.from('holidays').select('*').order('date')
    if (error) return null
    return (data || []).map(h => ({ ...h, date: String(h.date).slice(0, 10) }))
  } catch (e) {
    return null
  }
}

// Short date like "Mon, Nov 30"
export function fmtHolidayDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric' })
}
