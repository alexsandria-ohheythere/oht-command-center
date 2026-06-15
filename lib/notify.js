import { createClient } from './supabase'

// Send a notification to one or more staff members
export async function sendNotification(staffIds, { type, title, message }) {
  const supabase = createClient()
  if (!staffIds || staffIds.length === 0) return
  const notifs = staffIds.map(staff_id => ({
    staff_id,
    type,
    title,
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

// Notify all staff
export async function notifyAll(staffIds, payload) {
  return sendNotification(staffIds, payload)
}
