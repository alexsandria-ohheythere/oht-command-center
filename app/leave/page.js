// ─────────────────────────────────────────────────────────────────────────────
// PATCH: app/leave/page.js
// Replace the updateStatus function with this one
// ─────────────────────────────────────────────────────────────────────────────

  async function updateStatus(id, status, approver) {
    const { error } = await supabase.from('leave_requests').update({ status, approved_by:approver, approved_at:new Date().toISOString() }).eq('id',id)
    if (error) { showToast('❌',error.message); return }
    const req = requests.find(r=>r.id===id)
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status,approved_by:approver}:r))
    // In-app notification
    if (req?.staff_id) {
      const lt = LEAVE_TYPES.find(x=>x.id===req.leave_type)
      const approverName = approver==='alex'?'Alex':'CJ'
      const dateRange = `${fmtDate(req.date_from)}${req.date_from!==req.date_to?' – '+fmtDate(req.date_to):''}`
      await notifyOne(req.staff_id, {
        type: status==='approved'?'leave_approved':'leave_rejected',
        title: status==='approved' ? `${lt?.icon} Leave Approved ✅` : `${lt?.icon} Leave Request Rejected`,
        message: status==='approved'
          ? `Your ${lt?.label} (${dateRange}) has been approved by ${approverName}.`
          : `Your ${lt?.label} request has been rejected by ${approverName}. Please speak to your manager.`,
      })
      // ── Messenger ──
      const messengerMsg = status==='approved'
        ? `✅ Leave Approved\n\n${lt?.label}\n${dateRange}\n\nApproved by ${approverName}. Log in to your OHT Staff Portal for details.`
        : `❌ Leave Request Rejected\n\n${lt?.label}\n${dateRange}\n\nRejected by ${approverName}. Please speak to your manager.`
      await fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId: req.staff_id, message: messengerMsg })
      }).catch(()=>{})
    }
    showToast(status==='approved'?'✅':'❌',`Request ${status} — staff notified`)
  }
