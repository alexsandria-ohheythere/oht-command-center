// ─── Oh Hey There Payroll Engine ───────────────────────────────────────────

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Freelancer']

// Base rates by employment type + role
export const RATES = {
  'Full-time': {
    'Senior Barista':                { monthly: 17000 },
    'Executive Chef':                { monthly: 17000 },
    'Junior Barista - Milk Station': { monthly: 14000 },
    'Junior Barista - Cashier':      { monthly: 14000 },
    'Sous Chef':                     { monthly: 15000 },
  },
  'Part-time': {
    'Senior Barista':                { daily: 850 },
    'Executive Chef':                { daily: 850 },
    'Junior Barista - Milk Station': { daily: 700 },
    'Junior Barista - Cashier':      { daily: 700 },
    'Sous Chef':                     { daily: 700 },
    'Kitchen Staff':                 { daily: 700 },
  },
  'Freelancer': {
    'Cafe Supervisor':               { daily: 1150 },
    'Cafe Operations Support':       { daily: 750  },
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
  { id: 10, label: 'Aug 15 – Aug 29', start: '2026-08-15', end: '2026-08-29' },
  { id: 11, label: 'Aug 30 – Sep 14', start: '2026-08-30', end: '2026-09-14' },
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

export function getBaseRate(employment_type, role) {
  return RATES[employment_type]?.[role] || null
}

export function getDailyRate(employment_type, role) {
  const rate = getBaseRate(employment_type, role)
  if (!rate) return 0
  if (rate.daily) return rate.daily
  if (rate.monthly) return Math.round(rate.monthly / 26)
  return 0
}

export function getHourlyRate(employment_type, role) {
  return getDailyRate(employment_type, role) / MAX_PAID_HOURS_PER_SHIFT
}

export function getMinuteRate(employment_type, role) {
  return getHourlyRate(employment_type, role) / 60
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
  // AM shift (06:30–11:00) — late vs 06:30, cap at 60 mins
  return Math.min(60, Math.max(0, totalMins - shiftStartMins))
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
      // Shift row
      const raw = parseFloat(totalHours) || 0
      const paid = capShiftHours(raw)
      const lateMin = getLateMinutes(timeIn)
      employees[currentEmployee].shifts.push({
        timeIn, timeOut,
        rawHours: raw,
        paidHours: paid,
        lateMinutes: lateMin,
        date: timeIn.split(' ')[0] // MM/DD/YYYY
      })
    }
  }
  return employees
}

// Filter shifts within a cutoff period
export function filterShiftsByPeriod(shifts, startDate, endDate) {
  return shifts.filter(s => {
    if (!s.date) return false
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const [mm, dd, yyyy] = s.date.split('/')
    const d = `${yyyy}-${mm}-${dd}`
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

export function calcWithholdingTax(monthly) {
  const annual = monthly * 12
  if (annual <= 250000)  return 0
  if (annual <= 400000)  return Math.round((annual - 250000) * 0.15 / 12)
  if (annual <= 800000)  return Math.round((22500 + (annual - 400000) * 0.20) / 12)
  if (annual <= 2000000) return Math.round((102500 + (annual - 800000) * 0.25) / 12)
  if (annual <= 8000000) return Math.round((402500 + (annual - 2000000) * 0.30) / 12)
  return Math.round((2202500 + (annual - 8000000) * 0.35) / 12)
}

export const LEAVE_ENTITLEMENT = { vacation: 5, sick: 5 }

export function isServiceChargeEligible(lateCount = 0, violations = 0) {
  return lateCount <= 3 && violations === 0
}

// ── FULL PAYROLL COMPUTATION PER CUTOFF ──────────────────────────────────
export function computeCutoffPayroll(staff, periodShifts) {
  const type = staff.employment_type || 'Full-time'
  const role = staff.role || ''
  const monthly = staff.monthly_pay || getBaseRate(type, role)?.monthly || 0
  const dailyRate = getDailyRate(type, role)
  const hourlyRate = getHourlyRate(type, role)
  const minuteRate = getMinuteRate(type, role)

  // Days and hours from actual shifts
  const daysWorked  = periodShifts.length
  const paidHours   = periodShifts.reduce((sum, s) => sum + (s.paidHours || 0), 0)
  const totalLateMins = periodShifts.reduce((sum, s) => sum + (s.lateMinutes || 0), 0)
  const lateCount   = periodShifts.filter(s => s.lateMinutes > 0).length

  // Gross: hourly rate × paid hours
  const gross = Math.round(hourlyRate * paidHours)

  // Deductions
  const lateDeduction = Math.round(totalLateMins * minuteRate)

  // Gov't deductions — split per cutoff (monthly ÷ 2)
  let sss = 0, philhealth = 0, pagibig = 0, tax = 0
  if (type === 'Full-time' && monthly > 0) {
    sss        = Math.round(calcSSS(monthly) / 2)
    philhealth = Math.round(calcPhilHealth(monthly) / 2)
    pagibig    = Math.round(calcPagIBIG(monthly) / 2)
    const taxableMonthly = monthly - calcSSS(monthly) - calcPhilHealth(monthly) - calcPagIBIG(monthly)
    tax = Math.round(calcWithholdingTax(taxableMonthly) / 2)
  }

  const totalDeductions = lateDeduction + sss + philhealth + pagibig + tax
  const netPay = Math.max(0, gross - totalDeductions)

  return {
    daysWorked, paidHours: Math.round(paidHours * 100) / 100,
    totalLateMins, lateCount, gross,
    lateDeduction, sss, philhealth, pagibig, tax,
    totalDeductions, netPay, dailyRate, hourlyRate,
    eligible: isServiceChargeEligible(lateCount, staff.violation_count || 0),
  }
}
