/**
 * OHT Messenger Notification Utility
 * 
 * Usage:
 *   import { sendMessengerNotification, notifyStaff } from '@/lib/messenger';
 * 
 *   // Send to a known PSID
 *   await sendMessengerNotification(psid, '📅 You have a new shift assigned.');
 * 
 *   // Send to a staff member by their staff ID (looks up PSID automatically)
 *   await notifyStaff(staffId, '📋 A new job order has been assigned to you.');
 */

import { createClient } from './supabase';

// ── Core send function ───────────────────────────────────────────────────────
export async function sendMessengerNotification(psid, message) {
  if (!psid) return { success: false, error: 'No PSID provided' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text: message },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error('[Messenger] Send failed:', err);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (err) {
    console.error('[Messenger] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

// ── Notify by staff ID (auto-lookup PSID) ───────────────────────────────────
export async function notifyStaff(staffId, message) {
  if (!staffId) return { success: false, error: 'No staffId provided' };

  const supabase = createClient();

  const { data: staff, error } = await supabase
    .from('staff')
    .select('messenger_psid, messenger_opted_in, name')
    .eq('id', staffId)
    .single();

  if (error || !staff) {
    console.warn(`[Messenger] Staff ${staffId} not found`);
    return { success: false, error: 'Staff not found' };
  }

  if (!staff.messenger_opted_in || !staff.messenger_psid) {
    console.warn(`[Messenger] Staff ${staff.name} has not opted in to Messenger notifications`);
    return { success: false, error: 'Staff not opted in' };
  }

  return sendMessengerNotification(staff.messenger_psid, message);
}

// ── Pre-built notification templates ────────────────────────────────────────
export const notify = {
  shiftAssigned: (staffId, date, time, role) =>
    notifyStaff(staffId, `📅 You've been scheduled!\n\nDate: ${date}\nTime: ${time}\nRole: ${role}\n\nCheck your portal for full details.`),

  shiftReassigned: (staffId, date, time, role) =>
    notifyStaff(staffId, `🔄 Your shift has been updated.\n\nNew schedule:\nDate: ${date}\nTime: ${time}\nRole: ${role}\n\nCheck your portal for full details.`),

  dayOffApproved: (staffId, date) =>
    notifyStaff(staffId, `✅ Your day-off request for ${date} has been approved.`),

  dayOffDenied: (staffId, date) =>
    notifyStaff(staffId, `❌ Your day-off request for ${date} has been denied. Please check your portal for more information.`),

  jobOrderAssigned: (staffId, ticketNumber, title) =>
    notifyStaff(staffId, `📋 New Job Order Assigned\n\nTicket: ${ticketNumber}\nTask: ${title}\n\nCheck your portal for full instructions.`),

  contractReady: (staffId) =>
    notifyStaff(staffId, `📄 A new contract is ready for your review and signature. Please log in to your staff portal to sign it.`),

  payslipReleased: (staffId, period) =>
    notifyStaff(staffId, `💰 Your payslip for ${period} is now available. Log in to your staff portal to view it.`),

  incidentFiled: (staffId) =>
    notifyStaff(staffId, `⚠️ An incident report has been filed that involves you. Please check your staff portal for details.`),

  sanctionIssued: (staffId, type) =>
    notifyStaff(staffId, `⚠️ A ${type} has been issued. Please log in to your staff portal to review it.`),

  checkInReminder: (staffId) =>
    notifyStaff(staffId, `🕐 Reminder: Don't forget to check in for your shift today via the OHT Staff Portal.`),
};
