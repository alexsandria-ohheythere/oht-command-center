import { createClient } from './supabase'
export const ROLES = {
  admin:      { label: 'Admin',      color: '#7ab648' },
  supervisor: { label: 'Supervisor', color: '#b06af5' },
  hr:         { label: 'HR',         color: '#e8845a' },
  staff:      { label: 'Staff',      color: '#4a90c4' },
}
export async function getUserRole(supabase) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('user_roles').select('role, staff_id, email').eq('user_id', session.user.id).single()
  return data || { role: 'staff', staff_id: null, email: session.user.email }
}
export const PERMISSIONS = {
  admin: {
    schedule:true, leaveApprove:true, leaveReview:true,
    payrollUpload:true, payrollSave:true, payrollExport:true,
    finance:true, staffEdit:true, staffView:true, settings:true,
    tasks:true, roles:true, checkin:true, announcements:true, dashboard:true, admin:true,
    incidentReports:true,
  },
  supervisor: {
    schedule:true, leaveApprove:false, leaveReview:true,
    payrollUpload:true, payrollSave:false, payrollExport:true,
    finance:false, staffEdit:false, staffView:true, settings:false,
    tasks:true, roles:true, checkin:true, announcements:true, dashboard:true, admin:false,
    incidentReports:false,
  },
  hr: {
    schedule:true, leaveApprove:false, leaveReview:true,
    payrollUpload:true, payrollSave:false, payrollExport:true,
    finance:false, staffEdit:false, staffView:true, settings:false,
    tasks:true, roles:true, checkin:true,
    admin:true,
    announcements:true, dashboard:true,
    incidentReports:true,
  },
  staff: {
    schedule:false, leaveApprove:false, leaveReview:false,
    payrollUpload:false, payrollSave:false, payrollExport:false,
    finance:false, staffEdit:false, staffView:false, settings:false,
    tasks:false, roles:false, checkin:false, announcements:false, dashboard:true, admin:false,
    incidentReports:false,
  },
}
export function can(role, permission) {
  return PERMISSIONS[role]?.[permission] === true
}
