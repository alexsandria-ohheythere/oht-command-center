import { createClient } from './supabase'

// Admin UIDs — Alex and CJ always get notified of staff actions
const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']

// Get all admin staff_ids (from the staff table, matched by email)
export async function getAdminStaffIds(supabase) {
  const { data } = await supabase
    .from('staff')
    .select('id, email')
    .in('email', ADMIN_EMAILS)
  return (data || []).map(s => s.id)
}

// Core send function
export async function sendNotification(staffIds, { type, title, message }) {
  if (!staffIds || staffIds.length === 0) return
  const supabase = createClient()
  const unique = [...new Set(staffIds.filter(Boolean))]
  const notifs = unique.map(staff_id => ({
    staff_id, type, title,
    message: message || '',
    is_read: false,
  }))
  const { error } = await supabase.from('notifications').insert(notifs)
  if (error) console.error('Notification error:', error.message)
}

// Notify a single staff member
export async function notifyOne(staffId, payload) {
  return sendNotification([staffId], payload)
}

// Notify specific staff + admins
export async function notifyWithAdmins(staffId, staffPayload, adminPayload) {
  const supabase = createClient()
  const adminIds = await getAdminStaffIds(supabase)
  // Notify staff member
  if (staffId) await sendNotification([staffId], staffPayload)
  // Notify admins (different message)
  const adminTargets = adminIds.filter(id => id !== staffId)
  if (adminTargets.length > 0) await sendNotification(adminTargets, adminPayload)
}

// Notify all staff in a list
export async function notifyAll(staffIds, payload) {
  return sendNotification(staffIds, payload)
}

// Notify admins only
export async function notifyAdmins(payload) {
  const supabase = createClient()
  const adminIds = await getAdminStaffIds(supabase)
  if (adminIds.length > 0) await sendNotification(adminIds, payload)
}
