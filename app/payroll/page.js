// ─────────────────────────────────────────────────────────────────────────────
// PATCH: app/payroll/page.js
// Replace the savePayroll function with this one
// ─────────────────────────────────────────────────────────────────────────────

  async function savePayroll() {
    if (!timesheetData) { showToast('⚠️','Upload a timesheet first'); return }
    setSaving(true)
    const rows = buildPayrollRows()
    const upsertData = rows.map(r => ({
      cutoff_id:selectedCutoff.id, cutoff_label:selectedCutoff.label,
      cutoff_start:selectedCutoff.start, cutoff_end:selectedCutoff.end,
      staff_id:r.staff.id, days_worked:r.pay.daysWorked, paid_hours:r.pay.paidHours,
      total_late_mins:r.pay.totalLateMins, late_count:r.pay.lateCount,
      gross:r.pay.gross, late_deduction:r.pay.lateDeduction,
      sss:r.pay.sss, philhealth:r.pay.philhealth, pagibig:r.pay.pagibig,
      tax:r.pay.tax, total_deductions:r.pay.totalDeductions, net_pay:r.pay.netPay,
      service_charge_eligible:r.pay.eligible, updated_at:new Date().toISOString()
    }))
    const { error } = await supabase.from('payroll_runs').upsert(upsertData, { onConflict:'cutoff_id,staff_id' })
    if (error) { showToast('❌',error.message); setSaving(false); return }
    await fetchSavedRuns(); setTimesheetData(null); setSaving(false)
    showToast('💾',`Payroll saved for ${selectedCutoff.label}`)

    const staffWithPay = rows.filter(r => r.pay.daysWorked > 0)

    // Messenger to each staff member with days worked
    await Promise.allSettled(staffWithPay.map(r =>
      fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          staffId: r.staff.id,
          message: `💰 Payslip Ready\n\n${selectedCutoff.label}\n\nYour payslip is now available. Log in to your OHT Staff Portal to view it.`
        })
      }).catch(()=>{})
    ))

    // Messenger to Alex & CJ
    const totalNet = staffWithPay.reduce((sum,r) => sum + r.pay.netPay, 0)
    await fetch('/api/messenger/send-by-emails', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        emails: ['ohheythere.matcha@gmail.com','ohheythere.group@gmail.com'],
        message: `💰 Payroll Saved\n\n${selectedCutoff.label}\n\n${staffWithPay.length} staff · Total net pay: ₱${Math.round(totalNet).toLocaleString('en-PH')}`
      })
    }).catch(()=>{})
  }
