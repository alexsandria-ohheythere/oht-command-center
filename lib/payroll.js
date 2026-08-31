// ─── Oh Hey There Payroll Engine ───────────────────────────────────────────

// Round to the nearest centavo (2 decimal places) instead of the nearest whole peso —
// used everywhere money is computed so payslips show real cents, not just whole pesos.
export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Freelancer']

// Base rates by employment type + role (fallback defaults)
// These are overridden by rates saved in Settings → Payroll → Rate Cards
export const RATES = {
  'Full-time': {
    'Senior Barista':                { monthly: 17000 },
    'R&D Specialist':                { monthly: 23000 },
    'Executive Chef':                { monthly: 17000 },
    'Junior Barista - Milk Station': { monthly: 14000 },
    'Junior Barista - Cashier':      { monthly: 14000 },
    'Sous Chef':                     { monthly: 15000 },
  },
  'Part-time': {
    'Senior Barista':                { daily: 850 },
    'R&D Specialist':                { daily: 1150 },
    'Executive Chef':                { daily: 850 },
    'Junior Barista - Milk Station': { daily: 700 },
    'Junior Barista - Cashier':      { daily: 700 },
    'Sous Chef':                     { daily: 700 },
    'Kitchen Staff':                 { daily: 700 },
  },
  'Freelancer': {
    'Cafe Supervisor':               { daily: 1150 },
    'Cafe Operations Support':       { daily: 700  },
    'R&D Specialist':                { daily: 1150 },                                      
    'Senior Barista':                { daily: 850  },
    'Executive Chef':                { daily: 850  },
    'Junior Barista - Milk Station': { daily: 700  },
    'Junior Barista - Cashier':      { daily: 700  },
    'Sous Chef':                     { daily: 700  },
    'Kitchen Staff':                 { daily: 700  },
  },
}

// Payroll cutoff periods for the year
export const CUTOFF_PERIODS = [
  { id: 1,  label: 'Mar 31 – Apr 14', start: '2026-03-31', end: '2026-04-14' },
  { id: 2,  label: 'Apr 15 – Apr 30', start: '2026-04-15', end: '2026-04-30' },
  { id: 3,  label: 'May 1 – May 14',  start: '2026-05-01', end: '2026-05-14' },
  { id: 4,  label: 'May 15 – May 30', start: '2026-05-15', end: '2026-05-30' },
  { id: 5,  label: 'May 31 – Jun 14', start: '2026-05-31', end: '2026-06-14' },
  { id: 6,  label: 'Jun 15 – Jun 29', start: '2026-06-15', end: '2026-06-29' },
  { id: 7,  label: 'Jun 30 – Jul 14', start: '2026-06-30', end: '2026-07-14' },
  { id: 8,  label: 'Jul 15 – Jul 30', start: '2026-07-15', end: '2026-07-30' },
  { id: 9,  label: 'Jul 31 – Aug 14', start: '2026-07-31', end: '2026-08-14' },
  { id: 10, label: 'Aug 15 – Aug 30', start: '2026-08-15', end: '2026-08-30' },
  { id: 11, label: 'Aug 31 – Sep 14', start: '2026-08-31', end: '2026-09-14' },
  { id: 12, label: 'Sep 15 – Sep 29', start: '2026-09-15', end: '2026-09-29' },
  { id: 13, label: 'Sep 30 – Oct 14', start: '2026-09-30', end: '2026-10-14' },
  { id: 14, label: 'Oct 15 – Oct 30', start: '2026-10-15', end: '2026-10-30' },
  { id: 15, label: 'Oct 31 – Nov 14', start: '2026-10-31', end: '2026-11-14' },
  { id: 16, label: 'Nov 15 – Nov 29', start: '2026-11-15', end: '2026-11-29' },
  { id: 17, label: 'Nov 30 – Dec 14', start: '2026-11-30', end: '2026-12-14' },
  { id: 18, label: 'Dec 15 – Dec 30', start: '2026-12-15', end: '2026-12-30' },
]

