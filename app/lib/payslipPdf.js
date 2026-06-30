// Shared payslip PDF generator — matches the OH HEY THERE Corp. payslip format.
// Drop this file at: lib/payslipPdf.js  (in BOTH repos)
// Usage: import { generatePayslipPDF } from '../../lib/payslipPdf'  (adjust depth)
//        await generatePayslipPDF({ staff, run, periodStart, periodEnd })
//
// Loads jsPDF from CDN on first call (no build step / npm install needed).

let _jspdfPromise = null
function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF)
  if (_jspdfPromise) return _jspdfPromise
  _jspdfPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = () => resolve(window.jspdf.jsPDF)
    s.onerror = () => reject(new Error('Failed to load PDF library'))
    document.head.appendChild(s)
  })
  return _jspdfPromise
}

const money = n => 'PHP ' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// run is a normalized object — see buildPayslipRun() below.
export async function generatePayslipPDF({ staff, run, periodStart, periodEnd }) {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const PINK = [231, 62, 110]
  const DARK = [40, 40, 40]
  const GREY = [120, 120, 120]

  const L = 56            // left margin
  const RCOL = 300        // right column x (for the deductions side)
  const valR = 250        // right edge for left-column values
  const valR2 = W - 56    // right edge for right-column values
  let y = 70

  // ── Header ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...PINK)
  doc.text('OH HEY THERE Corp.', L, y)
  // (logo intentionally omitted — embedding requires a hosted asset; brand text used instead)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
  y += 18; doc.text('Unit A 156 A. Aguirre Ave.,', L, y)
  y += 14; doc.text('BF Homes', L, y)
  y += 14; doc.text('Paranaque City', L, y)
  y += 14; doc.text('1700', L, y)

  // ── Period + Bank block ──
  y += 30
  const labelVal = (label, val, lx, vx, vAlign = 'right') => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text(label, lx, y)
    doc.setFont('helvetica', 'normal')
    if (val) doc.text(String(val), vx, y, { align: vAlign })
  }
  labelVal('Payroll Period - Start', periodStart, L, valR); labelVal('Bank', staff?.bank_name || '', RCOL, valR2); y += 16
  labelVal('Payroll Period - End', periodEnd, L, valR); labelVal('Bank Acccount Number', staff?.bank_account_no || '', RCOL, valR2); y += 24

  labelVal('Employee ID No.', staff?.employee_id_no || '', L, valR); labelVal('TIN', staff?.tin || '', RCOL, valR2); y += 16
  labelVal('Position', `${staff?.employment_type || 'Full-time'} ${staff?.role || ''}`.trim(), L, valR); labelVal('SSS', staff?.sss_no || '', RCOL, valR2); y += 16
  labelVal('Last Name', staff?.last_name || '', L, valR); labelVal('PHIC', staff?.phic_no || '', RCOL, valR2); y += 16
  labelVal('Full Name', staff?.first_name || '', L, valR); labelVal('HDMF', staff?.hdmf_no || '', RCOL, valR2); y += 30

  // ── Earnings / Deductions headers ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DARK)
  doc.text('Earnings', L, y); doc.text('Deductions', RCOL, y)
  doc.setFontSize(10)
  const earningsY = y + 18
  const dedY = y + 18

  // Left column: Earnings
  let ly = earningsY
  const lineL = (label, val) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    doc.text(label, L, ly); doc.text(money(val), valR, ly, { align: 'right' }); ly += 16
  }
  lineL('Basic', run.basic)
  lineL('Incentives/Overtime', run.incentives)
  lineL('Refund', run.refund)
  ly += 4
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...PINK)
  doc.text('Gross Pay', L, ly); doc.text(money(run.grossPay), valR, ly, { align: 'right' }); ly += 24

  // Right column: Deductions
  let ry = dedY
  const lineR = (label, val) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    doc.text(label, RCOL, ry); doc.text(money(val), valR2, ry, { align: 'right' }); ry += 16
  }
  lineR('SSS', run.sss)
  lineR('PHIC', run.philhealth)
  lineR('HDMF', run.pagibig)
  lineR('Tax', run.tax)
  ry += 4
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...PINK)
  doc.text('Total Deductions', RCOL, ry); doc.text(money(run.totalGovDeductions), valR2, ry, { align: 'right' })

  // ── Attendance Deductions (left) ──
  ly += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DARK)
  doc.text('Attendance Deductions', L, ly); ly += 18; doc.setFontSize(10)
  lineL('Late', run.late)
  lineL('Undertime', run.undertime)
  lineL('Absence', run.absence)
  ly += 4
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...PINK)
  doc.text('Total Attendance Deductions', L, ly); doc.text(money(run.totalAttendance), valR, ly, { align: 'right' }); ly += 34

  // ── Net Pay ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...PINK)
  doc.text('Net Pay', L, ly); doc.text(money(run.netPay), valR, ly, { align: 'right' })

  const fname = `OHT-Payslip-${(staff?.last_name||'Employee')}-${run.periodLabel||''}`.replace(/[^a-zA-Z0-9-]/g, '_') + '.pdf'
  doc.save(fname)
}

// Normalizes a payroll_runs row + computed extras into the PDF's expected shape.
// absenceDays = number of no-show days; dailyRate from the rate engine.
export function buildPayslipRun({ saved, dailyRate = 0, absenceDays = 0, periodLabel = '' }) {
  const num = v => parseFloat(v) || 0
  const basic = num(saved.gross)
  const incentives = num(saved.incentives)
  const refund = num(saved.refund)
  const grossPay = basic + incentives + refund
  const sss = num(saved.sss), philhealth = num(saved.philhealth), pagibig = num(saved.pagibig), tax = num(saved.tax)
  const totalGovDeductions = sss + philhealth + pagibig + tax
  const late = num(saved.late_deduction)
  const undertime = num(saved.undertime)
  const absence = Math.round(absenceDays * dailyRate)
  const totalAttendance = late + undertime + absence
  const netPay = Math.max(0, grossPay - totalGovDeductions - totalAttendance)
  return { basic, incentives, refund, grossPay, sss, philhealth, pagibig, tax, totalGovDeductions, late, undertime, absence, totalAttendance, netPay, periodLabel }
}
