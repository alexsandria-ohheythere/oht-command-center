// ─────────────────────────────────────────────────────────────────────────────
// PATCH: app/contracts/page.js — 3 function replacements
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Replace saveContract function ─────────────────────────────────────────

  async function saveContract(sendNow=false) {
    if (!builderForm.title) { showToast('⚠️','Title required'); return }
    if (!editorHtml || editorHtml.trim()==='') { showToast('⚠️','Content is empty'); return }
    if (sendNow && !builderForm.staff_id) { showToast('⚠️','Select an employee to send'); return }
    setSaving(true)
    const payload = {
      title:builderForm.title, content_html:editorHtml,
      staff_id:builderForm.staff_id||null, status:sendNow?'pending_signature':'draft',
      employment_type:builderForm.employment_type, salary:builderForm.salary,
      start_date:builderForm.start_date||null, expires_at:builderForm.expires_at||null,
      created_by:'alex', sent_at:sendNow?new Date().toISOString():null,
      updated_at:new Date().toISOString(),
      variables:{
        company_name:builderForm.company_name, address_line1:builderForm.address_line1,
        address_line2:builderForm.address_line2, address_line3:builderForm.address_line3,
        logo_url:builderForm.logo_url,
      },
    }
    const { error } = await supabase.from('contracts').insert([payload])
    if (error) { showToast('❌',error.message); setSaving(false); return }
    if (sendNow && builderForm.staff_id) {
      await notifyOne(builderForm.staff_id,{type:'general',title:'📄 New Contract Awaiting Your Signature',message:`"${builderForm.title}" has been sent to you for signature.`})
      // ── Messenger ──
      await fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId: builderForm.staff_id, message: `📄 Contract Ready for Signature\n\n"${builderForm.title}" has been sent to you.\n\nPlease log in to your OHT Staff Portal to review and sign.` })
      }).catch(()=>{})
    }
    await fetchAll(); setView('list'); setEditorHtml('')
    setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',salary:'',start_date:'',expires_at:'',
      company_name:'OH HEY THERE Corp.',address_line1:'Unit A 156 A. Aguirre Ave.',
      address_line2:'Barangay BF Homes',address_line3:'Parañaque City',logo_url:'/oht-logo.png'})
    showToast(sendNow?'📤':'💾',sendNow?'Contract sent!':'Draft saved!'); setSaving(false)
  }


// ── 2. Replace sendForSignature function ──────────────────────────────────────

  async function sendForSignature(c) {
    await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',c.id)
    if (c.staff_id) {
      await notifyOne(c.staff_id,{type:'general',title:'📄 Contract Awaiting Your Signature',message:`"${c.title}" has been sent to you.`})
      // ── Messenger ──
      await fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId: c.staff_id, message: `📄 Contract Ready for Signature\n\n"${c.title}" has been sent to you.\n\nPlease log in to your OHT Staff Portal to review and sign.` })
      }).catch(()=>{})
    }
    await fetchAll(); setSelected(prev=>({...prev,status:'pending_signature'})); showToast('📤','Sent!')
  }


// ── 3. Replace submitCountersign function ─────────────────────────────────────
// Find: "setSaving(true)" at the start of submitCountersign
// Replace the end of the function (after the notifyOne call) with this:

      // ── after the existing notifyOne call, add: ──
      await fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId: selected.staff_id, message: `✅ Contract Fully Executed\n\n"${selected.title}" has been countersigned by ${mgmtSigner==='alex'?'Alex':'CJ'}.\n\nYour contract is now active. A copy has been saved to your Files.` })
      }).catch(()=>{})
      // ── end of addition ──