export function getCurrentCutoff() {
  const today = new Date().toISOString().split('T')[0]
  return CUTOFF_PERIODS.find(p => today >= p.start && today <= p.end) || CUTOFF_PERIODS[3]
}

// Max paid hours per shift (8 paid + 1 unpaid break = 9 total, cap at 8 paid)
export const MAX_PAID_HOURS_PER_SHIFT = 8
export const SHIFT_START = '06:30' // earliest shift start

// Cap raw hours to 8 paid (remove 1hr unpaid break, cap overnight errors at 9hrs)
export function capShiftHours(rawHours) {
  if (rawHours > 9) return MAX_PAID_HOURS_PER_SHIFT // overnight/error — cap at 8
  if (rawHours <= 0) return 0
  return Math.max(0, rawHours - 1) // subtract 1hr unpaid break
}

export function getBaseRate(employment_type, role, overrideRates = null) {
  const source = overrideRates || RATES
  const entry = source[employment_type]?.[role]
  if (!entry) return null
  // Settings saves as { type:'monthly'|'daily', amount:N } — normalize to legacy shape
  if (entry.type === 'monthly') return { monthly: entry.amount }
  if (entry.type === 'daily')   return { daily: entry.amount }
  return entry
}

export function getDailyRate(employment_type, role, overrideRates = null) {
  const rate = getBaseRate(employment_type, role, overrideRates)
  if (!rate) return 0
  if (rate.daily) return rate.daily
  if (rate.monthly) return Math.round(rate.monthly / 26)
  return 0
}

export function getHourlyRate(employment_type, role, overrideRates = null) {
  return getDailyRate(employment_type, role, overrideRates) / MAX_PAID_HOURS_PER_SHIFT
}

export function getMinuteRate(employment_type, role, overrideRates = null) {
  return getHourlyRate(employment_type, role, overrideRates) / 60
}

// Late detection: only flag as late if shift starts between 06:30 and 11:00
// (PM shift starts at 13:00 so no late for those, MID at 11:00)
export function getLateMinutes(timeInStr) {
  if (!timeInStr) return 0
  const parts = timeInStr.trim().split(' ')
  if (parts.length < 3) return 0
  const timePart = parts[2] // HH:MM
  const [h, m] = timePart.split(':').map(Number)
  const totalMins = h * 60 + m
  const shiftStartMins = 6 * 60 + 30 // 06:30 AM shift start
  const midShiftStart  = 11 * 60      // 11:00 MID shift start
  const pmShiftStart   = 13 * 60      // 13:00 PM shift start

  // PM shift (13:00+) — not an AM shift, no late vs 06:30
  if (totalMins >= pmShiftStart) return 0
  // MID shift (11:00–13:00) — late vs 11:00
  if (totalMins >= midShiftStart) return Math.max(0, totalMins - midShiftStart)
  // AM shift (06:30–11:00) — late vs 06:30, no cap: deduction = actual minutes late × pay-per-minute
  return Math.max(0, totalMins - shiftStartMins)
}

