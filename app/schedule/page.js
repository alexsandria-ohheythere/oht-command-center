// ─────────────────────────────────────────────────────────────────────────────
// PATCH: app/schedule/page.js
// Replace the publishSchedule function with this one
// ─────────────────────────────────────────────────────────────────────────────

  async function publishSchedule() {
    setPublishing(true)
    await supabase.from('schedules').update({published:true}).eq('week_start',weekStart)
    setSchedules(prev=>prev.map(s=>({...s,published:true})))
    setShowPublishModal(false)
    setPublishing(false)
    showToast('📣','Schedule published!')
    // ── Messenger: notify each assigned staff member ──
    const uniqueStaffIds = [...new Set(schedules.map(s=>s.staff_id))]
    const weekLabel = `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}`
    await Promise.allSettled(uniqueStaffIds.map(staffId =>
      fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId, message: `📅 Schedule Published\n\nYour schedule for ${weekLabel} is now available. Log in to your OHT Staff Portal to view your shifts.` })
      }).catch(()=>{})
    ))
  }
