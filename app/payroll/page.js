'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { CUTOFF_PERIODS, getCurrentCutoff, parseTimesheetCSV, filterShiftsByPeriod, matchStaff, computeCutoffPayroll, getDailyRate, getBaseRate, applyAdjustmentsToShifts, applyScheduleToLateMinutes, buildCorrectedShift, isoToMMDDYYYY, findTimesheetKey, capShiftHours, round2, computeServiceChargeShares, isServiceChargeEligible, FULL_TIME_SHIFTS_PER_CUTOFF } from '../../lib/payroll'
import { generatePayslipPDF, buildPayslipRun } from '../../lib/payslipPdf'
import { notifyOne } from '../../lib/notify'

const peso = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
// Ownership/management roles excluded entirely from the Service Charge pool — it's for rank-and-file staff, not the owners.
const SC_EXCLUDED_ROLES = ['CEO','Managing Director']
const ISSUE_LABELS = { no_time_in:'No time-in recorded', no_time_out:'No time-out recorded', wrong_time:'Wrong time recorded', missed_entirely:'Entire shift missing', payroll_correction:'Payroll correction (admin-initiated)' }
const SHIFT_LABELS = { am:'AM', ops:'OPS', mid:'MID', pm:'PM' }
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

function SortTh({ label, colKey, sortKey, sortDir, onSort, style }) {
  const active = sortKey === colKey
  return (
    <th
      onClick={() => onSort(colKey)}
      style={{
        padding:'11px 12px',
        textAlign:'left',
        fontSize:9,
        fontWeight:700,
        letterSpacing:1.5,
        textTransform:'uppercase',
        color: active ? 'white' : 'var(--matcha-light)',
        cursor:'pointer',
        userSelect:'none',
        whiteSpace:'nowrap',
        ...style
      }}
    >
      {label}
      <span style={{marginLeft:5, opacity: active ? 1 : 0.4, fontSize:10}}>
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

export default function PayrollPage() {
  const supabase = createClient()
  const [staff, setStaff]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [timesheetData, setTimesheetData]   = useState(null)
  const [savedTimesheet, setSavedTimesheet] = useState(null)
  const [schedules, setSchedules]           = useState([])
  const [approvedLeaves, setApprovedLeaves] = useState([])
  const [dayOffs, setDayOffs]               = useState([])
  // Manual per-staff adjustments (incentives/refund/undertime) keyed by staff_id, for the LIVE (unsaved) run
  const [adjustments, setAdjustments]       = useState({})
  const [expandedEmp, setExpandedEmp]       = useState(null)
  const [tab, setTab]                       = useState('summary')
  const [savedRuns, setSavedRuns]           = useState([])
  const [selectedCutoff, setSelectedCutoff] = useState(getCurrentCutoff())
  const [unmatchedTs, setUnmatchedTs]       = useState([])
  const [toast, setToast]                   = useState(null)
  const [sortKey, setSortKey]               = useState('name')
  const [sortDir, setSortDir]               = useState('asc')
  const [rateOverrides, setRateOverrides]   = useState(null)
  const [adjustmentRequests, setAdjustmentRequests] = useState([])
  const [reviewNotes, setReviewNotes]       = useState({})
  const [approving, setApproving]           = useState(null)
  const [settling, setSettling]             = useState(null)
  // Staff-filed Overtime requests (overtime_requests table) — reviewed in the Overtime tab,
  // reflected into payroll_runs.overtime for the SAME cutoff the shift belongs to.
  const [otRequests, setOtRequests]         = useState([])
  const [otReviewNotes, setOtReviewNotes]   = useState({})
  const [otPreviews, setOtPreviews]         = useState({})
  const [otPreviewing, setOtPreviewing]     = useState(null)
  const [otAmounts, setOtAmounts]           = useState({})
  const [otApproving, setOtApproving]       = useState(null)
  // Management-initiated Overtime request form (Request Overtime card)
  const [otForm, setOtForm]                 = useState({ staffId: '', date: '', cutoffId: '', shiftType: '', requestedHours: '', note: '' })
  const [creatingOt, setCreatingOt]         = useState(false)
  const [cancellingOt, setCancellingOt]     = useState(null)
  const [auditResults, setAuditResults]     = useState(null)
  const [auditing, setAuditing]             = useState(false)
  const [previews, setPreviews]             = useState({})
  const [previewing, setPreviewing]         = useState(null)
  const [currentStaffId, setCurrentStaffId] = useState(null)
  // Service Charge: computed and paid out MONTHLY (not per cutoff) — the pool is the sum of
  // Finance > Sales "service_charge" entries for a whole calendar month, split by hours worked
  // across whichever cutoff(s) belong to that month, then saved as a lump sum onto ONE chosen
  // cutoff's payroll_runs row (typically the later cutoff, once the full month's sales are in).
  const [scMonth, setScMonth]               = useState(selectedCutoff.end.slice(0,7))
  const [scTargetCutoffId, setScTargetCutoffId] = useState(null)
  const [serviceChargePool, setServiceChargePool] = useState(0)
  const [scRuns, setScRuns]                 = useState([]) // payroll_runs rows for the month's cutoff(s) — hours source
  const [scTargetRuns, setScTargetRuns]     = useState([]) // payroll_runs rows for the payout cutoff (next month) — existence check + display
  const [scSaving, setScSaving]             = useState(false)
  const fileRef = useRef()

  useEffect(() => { fetchStaff(); fetchRateOverrides(); fetchAdjustmentRequests(); fetchOvertimeRequests(); fetchCurrentStaffId() }, [])
  useEffect(() => { fetchSavedRuns(); fetchSavedTimesheet(); fetchAttendanceRefs() }, [selectedCutoff])
  useEffect(() => { fetchScMonthData() }, [scMonth])

  async function fetchCurrentStaffId() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return
    const { data } = await supabase.from('staff').select('id').eq('email', user.email).maybeSingle()
    if (data) setCurrentStaffId(data.id)
  }

  async function fetchAdjustmentRequests() {
    const { data, error } = await supabase.from('timesheet_adjustments')
      .select('*, staff:staff!timesheet_adjustments_staff_id_fkey(first_name,last_name,nickname,role,employment_type,monthly_pay)')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchAdjustmentRequests error:', error)
    setAdjustmentRequests(data || [])
  }

  async function fetchOvertimeRequests() {
    const { data, error } = await supabase.from('overtime_requests')
      .select('*, staff:staff!overtime_requests_staff_id_fkey(first_name,last_name,nickname,role,employment_type,monthly_pay)')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchOvertimeRequests error:', error)
    setOtRequests(data || [])
  }

  // Management-initiated: creates the request in 'requested' state — the staff member accepts
  // or declines from the Staff Portal, then (if accepted) submits the actual period worked,
  // which is what lands here for approval.
  async function createOvertimeRequest() {
    if (!otForm.staffId || !otForm.date || !otForm.requestedHours) { showToast('⚠️', 'Pick a staff member, date, and requested hours'); return }
    // Cutoff is normally auto-matched from the date, but the Payroll Cutoff field lets you
    // override it — e.g. overtime worked right at a cutoff boundary that you want reflected
    // in a specific payslip regardless of which cutoff the calendar date technically falls in.
    const cutoff = CUTOFF_PERIODS.find(p => p.id === parseInt(otForm.cutoffId))
    if (!cutoff) { showToast('❌', 'Pick which payroll cutoff this overtime should land in'); return }
    setCreatingOt(true)
    const { data, error } = await supabase.from('overtime_requests').insert([{
      staff_id: otForm.staffId,
      requested_by: currentStaffId,
      cutoff_id: cutoff.id, cutoff_label: cutoff.label,
      shift_date: otForm.date, shift_type: otForm.shiftType || null,
      requested_hours: parseFloat(otForm.requestedHours),
      requested_note: otForm.note.trim() || null,
      status: 'requested',
    }]).select().single()
    setCreatingOt(false)
    if (error) { showToast('❌', error.message); return }
    const noteText = otForm.note.trim()
    setOtForm({ staffId: '', date: '', cutoffId: '', shiftType: '', requestedHours: '', note: '' })
    await fetchOvertimeRequests()
    showToast('✅', 'Overtime request sent to staff')
    notifyOne(data.staff_id, {
      type: 'overtime_requested',
      title: '⏰ Overtime Requested',
      message: `Management is asking you to work ${data.requested_hours}h overtime on ${new Date(data.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} (${cutoff.label}) — please accept or decline in the portal.${noteText ? ' Note: ' + noteText : ''}`,
    }).catch(() => {})
  }

  // Withdraws a request YOU sent, before it's been acted on — e.g. you asked the wrong
  // person, or the coverage need went away. Only valid pre-submission ('requested' or
  // 'accepted'); once they've submitted an actual period, use Reject instead. Dead end,
  // same as decline/reject — no auto-retry.
  async function cancelOvertimeRequest(req) {
    if (!confirm(`Cancel the overtime request sent to ${req.staff?.first_name}? This withdraws it — they'll no longer be able to respond.`)) return
    setCancellingOt(req.id)
    const { error } = await supabase.from('overtime_requests').update({
      status: 'cancelled', reviewed_by: currentStaffId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', req.id)
    setCancellingOt(null)
    if (error) { showToast('❌', error.message); return }
    notifyOne(req.staff_id, {
      type: 'overtime_cancelled',
      title: '⏰ Overtime Request Cancelled',
      message: `Management withdrew the ${req.requested_hours}h overtime request for ${new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} (${req.cutoff_label}).`,
    }).catch(() => {})
    await fetchOvertimeRequests()
    showToast('🗑️', 'Overtime request cancelled')
  }

  async function fetchAttendanceRefs() {
    const start = selectedCutoff.start, end = selectedCutoff.end
    // Published schedule rows that fall within the cutoff window
    const { data: sch } = await supabase.from('schedules').select('staff_id,shift_date,shift_type,published').eq('published', true).gte('shift_date', start).lte('shift_date', end)
    setSchedules(sch || [])
    const { data: lv } = await supabase.from('leave_requests').select('staff_id,date_from,date_to,leave_type').eq('status', 'approved')
    setApprovedLeaves(lv || [])
    const { data: doff } = await supabase.from('day_offs').select('staff_id,date_from,date_to')
    setDayOffs(doff || [])
  }

  // A cutoff "belongs" to whichever calendar month its END date falls in — same convention
  // already used by computeCutoffPayroll's isFirstCutoffOfMonth check. Most months resolve to
  // exactly 2 cutoffs (first half + second half).
  function cutoffsForMonth(monthStr) {
    return CUTOFF_PERIODS.filter(p => p.end.slice(0,7) === monthStr)
  }
  function monthEndISO(monthStr) {
    const [y,m] = monthStr.split('-').map(Number)
    const d = new Date(y, m, 0)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  function nextMonthStr(monthStr) {
    const [y,m] = monthStr.split('-').map(Number)
    const d = new Date(y, m, 1) // m is already 1-indexed month, so this rolls to the 1st of next month
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  }

  // Service Charge pool + hours source for the selected MONTH — sourced from Finance > Sales
  // entries (each sale record can carry a service_charge amount) summed across the whole
  // calendar month, and payroll_runs for whichever cutoff(s) belong to that month. The lump sum
  // is paid out on the NEXT month's first cutoff by default — that's when the full month's sales
  // are actually in and payroll for it is being run — not on a cutoff within the same month.
  async function fetchScMonthData() {
    const cutoffs = cutoffsForMonth(scMonth)
    const ids = cutoffs.map(c => c.id)
    const payoutIds = cutoffsForMonth(nextMonthStr(scMonth)).map(c => c.id)
    if (!ids.length) { setScRuns([]); setScTargetRuns([]); setServiceChargePool(0); setScTargetCutoffId(null); return }
    // Default the "apply to" cutoff to the FIRST cutoff of the FOLLOWING month, unless the admin
    // already picked a valid one for this month's payout.
    setScTargetCutoffId(prev => (prev && payoutIds.includes(prev)) ? prev : (payoutIds[0] ?? null))
    const allIds = [...new Set([...ids, ...payoutIds])]
    const [{ data: runs, error: runsErr }, { data: salesRows, error: salesErr }] = await Promise.all([
      allIds.length
        ? supabase.from('payroll_runs').select('*, staff(first_name,last_name,nickname,role,employment_type,violation_count)').in('cutoff_id', allIds)
        : Promise.resolve({ data: [] }),
      supabase.from('sales').select('service_charge').gte('sale_date', scMonth+'-01').lte('sale_date', monthEndISO(scMonth)),
    ])
    if (runsErr) console.error('fetchScMonthData runs error:', runsErr)
    if (salesErr) console.error('fetchScMonthData sales error:', salesErr)
    const allRuns = runs || []
    setScRuns(allRuns.filter(r => ids.includes(r.cutoff_id)))
    setScTargetRuns(allRuns.filter(r => payoutIds.includes(r.cutoff_id)))
    const total = (salesRows || []).reduce((sum, s) => sum + (parseFloat(s.service_charge) || 0), 0)
    setServiceChargePool(round2(total))
  }

  async function fetchSavedTimesheet() {
    const { data } = await supabase.from('timesheet_uploads').select('employees,uploaded_at').eq('cutoff_id', selectedCutoff.id).maybeSingle()
    setSavedTimesheet(data ? { employees: data.employees, uploadedAt: data.uploaded_at } : null)
  }

  async function fetchRateOverrides() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'payroll_rates').single()
    if (data?.value) {
      try { setRateOverrides(JSON.parse(data.value)) } catch(e) {}
    }
  }

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*')
    setStaff(data || [])
    setLoading(false)
  }

  async function fetchSavedRuns() {
    const { data } = await supabase.from('payroll_runs').select('*, staff(first_name,last_name,nickname,role,employment_type)').eq('cutoff_id', selectedCutoff.id)
    setSavedRuns(data || [])
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function handleTimesheetUpload(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseTimesheetCSV(ev.target.result)
      const totalShifts = Object.values(parsed).reduce((sum, e) => sum + (e.shifts?.length || 0), 0)
      if (totalShifts === 0 && Object.keys(parsed).length > 0) {
        showToast('⚠️', `Loaded ${Object.keys(parsed).length} employees but ZERO shift rows — this looks like a totals-only summary export, not the detailed per-shift report. Check before saving.`)
      } else {
        showToast('✅', `Timesheet loaded · ${Object.keys(parsed).length} employees found`)
      }
      setTimesheetData(parsed)
      const unmatched = Object.values(parsed).filter(ts => !matchStaff(staff, ts.lastName, ts.firstName))
      setUnmatchedTs(unmatched)
    }
    reader.readAsText(file); e.target.value = ''
  }

  function requiredDaysFor(staffId) {
    // Distinct published scheduled dates for this staff within the selected cutoff window
    return [...new Set(
      schedules.filter(s => s.staff_id === staffId && s.shift_date >= selectedCutoff.start && s.shift_date <= selectedCutoff.end)
        .map(s => s.shift_date)
    )].length
  }

  function pendingCorrectionsFor(staffId) {
    return adjustmentRequests.filter(a => a.staff_id === staffId && a.cutoff_id === selectedCutoff.id && a.status === 'approved' && a.resolution === 'timesheet_correction' && !a.applied)
  }
  function pendingRefundFor(staffId) {
    return adjustmentRequests.filter(a => a.staff_id === staffId && a.status === 'approved' && a.resolution === 'refund' && !a.applied)
      .reduce((sum, a) => sum + (parseFloat(a.refund_amount) || 0), 0)
  }
  // Approved-but-not-yet-applied overtime, SCOPED to the cutoff currently being viewed —
  // unlike refunds, overtime always belongs to the exact cutoff its shift fell in, so it
  // only pre-fills when that same cutoff is selected (never rolled into whichever cutoff
  // happens to be open next).
  function pendingOvertimeFor(staffId) {
    return otRequests.filter(o => o.staff_id === staffId && o.cutoff_id === selectedCutoff.id && o.status === 'approved' && !o.applied)
      .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
  }

  // Pre-fill any banked refunds/approved overtime into their editable fields as soon as we
  // know about them — this must NOT wait for a timesheet upload, since a payslip card (and
  // the amount owed) can already exist before this cutoff's timesheet is uploaded. Admin can
  // still see/adjust the number before Save Payroll locks it in.
  useEffect(() => {
    if (!staff.length) return
    setAdjustments(prev => {
      const next = { ...prev }
      staff.forEach(s => {
        if (next[s.id]?.refund === undefined || next[s.id]?.refund === '') {
          const pendingR = pendingRefundFor(s.id)
          if (pendingR > 0) next[s.id] = { ...(next[s.id] || {}), refund: pendingR }
        }
        if (next[s.id]?.overtime === undefined || next[s.id]?.overtime === '') {
          const pendingOT = pendingOvertimeFor(s.id)
          if (pendingOT > 0) next[s.id] = { ...(next[s.id] || {}), overtime: pendingOT }
        }
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheetData, adjustmentRequests, otRequests, staff, selectedCutoff])

  function buildPayrollRows() {
    return staff.map(s => {
      const saved = savedRuns.find(r => r.staff_id === s.id)
      const reqDays = requiredDaysFor(s.id)
      if (timesheetData) {
        const tsKey = Object.keys(timesheetData).find(k => { const ts = timesheetData[k]; return matchStaff([s], ts.lastName, ts.firstName) !== undefined })
        const ts = tsKey ? timesheetData[tsKey] : null
        const periodShiftsFiltered = ts ? filterShiftsByPeriod(ts.shifts, selectedCutoff.start, selectedCutoff.end) : []
        // Correct late-minutes using each date's ACTUAL published shift assignment (am/ops/mid/pm)
        // instead of the parse-time guess from the clock-in time band alone — see applyScheduleToLateMinutes.
        const periodShiftsRaw = applyScheduleToLateMinutes(periodShiftsFiltered, s.id, schedules)
        const corrections = pendingCorrectionsFor(s.id)
        const periodShifts = corrections.length ? applyAdjustmentsToShifts(periodShiftsRaw, corrections) : periodShiftsRaw
        const pay = computeCutoffPayroll(s, periodShifts, rateOverrides, selectedCutoff, reqDays)
        return { staff:s, ts, periodShifts, pay, hasTimesheet:!!ts, saved, isLive:true }
      } else if (saved) {
        const isFT = (s.employment_type||'Full-time')==='Full-time'
        const savedReq = saved.required_days || reqDays
        const monthlyPay = s.monthly_pay || getBaseRate(s.employment_type||'Full-time', s.role, rateOverrides)?.monthly || 0
        const savedDaily = (isFT && savedReq>0 && monthlyPay>0) ? round2((monthlyPay/2)/savedReq) : getDailyRate(s.employment_type||'Full-time',s.role,rateOverrides)
        const pay = { daysWorked:saved.days_worked, paidHours:parseFloat(saved.paid_hours), totalLateMins:saved.total_late_mins, lateCount:saved.late_count, gross:parseFloat(saved.gross), additionalPayment:parseFloat(saved.additional_payment)||0, extraShiftDays:isFT?Math.max(0,(saved.days_worked||0)-FULL_TIME_SHIFTS_PER_CUTOFF):0, lateDeduction:parseFloat(saved.late_deduction), sss:parseFloat(saved.sss), philhealth:parseFloat(saved.philhealth), pagibig:parseFloat(saved.pagibig), tax:parseFloat(saved.tax), sssEmployer:round2(parseFloat(saved.sss||0) * (9.5/4.5)), philhealthEmployer:parseFloat(saved.philhealth), pagibigEmployer:parseFloat(saved.pagibig), totalDeductions:parseFloat(saved.total_deductions), netPay:parseFloat(saved.net_pay), eligible:saved.service_charge_eligible, dailyRate:savedDaily, hourlyRate:round2(savedDaily/8), requiredDays:savedReq, noSchedule:false }
        return { staff:s, ts:null, periodShifts:[], pay, hasTimesheet:false, saved, isLive:false }
      } else {
        return { staff:s, ts:null, periodShifts:[], pay:computeCutoffPayroll(s,[],rateOverrides,selectedCutoff,reqDays), hasTimesheet:false, saved:null, isLive:false }
      }
    })
  }

  // ── Absence: scheduled (published) days with no worked shift ──
  const mmddyyyyToISO = (d) => {
    if (!d) return null
    const [mm, dd, yyyy] = d.split('/')
    if (!mm || !dd || !yyyy) return null
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
  }
  const isExcused = (staffId, iso) => {
    const onLeave = approvedLeaves.some(l => l.staff_id===staffId && iso>=l.date_from && iso<=l.date_to)
    const onDayOff = dayOffs.some(o => o.staff_id===staffId && iso>=o.date_from && iso<=o.date_to)
    return onLeave || onDayOff
  }
  function computeAbsences(staffMember, ts) {
    // Distinct scheduled dates for this staff in the cutoff (published only, already filtered by fetch)
    const scheduledDates = [...new Set(schedules.filter(s => s.staff_id===staffMember.id).map(s => s.shift_date))]
    if (scheduledDates.length === 0) return { noShow: [], excused: [], total: 0 }
    // Dates actually worked (from timesheet), normalized to ISO
    const workedISO = new Set((ts?.shifts || []).map(sh => mmddyyyyToISO(sh.date)).filter(Boolean))
    const noShow = [], excused = []
    scheduledDates.forEach(iso => {
      if (workedISO.has(iso)) return
      if (isExcused(staffMember.id, iso)) excused.push(iso)
      else noShow.push(iso)
    })
    return { noShow: noShow.sort(), excused: excused.sort(), total: noShow.length }
  }

  async function savePayroll() {
    if (!timesheetData) { showToast('⚠️','Upload a timesheet first'); return }
    // Guard against the exact failure mode that caused this incident: an uploaded file that
    // parses "successfully" (real employee names/emails) but contains zero actual shift rows
    // for everyone — e.g. a StoreHub "Totals Summary" export instead of the detailed per-shift
    // report. Saving that silently zeroes out everyone's pay AND marks any banked refunds as
    // "applied" against garbage numbers, so the money never actually lands anywhere.
    const totalShiftsInUpload = Object.values(timesheetData).reduce((sum, e) => sum + (e.shifts?.length || 0), 0)
    if (totalShiftsInUpload === 0) {
      const proceed = confirm(`⚠️ This uploaded file has zero actual shift entries for anyone (only employee summary rows). This usually means the wrong report type was exported from StoreHub — a totals-only summary instead of the detailed per-shift timesheet.\n\nSaving this now would zero out gross pay for all ${Object.keys(timesheetData).length} employees AND mark any banked refunds as paid without the money actually landing anywhere.\n\nAre you SURE you want to save this anyway?`)
      if (!proceed) return
    }
    setSaving(true)
    const rows = buildPayrollRows()
    const upsertData = rows.map(r => { const adj = adjustments[r.staff.id] || {}; return ({ cutoff_id:selectedCutoff.id, cutoff_label:selectedCutoff.label, cutoff_start:selectedCutoff.start, cutoff_end:selectedCutoff.end, staff_id:r.staff.id, days_worked:r.pay.daysWorked, paid_hours:r.pay.paidHours, total_late_mins:r.pay.totalLateMins, late_count:r.pay.lateCount, gross:r.pay.gross, additional_payment:r.pay.additionalPayment||0, late_deduction:r.pay.lateDeduction, sss:r.pay.sss, philhealth:r.pay.philhealth, pagibig:r.pay.pagibig, tax:r.pay.tax, total_deductions:r.pay.totalDeductions, net_pay:r.pay.netPay, service_charge_eligible:r.pay.eligible, required_days:r.pay.requiredDays||0, incentives:parseFloat(adj.incentives)||0, overtime:parseFloat(adj.overtime)||0, refund:parseFloat(adj.refund)||0, undertime:parseFloat(adj.undertime)||0, updated_at:new Date().toISOString() }) })
    const { error } = await supabase.from('payroll_runs').upsert(upsertData, { onConflict:'cutoff_id,staff_id' })
    if (error) { showToast('❌',error.message); setSaving(false); return }
    // Bake any approved timesheet corrections into the archived copy so the record reflects true attendance.
    const correctedTimesheetData = { ...timesheetData }
    let appliedCorrectionIds = []
    rows.forEach(r => {
      const corrections = pendingCorrectionsFor(r.staff.id)
      if (!corrections.length) return
      const tsKey = Object.keys(correctedTimesheetData).find(k => matchStaff([r.staff], correctedTimesheetData[k].lastName, correctedTimesheetData[k].firstName) !== undefined)
      if (!tsKey) return
      correctedTimesheetData[tsKey] = { ...correctedTimesheetData[tsKey], shifts: applyAdjustmentsToShifts(correctedTimesheetData[tsKey].shifts, corrections) }
      appliedCorrectionIds.push(...corrections.map(c => c.id))
    })
    // Persist raw (corrected) timesheet for this cutoff so it can be viewed later
    const { error: tsError } = await supabase.from('timesheet_uploads').upsert(
      { cutoff_id:selectedCutoff.id, cutoff_label:selectedCutoff.label, employees:correctedTimesheetData, uploaded_at:new Date().toISOString() },
      { onConflict:'cutoff_id' }
    )
    if (tsError) showToast('⚠️',`Payroll saved, but timesheet archive failed: ${tsError.message}`)
    // Mark corrections baked into this save, and any banked refunds paid out this cutoff, as applied.
    const appliedRefundIds = rows.flatMap(r => adjustmentRequests.filter(a => a.staff_id===r.staff.id && a.status==='approved' && a.resolution==='refund' && !a.applied).map(a => a.id))
    const allAppliedIds = [...appliedCorrectionIds, ...appliedRefundIds]
    if (allAppliedIds.length) {
      await supabase.from('timesheet_adjustments').update({ applied:true, applied_cutoff_id:selectedCutoff.id, applied_at:new Date().toISOString() }).in('id', allAppliedIds)
    }
    // Mark any approved overtime for THIS cutoff as applied — its amount just got folded into
    // the upsert above via the pre-filled adjustments[staffId].overtime field.
    const appliedOvertimeIds = rows.flatMap(r => otRequests.filter(o => o.staff_id===r.staff.id && o.cutoff_id===selectedCutoff.id && o.status==='approved' && !o.applied).map(o => o.id))
    if (appliedOvertimeIds.length) {
      await supabase.from('overtime_requests').update({ applied:true, applied_cutoff_id:selectedCutoff.id, applied_at:new Date().toISOString() }).in('id', appliedOvertimeIds)
    }
    await fetchSavedRuns(); await fetchSavedTimesheet(); await fetchAdjustmentRequests(); await fetchOvertimeRequests(); setTimesheetData(null); setSaving(false)
    showToast('💾',`Payroll saved for ${selectedCutoff.label}`)
  }

  async function deleteRun(runId, name) {
    if (!confirm(`Delete payroll record for ${name}?`)) return
    await supabase.from('payroll_runs').delete().eq('id', runId)
    setSavedRuns(prev => prev.filter(r => r.id !== runId))
    showToast('🗑️',`Payroll record deleted`)
  }

  async function deleteCutoff() {
    if (!confirm(`Delete ALL payroll records for ${selectedCutoff.label}? This cannot be undone.`)) return
    await supabase.from('payroll_runs').delete().eq('cutoff_id', selectedCutoff.id)
    await supabase.from('timesheet_uploads').delete().eq('cutoff_id', selectedCutoff.id)
    setSavedRuns([])
    setSavedTimesheet(null)
    setTimesheetData(null)
    showToast('🗑️',`All payroll records for ${selectedCutoff.label} deleted`)
  }

  async function downloadPayslip(r) {
    try {
      const adj = adjustments[r.staff.id] || {}
      const saved = r.saved || {}
      // Build a saved-like object using live values if not yet saved
      const runData = {
        gross: r.pay.gross,
        additional_payment: r.pay.additionalPayment || 0,
        sss: r.pay.sss, philhealth: r.pay.philhealth, pagibig: r.pay.pagibig, tax: r.pay.tax,
        late_deduction: r.pay.lateDeduction,
        incentives: r.saved ? saved.incentives : (parseFloat(adj.incentives)||0),
        overtime: r.saved ? saved.overtime : (parseFloat(adj.overtime)||0),
        refund: r.saved ? saved.refund : (parseFloat(adj.refund)||0),
        undertime: r.saved ? saved.undertime : (parseFloat(adj.undertime)||0),
        service_charge: r.saved ? (parseFloat(saved.service_charge)||0) : 0,
      }
      // Resolve absence days for this staff from current timesheet source
      const tsKey = tsSource ? Object.keys(tsSource).find(k=>matchStaff([r.staff], tsSource[k].lastName, tsSource[k].firstName)!==undefined) : null
      const tsForStaff = tsKey ? tsSource[tsKey] : null
      const abs = computeAbsences(r.staff, tsForStaff)
      const run = buildPayslipRun({ saved: runData, dailyRate: r.pay.dailyRate, absenceDays: abs.total, periodLabel: selectedCutoff.label })
      await generatePayslipPDF({ staff: r.staff, run, periodStart: selectedCutoff.start, periodEnd: selectedCutoff.end })
    } catch(e) { showToast('❌', `PDF failed: ${e.message}`) }
  }

  async function togglePaid(run, nextPaid) {
    const { error } = await supabase.from('payroll_runs')
      .update({ paid: nextPaid, paid_at: nextPaid ? new Date().toISOString() : null })
      .eq('id', run.id)
    if (error) { showToast('❌', error.message); return }
    await fetchSavedRuns()
    showToast(nextPaid ? '✅' : '↩️', nextPaid ? 'Marked as paid' : 'Marked as unpaid')
  }

  async function markAllPaid() {
    const unpaidIds = savedRuns.filter(r => !r.paid).map(r => r.id)
    if (unpaidIds.length === 0) { showToast('ℹ️','Everyone is already marked paid'); return }
    if (!confirm(`Mark all ${unpaidIds.length} unpaid record(s) for ${selectedCutoff.label} as paid?`)) return
    const { error } = await supabase.from('payroll_runs')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .in('id', unpaidIds)
    if (error) { showToast('❌', error.message); return }
    await fetchSavedRuns()
    showToast('✅', `Marked ${unpaidIds.length} as paid`)
  }

  // ── Timesheet Adjustments: approve / reject ──────────────────────────────
  async function undoApproval(adj) {
    if (adj.applied) {
      alert(`This adjustment has already been ${adj.paid ? 'paid out directly' : "applied to a staff member's payroll"}. Undoing the approval here won't pull that money back — you'd need to correct it manually (e.g. a deduction on their next payslip). Not blocking you, just flagging it before you decide.`)
    }
    const note = reviewNotes[adj.id] || ''
    if (!confirm(`Undo the approval on ${adj.staff?.first_name} ${adj.staff?.last_name}'s adjustment and mark it rejected instead?${adj.applied ? '\n\n(Reminder: this was already ' + (adj.paid ? 'paid out' : 'applied to payroll') + ' — see the note above.)' : ''}`)) return
    const { error } = await supabase.from('timesheet_adjustments').update({
      status: 'rejected', resolution: null, refund_amount: 0,
      calc_hourly_rate: null, calc_original_paid_hours: null, calc_corrected_paid_hours: null,
      calc_original_late_mins: null, calc_corrected_late_mins: null, calc_original_shift_found: null,
      calc_recorded_late_deduction: null, calc_supposed_late_deduction: null, calc_late_refund: null, calc_extra_hours_credit: null,
      review_note: note ? `${note} (approval undone)` : 'Approval undone', reviewed_by: currentStaffId,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', adj.id)
    if (error) { showToast('❌', error.message); return }
    await fetchAdjustmentRequests()
    showToast('↩️', 'Approval undone — marked rejected')
  }

  async function rejectAdjustment(adj) {
    const note = reviewNotes[adj.id] || ''
    if (!confirm(`Reject ${adj.staff?.first_name}'s adjustment request?`)) return
    const { error } = await supabase.from('timesheet_adjustments').update({
      status: 'rejected', review_note: note, reviewed_by: currentStaffId,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', adj.id)
    if (error) { showToast('❌', error.message); return }
    await fetchAdjustmentRequests()
    showToast('✋', 'Adjustment rejected')
  }

    // Separate from rejectAdjustment/undoApproval — reverses a REJECTED request back to Pending
  // so it reappears in the review queue, instead of the reject decision being final.
  async function undoRejection(adj) {
    if (!confirm(`Undo the rejection on ${adj.staff?.first_name} ${adj.staff?.last_name}'s adjustment and move it back to Pending for review?`)) return
    const { error } = await supabase.from('timesheet_adjustments').update({
    }).eq('id', adj.id)
    if (error) { showToast('❌', error.message); return }
    await fetchAdjustmentRequests()
    showToast('↩️', 'Rejection undone — back in Pending')
  }

  // Lets an admin override which payroll cutoff a staff-filed adjustment posts against — the
  // Staff Portal auto-assigns a cutoff from the shift date, which can land on the wrong side of
  // a cutoff boundary (see the known off-by-one note in the overtime-feature doc). Re-picking it
  // here changes which payroll run the correction/refund is computed and applied into.
  async function updateAdjustmentCutoff(adj, newCutoffId) {
    const cutoff = CUTOFF_PERIODS.find(p => String(p.id) === String(newCutoffId))
    if (!cutoff || String(cutoff.id) === String(adj.cutoff_id)) return
    const { error } = await supabase.from('timesheet_adjustments').update({
      cutoff_id: cutoff.id, cutoff_label: cutoff.label, updated_at: new Date().toISOString(),
    }).eq('id', adj.id)
    if (error) { showToast('❌', error.message); return }
    setPreviews(p => { if (!p[adj.id]) return p; const n = { ...p }; delete n[adj.id]; return n })
    await fetchAdjustmentRequests()
    showToast('🔀', `Moved to ${cutoff.label} payroll`)
  }

async function markRefundPaid(adj) {
    if (!confirm(`Mark ${peso(adj.refund_amount)} refund for ${adj.staff?.first_name} ${adj.staff?.last_name} as paid now? This settles it outside payroll — it will NOT be added to their next payslip.`)) return
    setSettling(adj.id)
    const { error } = await supabase.from('timesheet_adjustments').update({
      applied: true, paid: true, paid_at: new Date().toISOString(), paid_by: currentStaffId, updated_at: new Date().toISOString(),
    }).eq('id', adj.id)
    setSettling(null)
    if (error) { showToast('❌', error.message); return }
    await fetchAdjustmentRequests()
    showToast('💸', `${peso(adj.refund_amount)} marked as paid`)
  }

  async function runAccuracyCheck(cutoffToCheck) {
    setAuditing(true)
    const results = {
      cutoffLabel: cutoffToCheck.label,
      duplicateDates: [], highLate: [], noSchedule: [],
      unmatchedCsvRows: [], rateOverridesLoaded: rateOverrides !== null,
      pendingAdjustments: adjustmentRequests.filter(a => a.status === 'pending').length,
      approvedUnpaidRefunds: adjustmentRequests.filter(a => a.status==='approved' && a.resolution==='refund' && !a.applied).length,
    }
    try {
      const { data: archived } = await supabase.from('timesheet_uploads').select('employees').eq('cutoff_id', cutoffToCheck.id).maybeSingle()
      const employeesBlob = archived?.employees || {}

      for (const key of Object.keys(employeesBlob)) {
        const emp = employeesBlob[key]
        const matched = matchStaff(staff, emp.lastName, emp.firstName)
        if (!matched) results.unmatchedCsvRows.push({ key, name: `${emp.firstName} ${emp.lastName}` })

        // Scope to THIS cutoff's date range only — the uploaded file can span many months.
        // Correct late-minutes against each date's ACTUAL published shift (am/ops/mid/pm) before
        // flagging "unusually high" lates — otherwise a legitimate OPS-shift clock-in gets flagged
        // as a false positive against the AM 06:30 guess (the exact bug this check exists to catch).
        const inRangeShiftsRaw = filterShiftsByPeriod(emp.shifts || [], cutoffToCheck.start, cutoffToCheck.end)
        const inRangeShifts = matched ? applyScheduleToLateMinutes(inRangeShiftsRaw, matched.id, schedules) : inRangeShiftsRaw
        const payrollRow = matched ? payrollRows.find(r => r.staff.id === matched.id) : null
        const isFT = matched && (matched.employment_type||'Full-time') === 'Full-time'

        const byDate = {}
        for (const s of inRangeShifts) { byDate[s.date] = byDate[s.date] || []; byDate[s.date].push(s) }
        for (const date of Object.keys(byDate)) {
          const rows = byDate[date]
          if (rows.length > 1) {
            const oldPaid = rows.reduce((s,r)=>s+(r.paidHours||0),0)
            const mergedRaw = rows.reduce((s,r)=>s+(r.rawHours||0),0)
            const correctPaid = capShiftHours(mergedRaw)
            let impactPeso = null, impactDirection = null
            if (payrollRow) {
              if (isFT) {
                // Each extra punch beyond the first on the same date inflates days_worked by
                // one phantom day, paid at the full flat daily rate.
                impactPeso = round2(payrollRow.pay.dailyRate * (rows.length - 1))
                impactDirection = 'overpaid'
              } else {
                const diff = correctPaid - oldPaid
                impactPeso = round2(Math.abs(diff) * payrollRow.pay.hourlyRate)
                impactDirection = diff >= 0 ? 'underpaid' : 'overpaid'
              }
            }
            results.duplicateDates.push({ name: `${emp.firstName} ${emp.lastName}`, date, count: rows.length, oldPaid, correctPaid, impactPeso, impactDirection })
          }
          for (const s of rows) {
            if ((s.lateMinutes||0) > 120) results.highLate.push({ name: `${emp.firstName} ${emp.lastName}`, date: s.date, lateMinutes: s.lateMinutes, timeIn: s.timeIn })
          }
        }
      }

      for (const row of payrollRows) {
        if ((row.staff.employment_type||'Full-time')==='Full-time' && row.pay.noSchedule && row.pay.daysWorked > 0) {
          results.noSchedule.push({ name: `${row.staff.first_name} ${row.staff.last_name}`, daysWorked: row.pay.daysWorked })
        }
      }
    } catch (e) {
      showToast('❌', 'Accuracy check failed: ' + e.message)
    }
    setAuditResults(results)
    setAuditing(false)
  }

  // Shared calc used by both the "Preview" button (read-only) and actual approval (persists).
  async function computeAdjustmentPreview(adj) {
    const cutoff = CUTOFF_PERIODS.find(p => p.id === adj.cutoff_id)
    const { data: existingRun } = await supabase.from('payroll_runs')
      .select('id, required_days, gross, days_worked, total_late_mins, late_deduction')
      .eq('cutoff_id', adj.cutoff_id).eq('staff_id', adj.staff_id).maybeSingle()

    if (!existingRun) {
      return { type: 'timesheet_correction', cutoffLabel: cutoff?.label }
    }

    const staffMember = adj.staff
    const isFT = (staffMember.employment_type || 'Full-time') === 'Full-time'
    const monthlyPay = staffMember.monthly_pay || getBaseRate(staffMember.employment_type || 'Full-time', staffMember.role, rateOverrides)?.monthly || 0
    const dailyRate = (isFT && existingRun.required_days > 0 && monthlyPay > 0)
      ? (monthlyPay / 2) / existingRun.required_days
      : getDailyRate(staffMember.employment_type || 'Full-time', staffMember.role, rateOverrides)
    const hourlyRate = dailyRate / 8
    const minuteRate = hourlyRate / 60

    const { data: archived } = await supabase.from('timesheet_uploads').select('employees').eq('cutoff_id', adj.cutoff_id).maybeSingle()
    const tsKey = archived?.employees ? findTimesheetKey(archived.employees, staffMember) : null
    const dateMMDDYYYY = isoToMMDDYYYY(adj.shift_date)
    const originalShift = tsKey ? (archived.employees[tsKey].shifts || []).find(s => s.date === dateMMDDYYYY) : null
    const originalShiftFound = !!originalShift
    const correctedShift = (adj.claimed_time_in && adj.claimed_time_out) ? buildCorrectedShift(dateMMDDYYYY, adj.claimed_time_in, adj.claimed_time_out, adj.shift_type || null) : null

    // Basic pay is a flat daily rate — it doesn't prorate by hours, and correcting a day's clock
    // times never changes what Basic owes for that day. Two distinct cases:
    //  - A (bad) shift record already existed for this date -> the day was already counted in
    //    days_worked, so Basic for it is already resolved (either the cutoff was computed fresh
    //    with the flat-rate fix, or a payroll_correction refund already topped it up separately).
    //    No day top-up here — crediting one would double up with that correction.
    //  - No shift record existed at all -> this date was never counted as a day worked, so it
    //    was never paid by anything, and the full daily rate is genuinely owed outright.
    const origLateMins = originalShift?.lateMinutes || 0
    const corrLateMins = correctedShift?.lateMinutes || 0
    const dayTopUp = originalShiftFound ? 0 : round2(dailyRate)

    // Sync against the actual saved cutoff totals — "how much was really deducted for the
    // whole cutoff" vs "what it should be once this one shift is corrected."
    const recordedLateDeduction = parseFloat(existingRun.late_deduction) || 0
    const recordedTotalLateMins = existingRun.total_late_mins || 0
    const supposedTotalLateMins = Math.max(0, recordedTotalLateMins - origLateMins + corrLateMins)
    const supposedLateDeduction = round2(supposedTotalLateMins * minuteRate)
    const lateRefund = recordedLateDeduction - supposedLateDeduction
    const extraHoursCredit = dayTopUp
    const refundAmount = dayTopUp + lateRefund

    return {
      type: 'refund', cutoffLabel: cutoff?.label, refundAmount, originalShiftFound,
      hourlyRate: round2(hourlyRate),
      origPaid: originalShift?.paidHours || 0, corrPaid: correctedShift?.paidHours || 0,
      origLate: origLateMins, corrLate: corrLateMins,
      recordedLateDeduction, supposedLateDeduction, lateRefund, extraHoursCredit,
    }
  }

  async function previewAdjustment(adj) {
    setPreviewing(adj.id)
    try {
      const result = await computeAdjustmentPreview(adj)
      setPreviews(p => ({ ...p, [adj.id]: result }))
    } catch (e) {
      showToast('❌', 'Preview failed: ' + e.message)
    }
    setPreviewing(null)
  }

  async function approveAdjustment(adj) {
    setApproving(adj.id)
    const note = reviewNotes[adj.id] || ''
    const cutoff = CUTOFF_PERIODS.find(p => p.id === adj.cutoff_id)
    try {
      const preview = previews[adj.id] || await computeAdjustmentPreview(adj)

      if (preview.type === 'timesheet_correction') {
        // Before payroll approval — mark approved; the correction merges in automatically
        // next time this cutoff is computed/saved (see buildPayrollRows / savePayroll below).
        const { error } = await supabase.from('timesheet_adjustments').update({
          status: 'approved', resolution: 'timesheet_correction', review_note: note, reviewed_by: currentStaffId,
          reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', adj.id)
        if (error) throw error
        showToast('✅', `Approved — will auto-correct ${cutoff?.label || 'the'} timesheet on next Save Payroll`)
      } else {
        if (!preview.originalShiftFound) {
          const proceed = confirm(`⚠️ Could not find ${adj.staff?.first_name}'s original shift for this date in the archived timesheet for ${cutoff?.label}.\n\nThat means this date wasn't counted as a day worked at all, so this refund includes a FULL day's pay (${peso(preview.refundAmount)}) to cover it — worth double-checking they actually worked that day before approving.\n\nApprove anyway?`)
          if (!proceed) { setApproving(null); return }
        }

        const { error } = await supabase.from('timesheet_adjustments').update({
          status: 'approved', resolution: 'refund', refund_amount: preview.refundAmount, review_note: note, reviewed_by: currentStaffId,
          reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          calc_hourly_rate: preview.hourlyRate,
          calc_original_paid_hours: preview.origPaid,
          calc_corrected_paid_hours: preview.corrPaid,
          calc_original_late_mins: preview.origLate,
          calc_corrected_late_mins: preview.corrLate,
          calc_original_shift_found: preview.originalShiftFound,
          calc_recorded_late_deduction: preview.recordedLateDeduction,
          calc_supposed_late_deduction: preview.supposedLateDeduction,
          calc_late_refund: preview.lateRefund,
          calc_extra_hours_credit: preview.extraHoursCredit,
        }).eq('id', adj.id)
        if (error) throw error
        showToast('✅', `Approved — ${peso(preview.refundAmount)} refund will apply to their next payroll`)
      }
      await fetchAdjustmentRequests()
    } catch(e) {
      showToast('❌', e.message)
    } finally {
      setApproving(null)
    }
  }

  // ── Overtime Requests: preview / approve / reject ─────────────────────────
  // Self-contained rate lookup (mirrors computeAdjustmentPreview above) so this works whether
  // the request's cutoff is the one currently selected on screen or not: prefers the ALREADY
  // SAVED payroll_runs row's required_days for that cutoff+staff when one exists (source of
  // truth once saved), otherwise counts published schedule days for that cutoff directly.
  async function computeOvertimeAmount(req) {
    const cutoff = CUTOFF_PERIODS.find(p => p.id === req.cutoff_id)
    const staffMember = req.staff
    const isFT = (staffMember.employment_type || 'Full-time') === 'Full-time'
    const monthlyPay = staffMember.monthly_pay || getBaseRate(staffMember.employment_type || 'Full-time', staffMember.role, rateOverrides)?.monthly || 0
    const { data: existingRun } = await supabase.from('payroll_runs')
      .select('id, required_days, overtime, net_pay')
      .eq('cutoff_id', req.cutoff_id).eq('staff_id', req.staff_id).maybeSingle()
    let requiredDays = existingRun?.required_days || 0
    if (!requiredDays && cutoff) {
      const { data: sch } = await supabase.from('schedules').select('shift_date')
        .eq('staff_id', req.staff_id).eq('published', true)
        .gte('shift_date', cutoff.start).lte('shift_date', cutoff.end)
      requiredDays = new Set((sch || []).map(s => s.shift_date)).size
    }
    const dailyRate = (isFT && requiredDays > 0 && monthlyPay > 0)
      ? (monthlyPay / 2) / requiredDays
      : getDailyRate(staffMember.employment_type || 'Full-time', staffMember.role, rateOverrides)
    const hourlyRate = round2(dailyRate / 8)
    // Pay is computed from what the employee actually submitted as worked, NOT what
    // management originally requested — the request is only a target/expectation.
    const amount = round2(hourlyRate * (parseFloat(req.actual_hours) || 0))
    return { hourlyRate, amount, cutoffLabel: cutoff?.label, existingRun }
  }

  async function previewOvertime(req) {
    setOtPreviewing(req.id)
    try {
      const result = await computeOvertimeAmount(req)
      setOtPreviews(p => ({ ...p, [req.id]: result }))
      setOtAmounts(p => (p[req.id] !== undefined ? p : { ...p, [req.id]: result.amount }))
    } catch (e) {
      showToast('❌', 'Preview failed: ' + e.message)
    }
    setOtPreviewing(null)
  }

  // Rejecting the SUBMITTED period is a dead end — no auto-retry. Management would create a
  // brand new request if the overtime still needs to be covered.
  async function rejectOvertime(req) {
    const note = otReviewNotes[req.id] || ''
    if (!confirm(`Reject ${req.staff?.first_name}'s submitted overtime period? This closes the request — they'd need a new request to try again.`)) return
    const { error } = await supabase.from('overtime_requests').update({
      status: 'rejected', review_note: note, reviewed_by: currentStaffId,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (error) { showToast('❌', error.message); return }
    notifyOne(req.staff_id, {
      type: 'overtime_rejected',
      title: '⏰ Overtime Rejected',
      message: `Your submitted ${req.actual_hours}h overtime for ${new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} (${req.cutoff_label}) was rejected${note ? ': ' + note : '.'}`,
    }).catch(() => {})
    await fetchOvertimeRequests()
    showToast('✋', 'Overtime request rejected')
  }

  async function approveOvertime(req) {
    setOtApproving(req.id)
    const note = otReviewNotes[req.id] || ''
    const cutoff = CUTOFF_PERIODS.find(p => p.id === req.cutoff_id)
    try {
      const preview = otPreviews[req.id] || await computeOvertimeAmount(req)
      const finalAmount = round2(parseFloat(otAmounts[req.id] ?? preview.amount) || 0)

      if (preview.existingRun) {
        // This cutoff's payroll is already saved (and its Overtime field is locked in the
        // Payslips tab) — patch the saved row directly so the money lands on THIS cutoff's
        // payslip, not whichever one happens to be open next.
        const newOvertime = round2((parseFloat(preview.existingRun.overtime) || 0) + finalAmount)
        const newNetPay = round2((parseFloat(preview.existingRun.net_pay) || 0) + finalAmount)
        const { error: runError } = await supabase.from('payroll_runs').update({
          overtime: newOvertime, net_pay: newNetPay, updated_at: new Date().toISOString(),
        }).eq('id', preview.existingRun.id)
        if (runError) throw runError
        const { error } = await supabase.from('overtime_requests').update({
          status: 'approved', hourly_rate: preview.hourlyRate, amount: finalAmount,
          applied: true, applied_cutoff_id: req.cutoff_id, applied_at: new Date().toISOString(),
          review_note: note, reviewed_by: currentStaffId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', req.id)
        if (error) throw error
        await fetchSavedRuns()
        showToast('✅', `Approved — ${peso(finalAmount)} added directly to their saved ${cutoff?.label || ''} payslip`)
      } else {
        const { error } = await supabase.from('overtime_requests').update({
          status: 'approved', hourly_rate: preview.hourlyRate, amount: finalAmount,
          review_note: note, reviewed_by: currentStaffId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', req.id)
        if (error) throw error
        showToast('✅', `Approved — ${peso(finalAmount)} will be added to ${cutoff?.label || 'their'} payroll on Save`)
      }
      notifyOne(req.staff_id, {
        type: 'overtime_approved',
        title: '⏰ Overtime Approved ✅',
        message: `Your ${req.actual_hours}h overtime for ${new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} was approved — ${peso(finalAmount)} on your ${cutoff?.label || ''} payslip.`,
      }).catch(() => {})
      await fetchOvertimeRequests()
    } catch(e) {
      showToast('❌', e.message)
    } finally {
      setOtApproving(null)
    }
  }

  function exportCSV() {
    const rows = buildPayrollRows()
    const data = [
      ['Name','Role','Type','Days','Paid Hours','Late (mins)','Basic (Gross)','Additional Payment (Extra Shifts)','Late Deduction','SSS','PhilHealth','Pag-IBIG','Tax','Total Deductions','Service Charge','Net Pay','SC Eligible'],
      ...rows.map(r => [`${r.staff.last_name}, ${r.staff.first_name}`,r.staff.role,r.staff.employment_type||'Full-time',r.pay.daysWorked,r.pay.paidHours.toFixed(2),r.pay.totalLateMins,r.pay.gross,r.pay.additionalPayment||0,r.pay.lateDeduction,r.pay.sss,r.pay.philhealth,r.pay.pagibig,r.pay.tax,r.pay.totalDeductions,parseFloat(r.saved?.service_charge)||0,r.pay.netPay,r.pay.eligible?'Yes':'No'])
    ]
    const csv = data.map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`OHT-Payroll-${selectedCutoff.label.replace(/\s/g,'-')}.csv`; a.click()
    URL.revokeObjectURL(url)
    showToast('📥','Payroll exported')
  }

  // ── SERVICE CHARGE: aggregate hours + lates across the WHOLE month, eligibility is all-or-nothing ──
  // Eligibility is judged on the month as a whole — total lates from the start of the month to the
  // end (summed across both of that month's cutoffs), not per-cutoff. Someone with 7 lates in the
  // first half and 3 in the second half has 10 lates that month and is NOT eligible at all, even
  // though one of the two cutoffs individually looked fine. If eligible, ALL their hours that
  // month count; if not, NONE of their hours count (not just the excess).
  const serviceChargeRows = useMemo(() => {
    const byStaff = {}
    scRuns.forEach(r => {
      // Ownership/management roles (CEO, Managing Director) aren't part of the service charge
      // pool at all — it's for rank-and-file staff, not the owners running the business.
      if (SC_EXCLUDED_ROLES.includes(r.staff?.role)) return
      const id = r.staff_id
      if (!byStaff[id]) byStaff[id] = { staff: r.staff, totalHours: 0, totalLateCount: 0, violationCount: r.staff?.violation_count || 0 }
      byStaff[id].totalHours += parseFloat(r.paid_hours) || 0
      byStaff[id].totalLateCount += parseInt(r.late_count) || 0
    })
    const eligibleHours = {}
    Object.keys(byStaff).forEach(id => {
      const v = byStaff[id]
      v.eligible = isServiceChargeEligible(v.totalLateCount, v.violationCount)
      if (v.eligible) eligibleHours[id] = v.totalHours
    })
    const { ratePerHour, shares } = computeServiceChargeShares(serviceChargePool, eligibleHours)
    return { ratePerHour, shares, byStaff }
  }, [serviceChargePool, scRuns])

  async function saveServiceCharge() {
    if (!scRuns.length) { showToast('⚠️','Save Payroll for at least one cutoff in this month first — Service Charge needs paid hours on record.'); return }
    if (!scTargetCutoffId) { showToast('⚠️','No cutoff available yet to apply this to — check next month\'s cutoff periods.'); return }
    // The target is next month's first cutoff, NOT one of this month's cutoffs — it needs its
    // own Save Payroll done before it can carry a service_charge value (never create a phantom row).
    const existingTargetPairs = new Set(scTargetRuns.filter(r => r.cutoff_id === scTargetCutoffId).map(r => r.staff_id))
    if (!existingTargetPairs.size) {
      const targetLabel = CUTOFF_PERIODS.find(c=>c.id===scTargetCutoffId)?.label || ''
      showToast('⚠️', `Save Payroll for ${targetLabel} first — Service Charge needs to land on an existing payroll run.`)
      return
    }
    setScSaving(true)
    // cutoff_id, cutoff_label, cutoff_start, cutoff_end are all NOT NULL on payroll_runs with no
    // default — include them even though we only expect to hit existing rows, so an upsert can
    // never crash on that constraint if the existence check below is ever wrong.
    const targetCutoff = CUTOFF_PERIODS.find(c => c.id === scTargetCutoffId)
    const upsertData = []
    let skipped = 0
    Object.keys(serviceChargeRows.byStaff).forEach(staffId => {
      // Only write into the target cutoff if it already has a saved payroll_runs row for this
      // staff — never create a phantom row just to carry a service_charge value.
      if (!existingTargetPairs.has(staffId)) { skipped++; return }
      upsertData.push({
        cutoff_id: scTargetCutoffId, cutoff_label: targetCutoff?.label, cutoff_start: targetCutoff?.start, cutoff_end: targetCutoff?.end,
        staff_id: staffId,
        service_charge: serviceChargeRows.shares[staffId] || 0,
      })
    })
    const { error } = await supabase.from('payroll_runs').upsert(upsertData, { onConflict:'cutoff_id,staff_id' })
    setScSaving(false)
    if (error) { showToast('❌', error.message); return }
    await fetchSavedRuns(); await fetchScMonthData()
    const targetLabel = CUTOFF_PERIODS.find(c=>c.id===scTargetCutoffId)?.label || ''
    showToast('💾', `Service Charge for ${scMonth} saved to ${targetLabel}${skipped?` · ${skipped} staff skipped (no payroll run there yet)`:''}`)
  }

  const allPayrollRows = buildPayrollRows()

  // Sort payroll rows
  const payrollRows = useMemo(() => {
    return [...allPayrollRows].sort((a, b) => {
      let av, bv
      if (sortKey === 'name') {
        av = `${a.staff.last_name} ${a.staff.first_name}`.toLowerCase()
        bv = `${b.staff.last_name} ${b.staff.first_name}`.toLowerCase()
      } else if (sortKey === 'role') {
        av = (a.staff.role || '').toLowerCase()
        bv = (b.staff.role || '').toLowerCase()
      } else if (sortKey === 'employment_type') {
        av = (a.staff.employment_type || '').toLowerCase()
        bv = (b.staff.employment_type || '').toLowerCase()
      } else if (sortKey === 'gross') {
        av = a.pay.gross; bv = b.pay.gross
      } else if (sortKey === 'deductions') {
        av = a.pay.totalDeductions; bv = b.pay.totalDeductions
      } else if (sortKey === 'net') {
        av = a.pay.netPay; bv = b.pay.netPay
      } else {
        av = ''; bv = ''
      }
      const cmp = typeof av === 'number' ? av - bv : av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allPayrollRows, sortKey, sortDir])

  const totals = payrollRows.reduce((acc,r)=>{
    const type = r.staff.employment_type || 'Full-time'
    return {
      gross:acc.gross+r.pay.gross,
      additionalPayment:acc.additionalPayment+(r.pay.additionalPayment||0),
      deductions:acc.deductions+r.pay.totalDeductions,
      net:acc.net+r.pay.netPay,
      lateDeduction:acc.lateDeduction+r.pay.lateDeduction,
      sss:acc.sss+r.pay.sss,
      philhealth:acc.philhealth+r.pay.philhealth,
      pagibig:acc.pagibig+r.pay.pagibig,
      tax:acc.tax+r.pay.tax,
      sssEmployer:acc.sssEmployer+(r.pay.sssEmployer||0),
      philhealthEmployer:acc.philhealthEmployer+(r.pay.philhealthEmployer||0),
      pagibigEmployer:acc.pagibigEmployer+(r.pay.pagibigEmployer||0),
      fullTimeNet:acc.fullTimeNet+(type==='Full-time' ? r.pay.netPay : 0),
      freelanceNet:acc.freelanceNet+(type==='Freelancer' ? r.pay.netPay : 0),
      partTimeNet:acc.partTimeNet+(type==='Part-time' ? r.pay.netPay : 0),
    }
  },{gross:0,additionalPayment:0,deductions:0,net:0,lateDeduction:0,sss:0,philhealth:0,pagibig:0,tax:0,sssEmployer:0,philhealthEmployer:0,pagibigEmployer:0,fullTimeNet:0,freelanceNet:0,partTimeNet:0})

  const hasSavedData = savedRuns.length > 0
  const hasLiveData  = !!timesheetData
  // Timesheet to display: live in-session upload takes priority, else the saved archive
  const tsSource = timesheetData || (savedTimesheet ? savedTimesheet.employees : null)
  const tsIsLive = !!timesheetData
  const iStyle = {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',cursor:'pointer'}
  const thBase = {padding:'11px 12px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)',whiteSpace:'nowrap'}
  const monthCutoffOptions = cutoffsForMonth(nextMonthStr(scMonth))

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Payroll</div>
          <div className="topbar-sub">
            {selectedCutoff.label} · {staff.length} staff
            {hasLiveData && <span style={{color:'var(--matcha-dark)',fontWeight:600}}> · Timesheet loaded ✓</span>}
            {!hasLiveData && hasSavedData && <span style={{color:'var(--sky)',fontWeight:600}}> · Saved ✓</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
            📂 Upload Timesheet <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleTimesheetUpload}/>
          </label>
          {hasLiveData&&<button className="btn btn-primary" onClick={savePayroll} disabled={saving} style={{background:'var(--matcha)'}}>{saving?'💾 Saving…':'💾 Save Payroll'}</button>}
          {(hasLiveData||hasSavedData)&&<button className="btn btn-secondary" onClick={exportCSV}>↓ Export CSV</button>}
          {hasSavedData&&!hasLiveData&&<button onClick={deleteCutoff} style={{background:'#fdeaea',color:'#c0392b',border:'1px solid #f5c6c644',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>🗑 Delete Cutoff</button>}
        </div>
      </div>

      <div className="page-content">
        {/* Cutoff selector */}
        <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)'}}>Cutoff Period:</span>
          <select style={iStyle} value={selectedCutoff.id} onChange={e=>{setSelectedCutoff(CUTOFF_PERIODS.find(p=>p.id===parseInt(e.target.value)));setTimesheetData(null)}}>
            {CUTOFF_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {hasLiveData ? (
            <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'var(--matcha-dark)',fontWeight:600}}>✓ Timesheet loaded — review and Save Payroll</div>
          ) : hasSavedData ? (
            <div style={{background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'var(--sky)',fontWeight:600}}>✓ Saved payroll — upload new timesheet to recompute</div>
          ) : (
            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'#a06000',fontWeight:500}}>💡 Upload a StoreHub timesheet to compute payroll</div>
          )}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'2px solid var(--border)'}}>
          {[['summary','📊 Summary'],['timesheets','📋 Timesheets'],['payslips','🧾 Payslips'],['servicecharge','🍽️ Service Charge'],['payments','💵 Payment Status'],['adjustments',`⏱️ Adjustments${adjustmentRequests.filter(a=>a.status==='pending').length>0?` (${adjustmentRequests.filter(a=>a.status==='pending').length})`:''}`],['overtime',`⏰ Overtime${otRequests.filter(o=>o.status==='submitted').length>0?` (${otRequests.filter(o=>o.status==='submitted').length})`:''}`],['audit','🔍 Accuracy Check']].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{background:'transparent',border:'none',borderBottom:tab===key?'2px solid var(--matcha)':'2px solid transparent',marginBottom:-2,padding:'9px 16px',fontSize:12,fontWeight:tab===key?700:500,color:tab===key?'var(--matcha-dark)':'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{label}</button>
          ))}
        </div>

        {tab==='summary' && (<>
        {/* KPIs */}
        <div className="kpi-grid" style={{marginBottom:16}}>
          {[
            {label:'Total Gross (Basic)',value:peso(totals.gross),cls:'c-matcha',icon:'💰'},
            {label:'Additional Payments (Extra Shifts)',value:peso(totals.additionalPayment),cls:'c-sky',icon:'➕'},
            {label:'Total Deductions',value:peso(totals.deductions),cls:'c-blush',icon:'📉'},
            {label:'Total Net Pay',value:peso(totals.net),cls:'c-gold',icon:'💸'},
            {label:'Staff on Payroll',value:`${payrollRows.filter(r=>r.pay.daysWorked>0).length} / ${staff.length}`,cls:'c-bark',icon:'👥'},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Deduction breakdown */}
        <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px',marginBottom:16,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {[['Late Deductions',totals.lateDeduction,'#c0392b'],['SSS',totals.sss,'#2d5a8a'],['PhilHealth',totals.philhealth,'#2d7a6a'],['Pag-IBIG + Tax',totals.pagibig+totals.tax,'#8e44ad']].map(([label,val,color])=>(
            <div key={label} style={{textAlign:'center',padding:10,background:'var(--surface)',borderRadius:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color}}>{peso(val)}</div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>{label}</div>
            </div>
          ))}
        </div>

        {/* Payroll Summary */}
        <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px',marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13,color:'var(--text-primary)',marginBottom:12}}>Payroll Summary — {selectedCutoff.label}</div>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>By Employment Type</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
            {[
              ['Full-time Net Salary', totals.fullTimeNet, '#2d7a6a'],
              ['Part-time Salary', totals.partTimeNet, '#4a90c4'],
              ['Freelance Salary', totals.freelanceNet, '#b06af5'],
            ].map(([label,val,color])=>(
              <div key={label} style={{textAlign:'center',padding:10,background:'var(--surface)',borderRadius:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color}}>{peso(val)}</div>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>Government Contributions (Full-time only)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              ['SSS — Employer', totals.sssEmployer, '#2d5a8a'],
              ['SSS — Employee', totals.sss, '#2d5a8a'],
              ['PhilHealth — Employer', totals.philhealthEmployer, '#2d7a6a'],
              ['PhilHealth — Employee', totals.philhealth, '#2d7a6a'],
              ['Pag-IBIG — Employer', totals.pagibigEmployer, '#8e44ad'],
              ['Pag-IBIG — Employee', totals.pagibig, '#8e44ad'],
            ].map(([label,val,color])=>(
              <div key={label} style={{textAlign:'center',padding:10,background:'var(--surface)',borderRadius:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color}}>{peso(val)}</div>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:9,color:'var(--text-muted)',marginTop:12,fontStyle:'italic'}}>
            PhilHealth and Pag-IBIG employer shares mirror the employee shares (even split). SSS employer share is approximated from the employee amount using the official 9.5%/4.5% contribution ratio — verify against the official SSS table if this needs to be audit-exact.
          </div>
        </div>

        {/* Table */}
        <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'var(--espresso)'}}>
                <SortTh label="Employee"    colKey="name"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Role"        colKey="role"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Type"        colKey="employment_type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th style={thBase}>Days</th>
                <th style={thBase}>Hrs</th>
                <th style={thBase}>Late</th>
                <SortTh label="Gross"       colKey="gross"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th style={thBase}>Additional Pay</th>
                <SortTh label="Deductions"  colKey="deductions"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Net Pay"     colKey="net"             sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th style={thBase}>SVC</th>
                <th style={thBase}></th>
              </tr>
            </thead>
            <tbody>
              {payrollRows.map((r,i)=>(
                <tr key={r.staff.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--matcha-pale)'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--white)':'var(--surface)'}>
                  <td style={{padding:'9px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(r.staff.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>
                        {initials(r.staff.first_name,r.staff.last_name)}
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:11}}>{r.staff.last_name}, {r.staff.first_name}</div>
                        {r.staff.nickname&&<div style={{fontSize:9,color:'var(--text-muted)'}}>"{r.staff.nickname}"</div>}
                      </div>
                      {r.saved&&!r.isLive&&<span style={{fontSize:8,background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',padding:'1px 4px',borderRadius:4,fontWeight:600}}>Saved</span>}
                    </div>
                  </td>
                  <td style={{padding:'9px 12px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5,background:getRoleColor(r.staff.role)+'22',color:getRoleColor(r.staff.role)}}>{r.staff.role}</span></td>
                  <td style={{padding:'9px 12px',fontSize:10,color:'var(--text-muted)'}}>{r.staff.employment_type||'Full-time'}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{r.pay.daysWorked}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontSize:11}}>{r.pay.paidHours.toFixed(1)}h</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontSize:11,color:r.pay.totalLateMins>0?'#c0392b':'var(--text-muted)'}}>{r.pay.totalLateMins>0?`${r.pay.totalLateMins}m`:'—'}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--matcha-dark)',fontSize:11}}>{peso(r.pay.gross)}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600,color:r.pay.additionalPayment>0?'var(--sky)':'var(--text-muted)',fontSize:11}}>{r.pay.additionalPayment>0?peso(r.pay.additionalPayment):'—'}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",color:'#c0392b',fontSize:11}}>-{peso(r.pay.totalDeductions)}</td>
                  <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12}}>{peso(r.pay.netPay)}</td>
                  <td style={{padding:'9px 12px',fontSize:13}}>{r.pay.eligible?'✅':'❌'}</td>
                  <td style={{padding:'9px 12px'}}>
                    {r.saved && (
                      <button onClick={()=>deleteRun(r.saved.id,`${r.staff.last_name}, ${r.staff.first_name}`)}
                        style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:13}}
                        onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:'var(--espresso)',borderTop:'2px solid var(--matcha)'}}>
                <td colSpan={6} style={{padding:'11px 12px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totals.gross)}</td>
                <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--sky)'}}>{peso(totals.additionalPayment)}</td>
                <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#f5a0a0'}}>-{peso(totals.deductions)}</td>
                <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672',fontSize:13}}>{peso(totals.net)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>)}

        {tab==='timesheets' && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Uploaded Timesheet</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                  {selectedCutoff.label}{tsSource?` · ${Object.keys(tsSource).length} employees`:''}{tsSource?(tsIsLive?' · live upload (unsaved)':` · saved${savedTimesheet?.uploadedAt?' '+new Date(savedTimesheet.uploadedAt).toLocaleDateString():''}`):''}
                </div>
              </div>
              {tsSource && tsIsLive && <span style={{fontSize:10,background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'1px solid var(--matcha)',padding:'3px 8px',borderRadius:6,fontWeight:700}}>LIVE</span>}
            </div>
            {!tsSource ? (
              <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                No timesheet stored for {selectedCutoff.label}.<br/>
                <span style={{fontSize:11}}>Upload a StoreHub CSV and Save Payroll to archive it here. (Cutoffs saved before this feature won't have a stored timesheet until re-uploaded.)</span>
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'var(--espresso)'}}>
                    <th style={{...thBase}}>Employee</th>
                    <th style={{...thBase,textAlign:'center'}}>Shifts</th>
                    <th style={{...thBase,textAlign:'right'}}>Raw Hrs</th>
                    <th style={{...thBase,textAlign:'right'}}>Paid Hrs</th>
                    <th style={{...thBase,textAlign:'right'}}>Late</th>
                    <th style={{...thBase,textAlign:'center'}}>Absent</th>
                    <th style={{...thBase,textAlign:'center'}}>Match</th>
                    <th style={{...thBase,width:24}}></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tsSource).sort((a,b)=>(a[1].lastName||'').localeCompare(b[1].lastName||'')).map(([key,ts])=>{
                    // Only show shifts that fall within the selected cutoff window
                    const matchedStaff = matchStaff(staff, ts.lastName, ts.firstName)
                    // Correct late-minutes against each date's ACTUAL published shift, same as payroll
                    // computation, so this view never shows a different "late" number than what's charged.
                    const rawShifts = applyScheduleToLateMinutes(
                      filterShiftsByPeriod(ts.shifts||[], selectedCutoff.start, selectedCutoff.end),
                      matchedStaff?.id, schedules
                    )
                    // Merge in approved-but-not-yet-applied Timesheet Adjustments for this cutoff, same
                    // as payroll computation does, so an approved correction shows here immediately
                    // instead of only becoming visible after the next Save Payroll bakes it in.
                    const corrections = matchedStaff ? pendingCorrectionsFor(matchedStaff.id) : []
                    const shifts = corrections.length ? applyAdjustmentsToShifts(rawShifts, corrections) : rawShifts
                    const correctedDates = new Set(corrections.map(c => isoToMMDDYYYY(c.shift_date)))
                    const rawTot = shifts.reduce((s,x)=>s+(x.rawHours||0),0)
                    const paidTot = shifts.reduce((s,x)=>s+(x.paidHours||0),0)
                    const lateTot = shifts.reduce((s,x)=>s+(x.lateMinutes||0),0)
                    const matched = !!matchedStaff
                    const abs = matchedStaff ? computeAbsences(matchedStaff, ts) : { noShow:[], excused:[], total:0 }
                    const isOpen = expandedEmp===key
                    return (
                      <React.Fragment key={key}>
                        <tr onClick={()=>setExpandedEmp(isOpen?null:key)} style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:isOpen?'var(--matcha-pale)':'transparent'}}>
                          <td style={{padding:'9px 12px',fontWeight:600,fontSize:11}}>{ts.lastName}, {ts.firstName}<div style={{fontSize:9,color:'var(--text-muted)',fontWeight:400}}>{ts.email}</div></td>
                          <td style={{padding:'9px 12px',textAlign:'center',fontFamily:"'DM Mono',monospace"}}>{shifts.length}</td>
                          <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",color:'var(--text-muted)'}}>{rawTot.toFixed(1)}h</td>
                          <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--matcha-dark)'}}>{paidTot.toFixed(1)}h</td>
                          <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",color:lateTot>0?'#c0392b':'var(--text-muted)'}}>{lateTot>0?`${lateTot}m`:'—'}</td>
                          <td style={{padding:'9px 12px',textAlign:'center',fontFamily:"'DM Mono',monospace",fontSize:11}}>
                            {abs.total>0 ? <span style={{color:'#c0392b',fontWeight:700}}>{abs.total}</span> : <span style={{color:'var(--text-muted)'}}>—</span>}
                            {abs.excused.length>0 && <span style={{color:'var(--text-muted)',fontSize:9}}> (+{abs.excused.length})</span>}
                          </td>
                          <td style={{padding:'9px 12px',textAlign:'center',fontSize:13}}>{matched?'✅':'⚠️'}</td>
                          <td style={{padding:'9px 12px',textAlign:'center',color:'var(--text-muted)'}}>{isOpen?'▼':'▶'}</td>
                        </tr>
                        {isOpen && (
                          <tr style={{background:'var(--surface)'}}>
                            <td colSpan={8} style={{padding:'4px 16px 12px'}}>
                              {(abs.total>0||abs.excused.length>0) && (
                                <div style={{margin:'6px 0 10px',fontSize:10}}>
                                  {abs.total>0 && <div style={{color:'#c0392b',fontWeight:600,marginBottom:2}}>⚠️ No-show (scheduled, didn't clock in): {abs.noShow.join(', ')}</div>}
                                  {abs.excused.length>0 && <div style={{color:'var(--text-muted)'}}>✓ Excused (approved leave/day-off): {abs.excused.join(', ')}</div>}
                                </div>
                              )}
                              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                                <thead>
                                  <tr style={{borderBottom:'1px solid var(--border)'}}>
                                    <th style={{padding:'6px 8px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Date</th>
                                    <th style={{padding:'6px 8px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Time In</th>
                                    <th style={{padding:'6px 8px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Time Out</th>
                                    <th style={{padding:'6px 8px',textAlign:'right',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Raw</th>
                                    <th style={{padding:'6px 8px',textAlign:'right',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Paid</th>
                                    <th style={{padding:'6px 8px',textAlign:'right',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Late</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {shifts.length===0 ? (
                                    <tr><td colSpan={6} style={{padding:'8px',color:'var(--text-muted)',fontStyle:'italic'}}>No shifts.</td></tr>
                                  ) : shifts.map((sh,si)=>(
                                    <tr key={si} style={{borderBottom:'1px solid var(--border)'}}>
                                      <td style={{padding:'5px 8px',fontFamily:"'DM Mono',monospace"}}>{sh.date}</td>
                                      <td style={{padding:'5px 8px',fontFamily:"'DM Mono',monospace"}}>{sh.timeIn}</td>
                                      <td style={{padding:'5px 8px',fontFamily:"'DM Mono',monospace"}}>{sh.timeOut}</td>
                                      <td style={{padding:'5px 8px',textAlign:'right',fontFamily:"'DM Mono',monospace",color:'var(--text-muted)'}}>{(sh.rawHours||0).toFixed(1)}h</td>
                                      <td style={{padding:'5px 8px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--matcha-dark)'}}>{(sh.paidHours||0).toFixed(1)}h</td>
                                      <td style={{padding:'5px 8px',textAlign:'right',fontFamily:"'DM Mono',monospace",color:sh.lateMinutes>0?'#c0392b':'var(--text-muted)'}}>{sh.lateMinutes>0?`${sh.lateMinutes}m`:'—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab==='payslips' && (
          <div>
            {!hasSavedData && !hasLiveData ? (
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'40px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                No payslips for {selectedCutoff.label}.<br/>
                <span style={{fontSize:11}}>Upload a timesheet and Save Payroll to generate payslips.</span>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
                {payrollRows.filter(r=>{
                  const scheduledCount = schedules.filter(s=>s.staff_id===r.staff.id).length
                  return r.pay.daysWorked>0 || scheduledCount>0
                }).map(r=>{
                  const tsKey = tsSource ? Object.keys(tsSource).find(k=>matchStaff([r.staff], tsSource[k].lastName, tsSource[k].firstName)!==undefined) : null
                  const tsForStaff = tsKey ? tsSource[tsKey] : null
                  const abs = computeAbsences(r.staff, tsForStaff)
                  const isLocked = !!r.saved   // editable only before first save
                  const adj = adjustments[r.staff.id] || {}
                  const incentives = isLocked ? (parseFloat(r.saved.incentives)||0) : (parseFloat(adj.incentives)||0)
                  const overtime   = isLocked ? (parseFloat(r.saved.overtime)||0)   : (parseFloat(adj.overtime)||0)
                  const refund     = isLocked ? (parseFloat(r.saved.refund)||0)     : (parseFloat(adj.refund)||0)
                  const undertime  = isLocked ? (parseFloat(r.saved.undertime)||0)  : (parseFloat(adj.undertime)||0)
                  const serviceCharge = isLocked ? (parseFloat(r.saved.service_charge)||0) : 0
                  const isFT = (r.staff.employment_type||'Full-time')==='Full-time'
                  const additionalPayment = r.pay.additionalPayment || 0
                  const grossPay = r.pay.gross + additionalPayment + incentives + overtime + refund + serviceCharge
                  const govDed = r.pay.sss + r.pay.philhealth + r.pay.pagibig + r.pay.tax
                  // For full-time, unpaid missed days are already excluded from gross (rate × daysWorked),
                  // so absence is NOT subtracted again here. Late/undertime still apply.
                  const netPay = Math.max(0, grossPay - govDed - r.pay.lateDeduction - undertime)
                  const setAdj = (field,val) => setAdjustments(prev => ({...prev, [r.staff.id]: {...(prev[r.staff.id]||{}), [field]: val}}))
                  return (
                  <div key={r.staff.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                    <div style={{background:'var(--espresso)',padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:30,height:30,borderRadius:'50%',background:getRoleColor(r.staff.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{initials(r.staff.first_name,r.staff.last_name)}</div>
                      <div style={{flex:1}}>
                        <div style={{color:'var(--cream)',fontWeight:700,fontSize:12}}>{r.staff.last_name}, {r.staff.first_name}</div>
                        <div style={{color:'var(--matcha-light)',fontSize:9}}>{r.staff.role} · {r.staff.employment_type||'Full-time'}</div>
                      </div>
                      {abs.total>0 && <span title={`No-show: ${abs.noShow.join(', ')}`} style={{fontSize:9,background:'#fdeaea',color:'#c0392b',border:'1px solid #f5c6c6',padding:'2px 7px',borderRadius:10,fontWeight:700,whiteSpace:'nowrap'}}>⚠️ {abs.total} absent</span>}
                    </div>
                    <div style={{padding:'12px 16px'}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:8}}>{selectedCutoff.label}</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--surface)',borderRadius:8,padding:'6px 10px',marginBottom:8}}>
                        <span style={{fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:'uppercase',color:'var(--text-muted)'}}>Rate</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:'var(--matcha-dark)'}}>{peso(r.pay.dailyRate)}/day · {peso(r.pay.hourlyRate)}/hr</span>
                      </div>
                      {[['Days Worked',`${r.pay.daysWorked}`],['Paid Hours',`${r.pay.paidHours.toFixed(1)}h`],['Late',r.pay.totalLateMins>0?`${r.pay.totalLateMins}m`:'—']].map(([l,v])=>(
                        <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',color:'var(--text-secondary)'}}><span>{l}</span><span style={{fontFamily:"'DM Mono',monospace"}}>{v}</span></div>
                      ))}
                      {(abs.total>0||abs.excused.length>0) && (
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',color:'var(--text-secondary)'}}>
                          <span>Absences</span>
                          <span style={{fontFamily:"'DM Mono',monospace"}}>
                            {abs.total>0 && <span style={{color:'#c0392b',fontWeight:600}}>{abs.total} no-show</span>}
                            {abs.total>0 && abs.excused.length>0 && ' · '}
                            {abs.excused.length>0 && <span style={{color:'var(--text-muted)'}}>{abs.excused.length} excused</span>}
                          </span>
                        </div>
                      )}
                      <div style={{borderTop:'1px solid var(--border)',margin:'8px 0',paddingTop:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0',fontWeight:600}}><span>Basic {isFT?`(${r.pay.basicPayDays??Math.min(r.pay.daysWorked,FULL_TIME_SHIFTS_PER_CUTOFF)}/${FULL_TIME_SHIFTS_PER_CUTOFF} shifts)`:''}</span><span style={{fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)'}}>{peso(r.pay.gross)}</span></div>
                        {/* Extra shifts beyond the full-time 10-shifts-per-cutoff cap — paid, but broken out here instead of folded into Basic */}
                        {isFT && additionalPayment>0 && (
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0',color:'var(--matcha-dark)',fontWeight:600}}>
                            <span>Additional Payment ({r.pay.extraShiftDays} extra shift{r.pay.extraShiftDays===1?'':'s'})</span>
                            <span style={{fontFamily:"'DM Mono',monospace"}}>{peso(additionalPayment)}</span>
                          </div>
                        )}
                        {/* Manual-entry earnings (editable until saved) */}
                        {[['Incentives','incentives',incentives],['Overtime','overtime',overtime],['Refund','refund',refund]].map(([label,field,val])=>(
                          <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,padding:'2px 0',color:'var(--text-muted)'}}>
                            <span>{label}</span>
                            {isLocked
                              ? <span style={{fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)'}}>{peso(val)}</span>
                              : <input type="number" value={adj[field]??''} placeholder="0" onChange={e=>setAdj(field,e.target.value)} style={{width:78,textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:10,border:'1px solid var(--border)',borderRadius:5,padding:'2px 5px',outline:'none'}}/>}
                          </div>
                        ))}
                        {/* Service Charge — auto-computed on the Service Charge tab, not manually editable here */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,padding:'2px 0',color:'var(--text-muted)'}}>
                          <span>Service Charge</span>
                          <span style={{fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)'}}>{peso(serviceCharge)}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',fontWeight:600,borderTop:'1px solid var(--cream-dark)',marginTop:3}}><span>Gross Pay</span><span style={{fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)'}}>{peso(grossPay)}</span></div>
                        {[['SSS',r.pay.sss],['PhilHealth',r.pay.philhealth],['Pag-IBIG',r.pay.pagibig],['Tax',r.pay.tax],['Late',r.pay.lateDeduction]].map(([l,v])=>(
                          <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0',color:'var(--text-muted)'}}><span>{l}</span><span style={{fontFamily:"'DM Mono',monospace",color:'#c0392b'}}>-{peso(v)}</span></div>
                        ))}
                        {/* Undertime (editable until saved) */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,padding:'2px 0',color:'var(--text-muted)'}}>
                          <span>Undertime</span>
                          {isLocked
                            ? <span style={{fontFamily:"'DM Mono',monospace",color:'#c0392b'}}>-{peso(undertime)}</span>
                            : <input type="number" value={adj.undertime??''} placeholder="0" onChange={e=>setAdj('undertime',e.target.value)} style={{width:78,textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:10,border:'1px solid var(--border)',borderRadius:5,padding:'2px 5px',outline:'none'}}/>}
                        </div>
                        {/* Absence is informational for full-time: unpaid missed days already excluded from Basic. */}
                        {isFT ? (
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'2px 0',color:'var(--text-muted)',fontStyle:'italic'}}><span>Scheduled {r.pay.requiredDays}d · worked {r.pay.daysWorked}d{abs.total>0?` · ${abs.total} unpaid`:''}</span><span></span></div>
                        ) : null}
                      </div>
                      {r.pay.noSchedule && (
                        <div style={{background:'#fdeaea',border:'1px solid #f5c6c6',borderRadius:8,padding:'6px 10px',fontSize:10,color:'#c0392b',fontWeight:600,marginTop:6}}>⚠️ No published schedule for this cutoff — publish the roster to compute pay.</div>
                      )}
                      {(r.staff.bank_name||r.staff.bank_account_no) && (
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'3px 0',color:'var(--text-muted)'}}>
                          <span>Deposit to</span><span style={{fontFamily:"'DM Mono',monospace"}}>{r.staff.bank_name||'—'} {r.staff.bank_account_no||''}</span>
                        </div>
                      )}
                      <div style={{borderTop:'2px solid var(--matcha)',paddingTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:11,fontWeight:700}}>NET PAY</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:15,color:'var(--matcha-dark)'}}>{peso(netPay)}</span>
                      </div>
                      <button onClick={()=>downloadPayslip(r)} style={{marginTop:10,width:'100%',background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'8px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>↓ Download PDF</button>
                      {!isLocked && <div style={{fontSize:8,color:'var(--text-muted)',textAlign:'center',marginTop:4}}>Incentives/Refund/Undertime editable until you Save Payroll</div>}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab==='servicecharge' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:4}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Service Charge — Monthly</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="month" value={scMonth} onChange={e=>e.target.value&&setScMonth(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
                  {monthCutoffOptions.length>0 && (
                    <select style={iStyle} value={scTargetCutoffId||''} onChange={e=>setScTargetCutoffId(parseInt(e.target.value))}>
                      {monthCutoffOptions.map(c=><option key={c.id} value={c.id}>Apply to: {c.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14}}>
                Pool is the sum of "Service Charge" entered on Finance &gt; Sales for the whole month of {scMonth}. Eligibility is judged on the WHOLE month (total lates from the 1st cutoff through the last, added together) — more than 3 lates or any violation that month excludes someone entirely, not just the excess. Eligible staff split the pool proportional to their total hours worked that month — then it's paid out as one lump sum on next month's cutoff selected above (once that month's sales are fully in).
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14}}>
                <div style={{textAlign:'center',padding:12,background:'var(--surface)',borderRadius:10}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:700,color:'var(--matcha-dark)'}}>{peso(serviceChargePool)}</div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>Total SC Pool (from Finance)</div>
                </div>
                <div style={{textAlign:'center',padding:12,background:'var(--surface)',borderRadius:10}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:700,color:'var(--matcha-dark)'}}>{serviceChargeRows.ratePerHour ? peso(serviceChargeRows.ratePerHour) : '—'}</div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>Rate per Eligible Hour</div>
                </div>
                <div style={{textAlign:'center',padding:12,background:'var(--surface)',borderRadius:10}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:700,color:'var(--matcha-dark)'}}>{Object.values(serviceChargeRows.byStaff).filter(v=>v.eligible).length} / {Object.keys(serviceChargeRows.byStaff).length}</div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>Eligible Staff</div>
                </div>
              </div>
              {!scRuns.length ? (
                <div style={{background:'#fef3e2',border:'1px solid var(--gold)',borderRadius:8,padding:'8px 12px',fontSize:11,color:'#a06000',fontWeight:600}}>💡 No saved payroll found for {scMonth} yet — Save Payroll for at least one of that month's cutoffs first (Cutoff Period selector above), then come back here.</div>
              ) : !scTargetRuns.some(r=>r.cutoff_id===scTargetCutoffId) ? (
                <div style={{background:'#fef3e2',border:'1px solid var(--gold)',borderRadius:8,padding:'8px 12px',fontSize:11,color:'#a06000',fontWeight:600}}>💡 {monthCutoffOptions.find(c=>c.id===scTargetCutoffId)?.label || 'The selected payout cutoff'} hasn't had payroll saved yet — Save Payroll for it first, then come back here to apply the Service Charge.</div>
              ) : (
                <button className="btn btn-primary" style={{background:'var(--matcha)'}} onClick={saveServiceCharge} disabled={scSaving}>{scSaving?'💾 Saving…':'💾 Save Service Charge'}</button>
              )}
            </div>

            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'var(--espresso)'}}>
                    <th style={thBase}>Employee</th>
                    <th style={thBase}>Role</th>
                    <th style={{...thBase,textAlign:'center'}}>Eligible</th>
                    <th style={{...thBase,textAlign:'right'}}>Lates (Month)</th>
                    <th style={{...thBase,textAlign:'right'}}>Hours (Month)</th>
                    <th style={{...thBase,textAlign:'right'}}>Service Charge Share</th>
                    <th style={{...thBase,textAlign:'right'}}>Saved on Target Cutoff</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(serviceChargeRows.byStaff).sort((a,b)=>(a[1].staff?.last_name||'').localeCompare(b[1].staff?.last_name||'')).map(([staffId,v],i)=>{
                    const savedRun = scTargetRuns.find(r=>r.staff_id===staffId && r.cutoff_id===scTargetCutoffId)
                    return (
                    <tr key={staffId} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(v.staff?.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>{initials(v.staff?.first_name,v.staff?.last_name)}</div>
                          <div style={{fontWeight:600,fontSize:11}}>{v.staff?.last_name}, {v.staff?.first_name}</div>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5,background:getRoleColor(v.staff?.role)+'22',color:getRoleColor(v.staff?.role)}}>{v.staff?.role}</span></td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontSize:13}} title={`${v.totalLateCount} late(s) this month · ${v.violationCount} violation(s)`}>{v.eligible?'✅':'❌'}</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",color:v.totalLateCount>3?'#c0392b':'var(--text-muted)'}}>{v.totalLateCount}</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace"}}>{v.totalHours.toFixed(1)}h</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-dark)'}}>{v.eligible ? peso(serviceChargeRows.shares[staffId]||0) : '—'}</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)'}}>{savedRun ? peso(parseFloat(savedRun.service_charge)||0) : '—'}</td>
                    </tr>
                  )})}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--espresso)',borderTop:'2px solid var(--matcha)'}}>
                    <td colSpan={5} style={{padding:'11px 12px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                    <td style={{padding:'11px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(Object.values(serviceChargeRows.shares).reduce((s,v)=>s+v,0))}</td>
                    <td style={{padding:'11px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672'}}>{peso(scTargetRuns.filter(r=>r.cutoff_id===scTargetCutoffId).reduce((s,r)=>s+(parseFloat(r.service_charge)||0),0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {tab==='payments' && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Payment Status</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                  {selectedCutoff.label}
                  {hasSavedData ? ` · ${savedRuns.filter(r=>r.paid).length}/${savedRuns.length} paid` : ''}
                </div>
              </div>
              {hasSavedData && savedRuns.some(r=>!r.paid) && (
                <button onClick={markAllPaid} className="btn btn-primary" style={{background:'var(--matcha)'}}>✓ Mark all paid</button>
              )}
            </div>
            {!hasSavedData ? (
              <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                No saved payroll for {selectedCutoff.label}.<br/>
                <span style={{fontSize:11}}>Upload a timesheet and Save Payroll first — payment status appears here once payroll is saved.</span>
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'var(--espresso)'}}>
                    <th style={{...thBase}}>Employee</th>
                    <th style={{...thBase}}>Role</th>
                    <th style={{...thBase,textAlign:'right'}}>Net Pay</th>
                    <th style={{...thBase,textAlign:'center'}}>Status</th>
                    <th style={{...thBase,textAlign:'center'}}>Paid On</th>
                    <th style={{...thBase,textAlign:'center'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...savedRuns].sort((a,b)=>{
                    const an=`${a.staff?.last_name||''} ${a.staff?.first_name||''}`.toLowerCase()
                    const bn=`${b.staff?.last_name||''} ${b.staff?.first_name||''}`.toLowerCase()
                    return an.localeCompare(bn)
                  }).map((r,i)=>(
                    <tr key={r.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(r.staff?.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>
                            {initials(r.staff?.first_name,r.staff?.last_name)}
                          </div>
                          <div style={{fontWeight:600,fontSize:11}}>{r.staff?.last_name}, {r.staff?.first_name}</div>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5,background:getRoleColor(r.staff?.role)+'22',color:getRoleColor(r.staff?.role)}}>{r.staff?.role}</span></td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{peso(r.net_pay)}</td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}>
                        {r.paid
                          ? <span style={{fontSize:10,background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'1px solid var(--matcha)',padding:'2px 8px',borderRadius:10,fontWeight:700}}>✓ Paid</span>
                          : <span style={{fontSize:10,background:'#fdeaea',color:'#c0392b',border:'1px solid #f5c6c6',padding:'2px 8px',borderRadius:10,fontWeight:700}}>Unpaid</span>}
                      </td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—'}</td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}>
                        {r.paid
                          ? <button onClick={()=>togglePaid(r,false)} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-muted)',borderRadius:7,padding:'4px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Undo</button>
                          : <button onClick={()=>togglePaid(r,true)} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:7,padding:'4px 10px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Mark paid</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--espresso)',borderTop:'2px solid var(--matcha)'}}>
                    <td colSpan={2} style={{padding:'11px 12px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                    <td style={{padding:'11px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(savedRuns.reduce((s,r)=>s+parseFloat(r.net_pay||0),0))}</td>
                    <td colSpan={3} style={{padding:'11px 12px',textAlign:'center',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>
                      {peso(savedRuns.filter(r=>r.paid).reduce((s,r)=>s+parseFloat(r.net_pay||0),0))} paid · {peso(savedRuns.filter(r=>!r.paid).reduce((s,r)=>s+parseFloat(r.net_pay||0),0))} outstanding
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {tab==='adjustments' && (
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* Pending */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Pending Requests</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Filed by staff via the Staff Portal — review against the timesheet before approving.</div>
              </div>
              {adjustmentRequests.filter(a=>a.status==='pending').length===0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>No pending adjustment requests.</div>
              ) : (
                <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
                  {adjustmentRequests.filter(a=>a.status==='pending').map(adj=>{
                    const s = adj.staff || {}
                    return (
                      <div key={adj.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',background:'var(--surface)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                              <div style={{fontSize:10,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginTop:1}}>
                                <span>{s.role}</span>
                                <span style={{display:'flex',alignItems:'center',gap:4}}>
                                  <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5}}>Payroll:</span>
                                  <select
                                    value={String(adj.cutoff_id)}
                                    onChange={e=>updateAdjustmentCutoff(adj, e.target.value)}
                                    title="Which payroll cutoff this adjustment's correction/refund applies to"
                                    style={{fontSize:10,fontWeight:700,color:'var(--text-primary)',background:'var(--white)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 6px',fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}
                                  >
                                    {CUTOFF_PERIODS.map(p=><option key={p.id} value={String(p.id)}>{p.label}</option>)}
                                  </select>
                                </span>
                              </div>
                            </div>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:8,background:'#fef3e2',color:'#a06000'}}>{ISSUE_LABELS[adj.issue_type]||adj.issue_type}</span>
                        </div>
                        <div style={{marginTop:10,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,fontSize:11}}>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Date / Shift</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{new Date(adj.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} · {SHIFT_LABELS[adj.shift_type]||adj.shift_type||'—'}</div></div>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Claimed Time-in</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{adj.claimed_time_in||'—'}</div></div>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Claimed Time-out</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{adj.claimed_time_out||'—'}</div></div>
                        </div>
                        {adj.reason && <div style={{marginTop:8,fontSize:11,color:'var(--text-primary)',background:'var(--white)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px'}}>"{adj.reason}"</div>}

                        {previews[adj.id] && (
                          previews[adj.id].type === 'timesheet_correction' ? (
                            <div style={{marginTop:10,background:'#eef6f2',border:'1px solid var(--matcha)',borderRadius:8,padding:'8px 10px',fontSize:11,color:'var(--matcha-dark)'}}>
                              This cutoff hasn't been saved yet — no refund needed. Approving just corrects the timesheet automatically the next time payroll for {previews[adj.id].cutoffLabel} is computed/saved.
                            </div>
                          ) : (
                            <div style={{marginTop:10,background:'#eef6f2',border:'1px solid var(--matcha)',borderRadius:8,padding:'10px 12px'}}>
                              <div style={{fontWeight:700,fontSize:13,color:'var(--matcha-dark)'}}>Estimated refund: {peso(previews[adj.id].refundAmount)}</div>
                              <div style={{marginTop:4,fontSize:10,color:'var(--text-muted)'}}>
                                Clock times: {previews[adj.id].origPaid}h recorded ({previews[adj.id].origLate}m late) → {previews[adj.id].corrPaid}h claimed ({previews[adj.id].corrLate}m late) — for reference only; Basic pay is a flat {peso(previews[adj.id].hourlyRate*8)}/day rate and doesn't change with hours.
                              </div>
                              <div style={{marginTop:4,fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>
                                Late ded. {peso(previews[adj.id].recordedLateDeduction)}→{peso(previews[adj.id].supposedLateDeduction)} (refund {peso(previews[adj.id].lateRefund)}) + hrs credit {peso(previews[adj.id].extraHoursCredit)} = {peso(previews[adj.id].refundAmount)}
                              </div>
                              {previews[adj.id].originalShiftFound===false && (
                                <div style={{marginTop:6,fontSize:10,fontWeight:700,color:'#c0392b'}}>⚠️ Original shift not found in the archived timesheet — this date wasn't counted as a day worked, so this includes a full day's pay outright. Double-check before approving.</div>
                              )}
                            </div>
                          )
                        )}

                        <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <input value={reviewNotes[adj.id]||''} onChange={e=>setReviewNotes(prev=>({...prev,[adj.id]:e.target.value}))} placeholder="Optional note…" style={{flex:1,minWidth:140,background:'var(--white)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
                          <button onClick={()=>previewAdjustment(adj)} disabled={previewing===adj.id} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-muted)',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{previewing===adj.id?'Checking…':(previews[adj.id]?'🔄 Refresh':'👁 Preview Amount')}</button>
                          <button onClick={()=>rejectAdjustment(adj)} disabled={approving===adj.id} style={{background:'transparent',border:'1px solid #f5c6c6',color:'#c0392b',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Reject</button>
                          <button onClick={()=>approveAdjustment(adj)} disabled={approving===adj.id} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:7,padding:'6px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{approving===adj.id?'Approving…':'✓ Approve'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Resolved */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Resolved</div>
              </div>
              {adjustmentRequests.filter(a=>a.status!=='pending').length===0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Nothing resolved yet.</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'var(--espresso)'}}>
                      <th style={thBase}>Employee</th>
                      <th style={thBase}>Cutoff / Date</th>
                      <th style={thBase}>Issue</th>
                      <th style={thBase}>Outcome</th>
                      <th style={thBase}>Note</th>
                      <th style={thBase}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentRequests.filter(a=>a.status!=='pending').map((adj,i)=>{
                      const s = adj.staff || {}
                      const appliedCutoff = CUTOFF_PERIODS.find(p=>p.id===adj.applied_cutoff_id)
                      return (
                        <tr key={adj.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                          <td style={{padding:'9px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:22,height:22,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                              <span style={{fontWeight:600}}>{s.first_name} {s.last_name}</span>
                            </div>
                          </td>
                          <td style={{padding:'9px 12px'}}>{adj.cutoff_label}<br/><span style={{color:'var(--text-muted)',fontSize:10}}>{new Date(adj.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span></td>
                          <td style={{padding:'9px 12px'}}>{ISSUE_LABELS[adj.issue_type]||adj.issue_type}</td>
                          <td style={{padding:'9px 12px'}}>
                            {adj.status==='rejected' ? (
                              <span style={{color:'#c0392b',fontWeight:700}}>✗ Rejected</span>
                            ) : adj.resolution==='timesheet_correction' ? (
                              adj.applied
                                ? <span style={{color:'var(--matcha-dark)',fontWeight:700}}>✓ Timesheet corrected</span>
                                : <span style={{color:'#a06000',fontWeight:700}}>⏳ Will auto-correct on next Save Payroll</span>
                            ) : adj.resolution==='refund' ? (
                              adj.applied ? (
                                adj.paid
                                  ? <span style={{color:'var(--matcha-dark)',fontWeight:700}}>✓ {peso(adj.refund_amount)} paid directly{adj.paid_at?` · ${new Date(adj.paid_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}`:''}</span>
                                  : <span style={{color:'var(--matcha-dark)',fontWeight:700}}>✓ {peso(adj.refund_amount)} applied · {appliedCutoff?.label||''}</span>
                              ) : (
                                <div>
                                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                    <span style={{color:'#a06000',fontWeight:700}}>⏳ {peso(adj.refund_amount)} due — next payroll</span>
                                    <button onClick={()=>markRefundPaid(adj)} disabled={settling===adj.id} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:6,padding:'3px 9px',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{settling===adj.id?'…':'💸 Mark Paid Now'}</button>
                                  </div>
                                  {adj.calc_original_shift_found===false && (
                                    <div style={{marginTop:4,fontSize:9,fontWeight:700,color:'#c0392b'}}>⚠️ Original shift not found — full corrected shift was credited, not just the difference. Verify manually before paying.</div>
                                  )}
                                  {adj.calc_recorded_late_deduction!=null ? (
                                    <div style={{marginTop:4,fontSize:9,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>
                                      Late ded. {peso(adj.calc_recorded_late_deduction)}→{peso(adj.calc_supposed_late_deduction)} (refund {peso(adj.calc_late_refund)}) + hrs credit {peso(adj.calc_extra_hours_credit)}
                                    </div>
                                  ) : adj.calc_hourly_rate!=null && (
                                    <div style={{marginTop:4,fontSize:9,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>
                                      {adj.calc_original_paid_hours}h→{adj.calc_corrected_paid_hours}h · late {adj.calc_original_late_mins}→{adj.calc_corrected_late_mins}m · @{peso(adj.calc_hourly_rate)}/hr
                                    </div>
                                  )}
                                </div>
                              )
                            ) : '—'}
                          </td>
                          <td style={{padding:'9px 12px',color:'var(--text-muted)',fontSize:10}}>{adj.review_note||'—'}</td>
                          <td style={{padding:'9px 12px'}}>
                            {adj.status==='approved' && (
                              <button
                                onClick={()=>undoApproval(adj)}
                                title={adj.applied ? "Already applied/paid — you can still undo, but it won't pull the money back automatically" : "Safe to undo — nothing's been applied or paid yet"}
                                style={{background:adj.applied?'#fdeceb':'var(--surface)',border:`1px solid ${adj.applied?'#e0b0b0':'var(--border)'}`,color:adj.applied?'#c0392b':'var(--text-muted)',borderRadius:6,padding:'4px 9px',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}
                              >↩️ Undo{adj.applied?' (applied)':''}</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab==='overtime' && (
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* Request Overtime — management-initiated */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Request Overtime</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Sends a request to the staff member's portal — they accept or decline, then (if accepted) submit the actual period they worked for your approval.</div>
              </div>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,alignItems:'end'}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Staff Member</div>
                  <select value={otForm.staffId} onChange={e=>setOtForm(f=>({...f,staffId:e.target.value}))} style={iStyle}>
                    <option value="">Select…</option>
                    {[...staff].sort((a,b)=>(a.last_name||'').localeCompare(b.last_name||'')).map(s=>(
                      <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Date</div>
                  <input type="date" value={otForm.date} onChange={e=>{
                    const d = e.target.value
                    const matched = CUTOFF_PERIODS.find(p => d >= p.start && d <= p.end)
                    setOtForm(f=>({...f, date: d, cutoffId: matched ? String(matched.id) : f.cutoffId}))
                  }} style={iStyle}/>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Payroll Cutoff</div>
                  <select value={otForm.cutoffId} onChange={e=>setOtForm(f=>({...f,cutoffId:e.target.value}))} style={iStyle}>
                    <option value="">Select…</option>
                    {CUTOFF_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Shift (optional)</div>
                  <select value={otForm.shiftType} onChange={e=>setOtForm(f=>({...f,shiftType:e.target.value}))} style={iStyle}>
                    <option value="">—</option>
                    {Object.entries(SHIFT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Requested Hours</div>
                  <input type="number" step="0.5" min="0.5" value={otForm.requestedHours} onChange={e=>setOtForm(f=>({...f,requestedHours:e.target.value}))} style={iStyle}/>
                </div>
                <div style={{gridColumn:'span 4'}}>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Note (optional)</div>
                  <input value={otForm.note} onChange={e=>setOtForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Cover the late inventory count" style={iStyle}/>
                </div>
                <button onClick={createOvertimeRequest} disabled={creatingOt} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:8,padding:'9px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",height:36}}>{creatingOt?'Sending…':'⏰ Send Request'}</button>
              </div>
            </div>

            {/* Awaiting employee response */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Awaiting Employee</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Sent to staff — waiting for them to accept/decline, or (once accepted) submit the period they worked.</div>
              </div>
              {otRequests.filter(o=>['requested','accepted'].includes(o.status)).length===0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Nothing waiting on staff right now.</div>
              ) : (
                <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:10}}>
                  {otRequests.filter(o=>['requested','accepted'].includes(o.status)).map(req=>{
                    const s = req.staff || {}
                    return (
                      <div key={req.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',background:'var(--surface)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                            <div style={{fontSize:10,color:'var(--text-muted)'}}>{new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} · {req.cutoff_label} · asked for {req.requested_hours}h</div>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:8,background: req.status==='requested' ? '#fef3e2' : '#eef6f2', color: req.status==='requested' ? '#a06000' : 'var(--matcha-dark)'}}>
                            {req.status==='requested' ? '⏳ Awaiting response' : '✓ Accepted — awaiting their submission'}
                          </span>
                          <button onClick={()=>cancelOvertimeRequest(req)} disabled={cancellingOt===req.id} style={{background:'transparent',border:'1px solid #f5c6c6',color:'#c0392b',borderRadius:7,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{cancellingOt===req.id?'Cancelling…':'Cancel'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pending approval — employee has submitted the actual period worked */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Pending Your Approval</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Staff submitted the actual period they worked. Preview computes the amount from THAT — adjust it if needed before approving.</div>
              </div>
              {otRequests.filter(o=>o.status==='submitted').length===0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>No submitted overtime periods waiting on you.</div>
              ) : (
                <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
                  {otRequests.filter(o=>o.status==='submitted').map(req=>{
                    const s = req.staff || {}
                    const preview = otPreviews[req.id]
                    return (
                      <div key={req.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',background:'var(--surface)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                              <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role} · {req.cutoff_label}</div>
                            </div>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:8,background:'#fef3e2',color:'#a06000'}}>{req.actual_hours}h worked (asked for {req.requested_hours}h)</span>
                        </div>
                        <div style={{marginTop:10,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,fontSize:11}}>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Date / Shift</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} · {SHIFT_LABELS[req.shift_type]||req.shift_type||'—'}</div></div>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Actual Period</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{req.actual_time_in||'—'} – {req.actual_time_out||'—'}</div></div>
                          <div><div style={{color:'var(--text-muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Requested vs Actual</div><div style={{marginTop:2,fontFamily:"'DM Mono',monospace"}}>{req.requested_hours}h → {req.actual_hours}h</div></div>
                        </div>
                        {req.requested_note && <div style={{marginTop:8,fontSize:11,color:'var(--text-primary)',background:'var(--white)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px'}}>Request note: "{req.requested_note}"</div>}

                        {preview && (
                          <div style={{marginTop:10,background:'#eef6f2',border:'1px solid var(--matcha)',borderRadius:8,padding:'10px 12px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                              <div style={{fontWeight:700,fontSize:13,color:'var(--matcha-dark)'}}>Suggested: {peso(preview.amount)} ({req.actual_hours}h × {peso(preview.hourlyRate)}/hr)</div>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontSize:10,color:'var(--text-muted)'}}>Amount to approve</span>
                                <input type="number" value={otAmounts[req.id]??preview.amount} onChange={e=>setOtAmounts(p=>({...p,[req.id]:e.target.value}))} style={{width:90,textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',outline:'none'}}/>
                              </div>
                            </div>
                            <div style={{marginTop:4,fontSize:10,color:'var(--text-muted)'}}>
                              {preview.existingRun ? `⚠️ ${req.cutoff_label} payroll is already saved — approving will patch this amount straight into that saved payslip and net pay.` : `${req.cutoff_label} hasn't been saved yet — approving pre-fills the Overtime field on the Payslips tab; it locks in when you Save Payroll for that cutoff.`}
                            </div>
                          </div>
                        )}

                        <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <input value={otReviewNotes[req.id]||''} onChange={e=>setOtReviewNotes(prev=>({...prev,[req.id]:e.target.value}))} placeholder="Optional note…" style={{flex:1,minWidth:140,background:'var(--white)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
                          <button onClick={()=>previewOvertime(req)} disabled={otPreviewing===req.id} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-muted)',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{otPreviewing===req.id?'Checking…':(preview?'🔄 Refresh':'👁 Preview Amount')}</button>
                          <button onClick={()=>rejectOvertime(req)} disabled={otApproving===req.id} style={{background:'transparent',border:'1px solid #f5c6c6',color:'#c0392b',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Reject</button>
                          <button onClick={()=>approveOvertime(req)} disabled={otApproving===req.id} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:7,padding:'6px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{otApproving===req.id?'Approving…':'✓ Approve'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Resolved: declined by employee, rejected by management, or approved */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Resolved</div>
              </div>
              {otRequests.filter(o=>['declined','rejected','approved','cancelled'].includes(o.status)).length===0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Nothing resolved yet.</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'var(--espresso)'}}>
                      <th style={thBase}>Employee</th>
                      <th style={thBase}>Cutoff / Date</th>
                      <th style={thBase}>Requested → Actual</th>
                      <th style={thBase}>Outcome</th>
                      <th style={thBase}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otRequests.filter(o=>['declined','rejected','approved','cancelled'].includes(o.status)).map((req,i)=>{
                      const s = req.staff || {}
                      return (
                        <tr key={req.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                          <td style={{padding:'9px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:22,height:22,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                              <span style={{fontWeight:600}}>{s.first_name} {s.last_name}</span>
                            </div>
                          </td>
                          <td style={{padding:'9px 12px'}}>{req.cutoff_label}<br/><span style={{color:'var(--text-muted)',fontSize:10}}>{new Date(req.shift_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span></td>
                          <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace"}}>{req.requested_hours}h{req.actual_hours!=null?` → ${req.actual_hours}h`:''}</td>
                          <td style={{padding:'9px 12px'}}>
                            {req.status==='cancelled' ? (
                              <span style={{color:'var(--text-muted)',fontWeight:700}}>🗑️ Cancelled by management</span>
                            ) : req.status==='declined' ? (
                              <span style={{color:'var(--text-muted)',fontWeight:700}}>👍 Declined by employee</span>
                            ) : req.status==='rejected' ? (
                              <span style={{color:'#c0392b',fontWeight:700}}>✗ Rejected</span>
                            ) : req.applied ? (
                              <span style={{color:'var(--matcha-dark)',fontWeight:700}}>✓ {peso(req.amount)} applied · {req.cutoff_label}</span>
                            ) : (
                              <span style={{color:'#a06000',fontWeight:700}}>⏳ {peso(req.amount)} — on next Save Payroll</span>
                            )}
                          </td>
                          <td style={{padding:'9px 12px',color:'var(--text-muted)',fontSize:10}}>{req.status==='declined' ? (req.decline_note||'—') : (req.review_note||'—')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab==='audit' && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Accuracy Check — {selectedCutoff.label}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Scans this cutoff's archived timesheet + payroll for the failure patterns most likely to under/overpay someone.</div>
              </div>
              <button onClick={()=>runAccuracyCheck(selectedCutoff)} disabled={auditing} style={{background:'var(--matcha)',border:'none',color:'white',borderRadius:8,padding:'9px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{auditing?'Checking…':'▶ Run Check'}</button>
            </div>

            {!auditResults ? (
              <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:12}}>Click "Run Check" to audit {selectedCutoff.label}.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  { key:'duplicateDates', title:'Duplicate-date punches (surplus/underpay risk)', hint:'Same employee clocked in/out twice on one calendar date — the 1hr break or 8h cap can apply twice instead of once, or a phantom extra day gets counted for Full-time staff.',
                    render: r => `${r.name} — ${r.date} · ${r.count} punches · ${r.impactPeso!=null ? `${peso(r.impactPeso)} ${r.impactDirection}` : `${r.oldPaid.toFixed(2)}h paid (couldn't match staff to price it)`}` },
                  { key:'highLate', title:'Unusually high late minutes (>120m)', hint:'Often means a broken/miscategorized clock-in (like the wrong-time cases handled this session), not genuine lateness — worth a quick sanity check with the employee.',
                    render: r => `${r.name} — ${r.date} · ${r.lateMinutes} min late · in at ${r.timeIn}` },
                  { key:'noSchedule', title:'Full-time staff paid ₱0 despite working days', hint:'No published schedule (required_days = 0) for this cutoff, so their daily rate has no denominator — they show days worked but ₱0 pay.',
                    render: r => `${r.name} — ${r.daysWorked} day(s) worked, ₱0 paid` },
                  { key:'unmatchedCsvRows', title:"Timesheet rows that didn't match any staff record", hint:"These people's hours exist in the uploaded timesheet but aren't being counted in payroll at all — usually a name mismatch.",
                    render: r => r.name },
                ].map(({key,title,hint,render}) => {
                  const items = auditResults[key] || []
                  return (
                    <div key={key} style={{border:`1px solid ${items.length?'#e0b0b0':'var(--border)'}`,borderRadius:10,padding:'12px 14px',background:items.length?'#fff8f6':'var(--surface)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{fontWeight:700,fontSize:12,color:items.length?'#c0392b':'var(--matcha-dark)'}}>{items.length ? '⚠️' : '✓'} {title}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)'}}>{items.length} found</div>
                      </div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3,marginBottom:items.length?8:0}}>{hint}</div>
                      {items.length>0 && (
                        <div style={{fontSize:11,color:'var(--text-primary)',display:'flex',flexDirection:'column',gap:3,marginTop:6}}>
                          {items.map((it,idx)=>(<div key={idx} style={{fontFamily:"'DM Mono',monospace",fontSize:10}}>{render(it)}</div>))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