// Parse StoreHub CSV into per-employee attendance records
export function parseTimesheetCSV(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const employees = {}
  let currentEmployee = null

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const [lastName, firstName, email, timeIn, timeOut, totalHours] = cols

    if (lastName && firstName && email) {
      // New employee row
      const key = `${lastName.toLowerCase()}_${firstName.toLowerCase()}`
      currentEmployee = key
      employees[key] = {
        lastName, firstName, email,
        totalHours: parseFloat(totalHours) || 0,
        shifts: []
      }
    } else if (currentEmployee && timeIn && timeOut) {
      // Raw punch row — merged per calendar day below before capping/late calc.
      employees[currentEmployee].shifts.push({
        timeIn, timeOut,
        rawHoursReported: parseFloat(totalHours) || 0,
        date: timeIn.split(' ')[0] // MM/DD/YYYY
      })
    }
  }

  // Merge same-date punches into a single shift per employee per calendar day.
  // StoreHub sometimes splits one real workday into two punches (e.g. a lunch-break
  // clock-out/in, or a forgotten clock-out that gets closed out days later). Capping
  // and late-detection must run ONCE per day, not once per punch — otherwise a lunch
  // split subtracts the 1hr break twice (underpays), and a multi-day forgotten
  // clock-out can look like a second full day of pay on top of a legitimate shift
  // that already happened that same date (overpays).
  for (const key of Object.keys(employees)) {
    const byDate = {}
    for (const row of employees[key].shifts) {
      byDate[row.date] = byDate[row.date] || []
      byDate[row.date].push(row)
    }
    const merged = []
    for (const date of Object.keys(byDate)) {
      const rows = byDate[date].sort((a, b) => a.timeIn.localeCompare(b.timeIn))
      const timeIn = rows[0].timeIn
      const timeOut = rows[rows.length - 1].timeOut
      const raw = rows.reduce((sum, r) => sum + (r.rawHoursReported || 0), 0)
      merged.push({
        timeIn, timeOut,
        rawHours: Math.round(raw * 100) / 100,
        paidHours: capShiftHours(raw),
        lateMinutes: getLateMinutes(timeIn),
        date,
      })
    }
    employees[key].shifts = merged
  }

  return employees
}

// Filter shifts within a cutoff period
export function filterShiftsByPeriod(shifts, startDate, endDate) {
  return shifts.filter(s => {
    if (!s.date) return false
    // Convert MM/DD/YYYY to YYYY-MM-DD (zero-padded so string comparison is correct)
    const [mm, dd, yyyy] = s.date.split('/')
    if (!mm || !dd || !yyyy) return false
    const d = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
    return d >= startDate && d <= endDate
  })
}

// Match timesheet employee to staff record by last name
export function matchStaff(staffList, tsLastName, tsFirstName) {
  const ln = tsLastName.toLowerCase().trim()
  const fn = tsFirstName.toLowerCase().trim()
  return staffList.find(s => {
    const sln = (s.last_name||'').toLowerCase().trim()
    const sfn = (s.first_name||'').toLowerCase().trim()
    // Match by last name + first few chars of first name
    return sln === ln && (sfn.startsWith(fn.slice(0,4)) || fn.startsWith(sfn.slice(0,4)))
  }) || staffList.find(s => (s.last_name||'').toLowerCase().trim() === ln)
}

// ── GOV'T DEDUCTIONS (2024 PH rates) ──────────────────────────────────────
export function calcSSS(monthly) {
  if (monthly < 4250)  return 180
  if (monthly < 4750)  return 202.50
  if (monthly < 5250)  return 225
  if (monthly < 5750)  return 247.50
  if (monthly < 6250)  return 270
  if (monthly < 6750)  return 292.50
  if (monthly < 7250)  return 315
  if (monthly < 7750)  return 337.50
  if (monthly < 8250)  return 360
  if (monthly < 8750)  return 382.50
  if (monthly < 9250)  return 405
  if (monthly < 9750)  return 427.50
  if (monthly < 10250) return 450
  if (monthly < 10750) return 472.50
  if (monthly < 11250) return 495
  if (monthly < 11750) return 517.50
  if (monthly < 12250) return 540
  if (monthly < 12750) return 562.50
  if (monthly < 13250) return 585
  if (monthly < 13750) return 607.50
  if (monthly < 14250) return 630
  if (monthly < 14750) return 652.50
  if (monthly < 15250) return 675
  if (monthly < 15750) return 697.50
  if (monthly < 16250) return 720
  if (monthly < 16750) return 742.50
  if (monthly < 17250) return 765
  if (monthly < 17750) return 787.50
  if (monthly < 18250) return 810
  if (monthly < 18750) return 832.50
  if (monthly < 19250) return 855
  if (monthly < 19750) return 877.50
  return 900
}

