// ─── Oh Hey There Payroll Engine ───────────────────────────────────────────

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Freelancer']

// Base rates by employment type + role
export const RATES = {
  'Full-time': {
    'Senior Barista':               { monthly: 17000 },
    'Executive Chef':               { monthly: 17000 },
    'Junior Barista - Milk Station':{ monthly: 14000 },
    'Junior Barista - Cashier':     { monthly: 14000 },
    'Sous Chef':                    { monthly: 15000 },
  },
  'Part-time': {
    'Senior Barista':               { daily: 850  },
    'Executive Chef':               { daily: 850  },
    'Junior Barista - Milk Station':{ daily: 700  },
    'Junior Barista - Cashier':     { daily: 700  },
    'Sous Chef':                    { daily: 700  },
    'Kitchen Staff':                { daily: 700  },
  },
  'Freelancer': {
    'Cafe Supervisor':              { daily: 1150 },
    'Cafe Operations Support':      { daily: 750  },
    'Senior Barista':               { daily: 850  },
    'Executive Chef':               { daily: 850  },
    'Junior Barista - Milk Station':{ daily: 700  },
    'Junior Barista - Cashier':     { daily: 700  },
    'Sous Chef':                    { daily: 700  },
    'Kitchen Staff':                { daily: 700  },
  },
}

// Get base rate for a staff member
export function getBaseRate(employment_type, role) {
  return RATES[employment_type]?.[role] || null
}

// Daily rate from monthly (Full-time: 26 working days/month)
export function getDailyRate(employment_type, role) {
  const rate = getBaseRate(employment_type, role)
  if (!rate) return 0
  if (rate.daily) return rate.daily
  if (rate.monthly) return Math.round(rate.monthly / 26) // 26 working days
  return 0
}

// Hourly rate (8 paid hours, 1 unpaid break already excluded)
export function getHourlyRate(employment_type, role) {
  return Math.round(getDailyRate(employment_type, role) / 8)
}

// Per-minute rate
export function getMinuteRate(employment_type, role) {
  return getDailyRate(employment_type, role) / (8 * 60)
}

// Late deduction: minutes late × per-minute rate
export function calcLateDeduction(employment_type, role, late_minutes = 0) {
  const perMinute = getMinuteRate(employment_type, role)
  return Math.round(late_minutes * perMinute)
}

// Absence deduction: absent days × daily rate
export function calcAbsenceDeduction(employment_type, role, absent_days = 0) {
  return absent_days * getDailyRate(employment_type, role)
}

// ── GOV'T DEDUCTIONS (2024 Philippine rates) ──────────────────────────────

// SSS contribution table (employee share, monthly)
export function calcSSS(monthly_salary) {
  if (monthly_salary < 4250)  return 180
  if (monthly_salary < 4750)  return 202.50
  if (monthly_salary < 5250)  return 225
  if (monthly_salary < 5750)  return 247.50
  if (monthly_salary < 6250)  return 270
  if (monthly_salary < 6750)  return 292.50
  if (monthly_salary < 7250)  return 315
  if (monthly_salary < 7750)  return 337.50
  if (monthly_salary < 8250)  return 360
  if (monthly_salary < 8750)  return 382.50
  if (monthly_salary < 9250)  return 405
  if (monthly_salary < 9750)  return 427.50
  if (monthly_salary < 10250) return 450
  if (monthly_salary < 10750) return 472.50
  if (monthly_salary < 11250) return 495
  if (monthly_salary < 11750) return 517.50
  if (monthly_salary < 12250) return 540
  if (monthly_salary < 12750) return 562.50
  if (monthly_salary < 13250) return 585
  if (monthly_salary < 13750) return 607.50
  if (monthly_salary < 14250) return 630
  if (monthly_salary < 14750) return 652.50
  if (monthly_salary < 15250) return 675
  if (monthly_salary < 15750) return 697.50
  if (monthly_salary < 16250) return 720
  if (monthly_salary < 16750) return 742.50
  if (monthly_salary < 17250) return 765
  if (monthly_salary < 17750) return 787.50
  if (monthly_salary < 18250) return 810
  if (monthly_salary < 18750) return 832.50
  if (monthly_salary < 19250) return 855
  if (monthly_salary < 19750) return 877.50
  return 900 // max
}

// PhilHealth: 5% of monthly salary, split 50/50 (employee pays 2.5%, min ₱500, max ₱5000)
export function calcPhilHealth(monthly_salary) {
  const contribution = monthly_salary * 0.05 / 2
  return Math.min(Math.max(contribution, 250), 2500)
}

// Pag-IBIG: 2% of monthly salary, max ₱200
export function calcPagIBIG(monthly_salary) {
  return Math.min(monthly_salary * 0.02, 200)
}

// Withholding tax (2024 TRAIN Law, monthly)
export function calcWithholdingTax(monthly_salary) {
  const annual = monthly_salary * 12
  if (annual <= 250000)  return 0
  if (annual <= 400000)  return Math.round((annual - 250000) * 0.15 / 12)
  if (annual <= 800000)  return Math.round((22500 + (annual - 400000) * 0.20) / 12)
  if (annual <= 2000000) return Math.round((102500 + (annual - 800000) * 0.25) / 12)
  if (annual <= 8000000) return Math.round((402500 + (annual - 2000000) * 0.30) / 12)
  return Math.round((2202500 + (annual - 8000000) * 0.35) / 12)
}

// ── LEAVE ──────────────────────────────────────────────────────────────────
export const LEAVE_ENTITLEMENT = {
  vacation: 5, // per year
  sick:     5, // per year
}

// ── SERVICE CHARGE ELIGIBILITY ─────────────────────────────────────────────
export function isServiceChargeEligible(late_count_this_month = 0, violation_count = 0) {
  return late_count_this_month <= 3 && violation_count === 0
}

// ── FULL PAYROLL COMPUTATION ───────────────────────────────────────────────
export function computePayroll(staff, days_worked, late_minutes = 0, absent_days = 0) {
  const { employment_type, role, monthly_rate, daily_rate } = staff
  const type = employment_type || 'Full-time'

  // Gross
  let gross = 0
  if (type === 'Full-time') {
    const monthly = monthly_rate || getBaseRate(type, role)?.monthly || 0
    gross = Math.round((monthly / 26) * days_worked)
  } else {
    const daily = daily_rate || getDailyRate(type, role)
    gross = daily * days_worked
  }

  // Deductions
  const late_deduction    = calcLateDeduction(type, role, late_minutes)
  const absence_deduction = calcAbsenceDeduction(type, role, absent_days)

  // Gov't deductions (Full-time only)
  let sss = 0, philhealth = 0, pagibig = 0, tax = 0
  if (type === 'Full-time') {
    const monthly = monthly_rate || getBaseRate(type, role)?.monthly || 0
    sss        = Math.round(calcSSS(monthly))
    philhealth = Math.round(calcPhilHealth(monthly))
    pagibig    = Math.round(calcPagIBIG(monthly))
    tax        = Math.round(calcWithholdingTax(monthly - sss - philhealth - pagibig))
  }

  const total_deductions = late_deduction + absence_deduction + sss + philhealth + pagibig + tax
  const net_pay = Math.max(0, gross - total_deductions)

  return {
    gross, late_deduction, absence_deduction,
    sss, philhealth, pagibig, tax,
    total_deductions, net_pay,
    days_worked, late_minutes, absent_days,
  }
}
