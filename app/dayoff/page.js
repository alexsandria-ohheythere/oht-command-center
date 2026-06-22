// ─────────────────────────────────────────────────────────────────────────────
// PATCH: app/dayoff/page.js
// Replace the confirmAssign function with this one
// ─────────────────────────────────────────────────────────────────────────────

  async function confirmAssign() {
    if (!confirmBox) return
    setSaving(true)
    const { staff:s, iso } = confirmBox
    const { error } = await supabase.from('day_offs').insert([{ staff_id:s.staff_id, date_from:iso, date_to:iso, reason:null }])
    if (error) { showToast('❌',error.message); setSaving(false); setConfirmBox(null); return }
    await notifyOne(s.staff_id, {
      type:'general',
      title:'📆 Day-Off Assigned',
      message:`You have been assigned a day-off on ${fmtFull(iso)}. You won't be scheduled for any shift on this date.`,
    })
    // ── Messenger ──
    await fetch('/api/messenger/send', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ staffId: s.staff_id, message: `📆 Day-Off Assigned\n\n${fmtFull(iso)}\n\nYou won't be scheduled for any shift on this date.` })
    }).catch(()=>{})
    await fetchAll()
    setConfirmBox(null)
    showToast('✅',`Day-off saved · ${s.name} · ${fmtShort(iso)}`)
    setSaving(false)
  }