export function calcPhilHealth(monthly) {
  return Math.min(Math.max(monthly * 0.05 / 2, 250), 2500)
}

export function calcPagIBIG(monthly) {
  return Math.min(monthly * 0.02, 200)
}

// ── EMPLOYER-SIDE GOV'T CONTRIBUTIONS ─────────────────────────────────────
// PhilHealth and Pag-IBIG are split evenly between employer and employee in this
// model, so the employer share simply mirrors the employee share above.
// SSS is not an even split — approximated here using the official EE:ER
// contribution ratio (4.5% employee : 9.5% employer). This is an approximation
// against the existing simplified EE bracket table above, not an exact SSS
// employer table — verify against the official SSS schedule if this needs to
// be audit-exact.
export function calcSSSEmployer(monthly) {
  return round2(calcSSS(monthly) * (9.5 / 4.5))
}

export function calcWithholdingTax(monthly) {
  const annual = monthly * 12
  if (annual <= 250000)  return 0
  if (annual <= 400000)  return round2((annual - 250000) * 0.15 / 12)
  if (annual <= 800000)  return round2((22500 + (annual - 400000) * 0.20) / 12)
  if (annual <= 2000000) return round2((102500 + (annual - 800000) * 0.25) / 12)
  if (annual <= 8000000) return round2((402500 + (annual - 2000000) * 0.30) / 12)
  return round2((2202500 + (annual - 8000000) * 0.35) / 12)
}

export const LEAVE_ENTITLEMENT = { vacation: 5, sick: 5 }

export function isServiceChargeEligible(lateCount = 0, violations = 0) {
  return lateCount <= 3 && violations === 0
}

// ── FULL PAYROLL COMPUTATION PER CUTOFF ──────────────────────────────────
export function computeCutoffPayroll(staff, periodShifts, overrideRates = null, cutoff = null, requiredDays = null) {
  const type = staff.employment_type || 'Full-time'
  const role = staff.role || ''
  const monthly = staff.monthly_pay || getBaseRate(type, role, overrideRates)?.monthly || 0

  // Days and hours from actual shifts
  const daysWorked  = periodShifts.length
  const paidHours   = periodShifts.reduce((sum, s) => sum + (s.paidHours || 0), 0)
  const totalLateMins = periodShifts.reduce((sum, s) => sum + (s.lateMinutes || 0), 0)
  const lateCount   = periodShifts.filter(s => s.lateMinutes > 0).length

  // ── Rate model ──
  // Basic pay = daily rate × days worked, for ALL employment types (Full-time,
  // Part-time, Freelancer). Actual clocked hours do NOT prorate Basic pay.
  // Full-time: dailyRate = (monthly ÷ 2) ÷ requiredDays(scheduled days this cutoff).
  //   requiredDays must come from the published schedule. If 0/unknown -> no pay (publish roster first).
  // Part-time / Freelancer: dailyRate comes from the role rate card (Settings → Payroll).
  // Undertime and absence are NOT auto-prorated into Basic — undertime is a separate manual
  // line on the payslip (entered by admin when relevant), and an absent day is simply not
  // counted in daysWorked at all. Late minutes are a separate automatic deduction below.
  let dailyRate, hourlyRate, minuteRate, gross, noSchedule = false
  if (type === 'Full-time') {
    const perCutoffSalary = monthly / 2
    const reqd = (requiredDays && requiredDays > 0) ? requiredDays : 0
    if (reqd === 0) {
      noSchedule = true
      dailyRate = 0; hourlyRate = 0; minuteRate = 0; gross = 0
    } else {
      dailyRate = perCutoffSalary / reqd
      hourlyRate = dailyRate / MAX_PAID_HOURS_PER_SHIFT
      minuteRate = hourlyRate / 60
      gross = round2(dailyRate * daysWorked)
    }
  } else {
    dailyRate = getDailyRate(type, role, overrideRates)
    hourlyRate = getHourlyRate(type, role, overrideRates)
    minuteRate = getMinuteRate(type, role, overrideRates)
    gross = round2(dailyRate * daysWorked)
  }

  // Late/undertime deductions (minute-based) still apply
  const lateDeduction = round2(totalLateMins * minuteRate)

  // Gov't deductions — full monthly amount, charged on the FIRST cutoff of the month only.
  // "First cutoff" = the period whose END date falls on/before the 15th (handles month-spanning cutoffs).
  // If no cutoff is provided, default to charging (back-compat) so totals are never silently dropped.
  const isFirstCutoffOfMonth = cutoff && cutoff.end
    ? parseInt(String(cutoff.end).split('-')[2], 10) <= 15
    : true
  let sss = 0, philhealth = 0, pagibig = 0, tax = 0
  let sssEmployer = 0, philhealthEmployer = 0, pagibigEmployer = 0
  if (type === 'Full-time' && monthly > 0 && isFirstCutoffOfMonth && !noSchedule) {
    sss        = round2(calcSSS(monthly))
    philhealth = round2(calcPhilHealth(monthly))
    pagibig    = round2(calcPagIBIG(monthly))
    sssEmployer        = calcSSSEmployer(monthly)
    philhealthEmployer = philhealth
    pagibigEmployer    = pagibig
    const taxableMonthly = monthly - calcSSS(monthly) - calcPhilHealth(monthly) - calcPagIBIG(monthly)
    tax = round2(calcWithholdingTax(taxableMonthly))
  }

  const totalDeductions = lateDeduction + sss + philhealth + pagibig + tax
  const netPay = Math.max(0, gross - totalDeductions)

  return {
    daysWorked, paidHours: Math.round(paidHours * 100) / 100,
    totalLateMins, lateCount, gross,
    lateDeduction, sss, philhealth, pagibig, tax,
    sssEmployer, philhealthEmployer, pagibigEmployer,
    totalDeductions, netPay, dailyRate: round2(dailyRate), hourlyRate: round2(hourlyRate),
    requiredDays: requiredDays || 0, noSchedule,
    eligible: isServiceChargeEligible(lateCount, staff.violation_count || 0),
  }
}

// ── TIMESHEET ADJUSTMENTS ────────────────────────────────────────────────
// Supports the staff-filed "Timesheet Adjustment" flow: a staff member reports
// a missing/incorrect clock-in or clock-out, HR/admin approves it in the
// Command Center, and depending on whether that cutoff's payroll has already
// been saved, the correction either (a) patches the raw timesheet shift data
// automatically before the next compute/save, or (b) is banked as a refund
// applied to the staff member's next payroll run.

export function isoToMMDDYYYY(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

export function getWeekdayName(dateMMDDYYYY) {
  const [mm, dd, yyyy] = dateMMDDYYYY.split('/')
  const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10))
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

// Build a shift record matching the exact shape produced by parseTimesheetCSV,
// from a staff member's claimed time-in/time-out (24hr "HH:MM" strings).
export function buildCorrectedShift(dateMMDDYYYY, timeInHHMM, timeOutHHMM) {
  const weekday = getWeekdayName(dateMMDDYYYY)
  const fmt = hhmm => { const [h, m] = hhmm.split(':'); return `${parseInt(h, 10)}:${m}` }
  const timeIn  = `${dateMMDDYYYY} ${weekday} ${fmt(timeInHHMM)}`
  const timeOut = `${dateMMDDYYYY} ${weekday} ${fmt(timeOutHHMM)}`
  const [inH, inM]   = timeInHHMM.split(':').map(Number)
  const [outH, outM] = timeOutHHMM.split(':').map(Number)
  let rawHours = (outH * 60 + outM - (inH * 60 + inM)) / 60
  if (rawHours <= 0) rawHours += 24 // crosses midnight — shouldn't happen for cafe shifts, but don't produce negative hours
  const paidHours   = capShiftHours(rawHours)
  const lateMinutes = getLateMinutes(timeIn)
  return { date: dateMMDDYYYY, timeIn, timeOut, rawHours: Math.round(rawHours * 100) / 100, paidHours, lateMinutes }
}

// Merge approved "timesheet_correction" adjustments into a staff member's shift
// list for a cutoff — replaces the shift on that date if one exists, otherwise
// inserts it (covers the "missed_entirely" / never clocked in case).
export function applyAdjustmentsToShifts(shifts, approvedAdjustments) {
  if (!approvedAdjustments || approvedAdjustments.length === 0) return shifts
  let result = [...(shifts || [])]
  approvedAdjustments.forEach(adj => {
    if (!adj.claimed_time_in || !adj.claimed_time_out) return
    const dateMMDDYYYY = isoToMMDDYYYY(adj.shift_date)
    const corrected = buildCorrectedShift(dateMMDDYYYY, adj.claimed_time_in, adj.claimed_time_out)
    const idx = result.findIndex(s => s.date === dateMMDDYYYY)
    if (idx >= 0) result[idx] = corrected
    else result.push(corrected)
  })
  return result
}

// Find which key in an archived timesheet_uploads.employees blob belongs to a staff member.
export function findTimesheetKey(employeesObj, staffMember) {
  if (!employeesObj) return null
  return Object.keys(employeesObj).find(k => {
    const e = employeesObj[k]
    return matchStaff([staffMember], e.lastName, e.firstName) !== undefined
  }) || null
}

// Peso amount owed for an approved adjustment on an ALREADY-SAVED cutoff (refund path).
// Only credits a positive difference — extra hours actually worked, or late minutes
// that shouldn't have counted — never claws back pay through this flow.
export function computeAdjustmentRefundAmount({ hourlyRate, minuteRate, originalShift, correctedShift }) {
  const origPaid = originalShift?.paidHours || 0
  const origLate = originalShift?.lateMinutes || 0
  const corrPaid = correctedShift?.paidHours || 0
  const corrLate = correctedShift?.lateMinutes || 0
  const hoursDelta   = Math.max(0, corrPaid - origPaid)
  const lateReversal = Math.max(0, origLate - corrLate)
  return round2(hoursDelta * hourlyRate + lateReversal * minuteRate)
}

// ── SERVICE CHARGE DISTRIBUTION ───────────────────────────────────────────
// The service charge pool for a cutoff is sourced from Finance > Sales entries
// (each sale record can carry a `service_charge` amount) summed across the
// cutoff's date range. That pool is split across service-charge-eligible staff
// (isServiceChargeEligible — late count ≤3 and zero violations that cutoff),
// proportional to each person's paid hours worked in the cutoff. Ineligible
// staff are simply excluded from both the hours denominator and the payout.
//
// `eligibleHoursByStaffId` should only contain entries for eligible staff —
// build it by filtering payrollRows to r.pay.eligible before calling this.
export function computeServiceChargeShares(totalServiceCharge, eligibleHoursByStaffId) {
  const pool = parseFloat(totalServiceCharge) || 0
  const totalHours = Object.values(eligibleHoursByStaffId || {}).reduce((sum, h) => sum + (parseFloat(h) || 0), 0)
  if (pool <= 0 || totalHours <= 0) return { ratePerHour: 0, totalHours, shares: {} }
  const ratePerHour = pool / totalHours
  const shares = {}
  Object.keys(eligibleHoursByStaffId).forEach(staffId => {
    shares[staffId] = round2(ratePerHour * (parseFloat(eligibleHoursByStaffId[staffId]) || 0))
  })
  return { ratePerHour, totalHours, shares }
}

// v2
