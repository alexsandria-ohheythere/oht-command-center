'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'

const STATUS_STYLES = {
  draft:             { label:'Draft',            color:'#7a6a50', bg:'#f0ede8' },
  pending_signature: { label:'Pending Signature',color:'#a06000', bg:'#fef3e2' },
  signed:            { label:'Signed',           color:'#4a7a1e', bg:'#eef7e4' },
  expired:           { label:'Expired',          color:'#c0392b', bg:'#fdeaea' },
  archived:          { label:'Archived',         color:'#4a90c4', bg:'#e8f0fb' },
}

const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

const DEFAULT_VARIABLES = [
  '{{employee_name}}','{{position}}','{{salary}}','{{start_date}}',
  '{{contract_duration}}','{{department}}','{{company_name}}','{{date_today}}'
]

export default function ContractsPage() {
  const supabase = createClient()
  const [contracts, setContracts]   = useState([])
  const [templates, setTemplates]   = useState([])
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('list') // list | new | detail | templates
  const [selected, setSelected]     = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStaff, setFilterStaff]   = useState('')
  const [toast, setToast]           = useState(null)
  const [saving, setSaving]         = useState(false)

  // Contract builder form
  const [form, setForm] = useState({
    title: '', content: '', staff_id: '', template_id: '',
    expires_at: '', status: 'draft', variables: {},
  })

  // Template form
  const [tplForm, setTplForm] = useState({ name:'', description:'', content:'' })
  const [showTplForm, setShowTplForm] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:c },{ data:t },{ data:s }] = await Promise.all([
      supabase.from('contracts').select('*, staff(first_name,last_name,nickname,role,email)').order('created_at',{ascending:false}),
      supabase.from('contract_templates').select('*').eq('is_active',true).order('name'),
      supabase.from('staff').select('*').order('last_name'),
    ])
    setContracts(c||[]); setTemplates(t||[]); setStaff(s||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),4000)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  // Load template into builder
  function loadTemplate(tplId) {
    const tpl = templates.find(t=>t.id===tplId)
    if (tpl) setForm(p=>({...p, template_id:tplId, content:tpl.content, title:tpl.name}))
  }

  // Replace variables in content
  function resolveContent(content, variables, staffMember) {
    let resolved = content
    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    const defaults = {
      '{{employee_name}}': staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '',
      '{{position}}': staffMember?.role || '',
      '{{company_name}}': 'Oh Hey There',
      '{{date_today}}': today,
      ...variables,
    }
    Object.entries(defaults).forEach(([key, val]) => {
      resolved = resolved.replaceAll(key, val || `[${key}]`)
    })
    return resolved
  }

  async function saveContract(sendNow = false) {
    if (!form.title || !form.content) { showToast('⚠️','Title and content required'); return }
    setSaving(true)
    const staffMember = staff.find(s=>s.id===form.staff_id)
    const resolved = resolveContent(form.content, form.variables, staffMember)
    const payload = {
      title: form.title,
      content: resolved,
      staff_id: form.staff_id || null,
      template_id: form.template_id || null,
      status: sendNow ? 'pending_signature' : 'draft',
      variables: form.variables,
      expires_at: form.expires_at || null,
      created_by: 'alex',
      sent_at: sendNow ? new Date().toISOString() : null,
    }
    const { data, error } = await supabase.from('contracts').insert([payload]).select().single()
    if (error) { showToast('❌',error.message); setSaving(false); return }
    // Notify staff if sending
    if (sendNow && form.staff_id) {
      await notifyOne(form.staff_id, {
        type: 'general',
        title: '📄 New Contract Awaiting Signature',
        message: `"${form.title}" has been sent to you for signature. Please review and sign it in your portal.`,
      })
    }
    await fetchAll()
    setView('list')
    setForm({title:'',content:'',staff_id:'',template_id:'',expires_at:'',status:'draft',variables:{}})
    showToast(sendNow?'📤':'💾', sendNow?'Contract sent for signature':'Contract saved as draft')
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('contracts').update({ status }).eq('id',id)
    setContracts(prev=>prev.map(c=>c.id===id?{...c,status}:c))
    if (selected?.id===id) setSelected(prev=>({...prev,status}))
    showToast('✅',`Status updated to ${STATUS_STYLES[status]?.label}`)
  }

  async function deleteContract(id) {
    if (!confirm('Delete this contract?')) return
    await supabase.from('contracts').delete().eq('id',id)
    setContracts(prev=>prev.filter(c=>c.id!==id))
    setView('list')
    showToast('🗑️','Contract deleted')
  }

  async function saveTemplate() {
    if (!tplForm.name||!tplForm.content) { showToast('⚠️','Name and content required'); return }
    const { error } = await supabase.from('contract_templates').insert([{...tplForm, created_by:'alex'}])
    if (error) { showToast('❌',error.message); return }
    await fetchAll()
    setShowTplForm(false); setTplForm({name:'',description:'',content:''})
    showToast('✅','Template saved')
  }

  const filtered = contracts.filter(c => {
    if (filterStatus!=='all' && c.status!==filterStatus) return false
    if (filterStaff && c.staff_id!==filterStaff) return false
    return true
  })

  const ss = STATUS_STYLES

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Contracts</div>
          <div className="topbar-sub">{contracts.length} total · {contracts.filter(c=>c.status==='pending_signature').length} awaiting signature</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {view!=='list'&&<button className="btn btn-secondary" onClick={()=>setView('list')}>← Back</button>}
          {view==='list'&&<>
            <button onClick={()=>setView('templates')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>📋 Templates</button>
            <button className="btn btn-primary" onClick={()=>setView('new')}>+ New Contract</button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* ── LIST ── */}
        {view==='list'&&<>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['all',...Object.keys(ss)].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{padding:'6px 12px',borderRadius:7,border:`1px solid ${filterStatus===s?'var(--espresso)':'var(--border)'}`,background:filterStatus===s?'var(--espresso)':'transparent',color:filterStatus===s?'var(--cream)':'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                  {s==='all'?`All (${contracts.length})`:(ss[s]?.label+' ('+contracts.filter(c=>c.status===s).length+')')}
                </button>
              ))}
            </div>
            <select style={{...iStyle,width:'auto'}} value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}>
              <option value="">All Staff</option>
              {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>

          {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:filtered.length===0?(
            <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No contracts yet</div>
              <button className="btn btn-primary" onClick={()=>setView('new')}>+ Create First Contract</button>
            </div>
          ):(
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--espresso)'}}>
                  {['Contract','Employee','Status','Created','Expires','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c,i)=>{
                    const st = ss[c.status]||ss.draft
                    const s = c.staff
                    return(
                      <tr key={c.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)',cursor:'pointer'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--matcha-pale)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--white)':'var(--surface)'}>
                        <td style={{padding:'11px 14px'}} onClick={()=>{setSelected(c);setView('detail')}}>
                          <div style={{fontWeight:600,fontSize:13}}>{c.title}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Created by {c.created_by==='alex'?'Alex':'CJ'}</div>
                        </td>
                        <td style={{padding:'11px 14px'}} onClick={()=>{setSelected(c);setView('detail')}}>
                          {s?(
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                              <div>
                                <div style={{fontWeight:600}}>{s.first_name} {s.last_name}</div>
                                <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                              </div>
                            </div>
                          ):<span style={{color:'var(--text-muted)',fontSize:11}}>Unassigned</span>}
                        </td>
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                        </td>
                        <td style={{padding:'11px 14px',color:'var(--text-muted)',fontSize:11,fontFamily:"'DM Mono',monospace"}}>{fmtDate(c.created_at)}</td>
                        <td style={{padding:'11px 14px',color:c.expires_at&&new Date(c.expires_at)<new Date()?'#c0392b':'var(--text-muted)',fontSize:11,fontFamily:"'DM Mono',monospace"}}>{fmtDate(c.expires_at)}</td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>{setSelected(c);setView('detail')}} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'none',borderRadius:6,padding:'4px 9px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>View</button>
                            {c.status==='draft'&&c.staff_id&&(
                              <button onClick={async()=>{await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',c.id);await notifyOne(c.staff_id,{type:'general',title:'📄 Contract Awaiting Signature',message:`"${c.title}" has been sent to you for signature.`});await fetchAll();showToast('📤','Sent for signature')}}
                                style={{background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'none',borderRadius:6,padding:'4px 9px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Send</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>}

        {/* ── NEW CONTRACT BUILDER ── */}
        {view==='new'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,height:'calc(100vh-130px)'}}>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Contract Builder</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div>
                    <label style={lStyle}>Contract Title *</label>
                    <input style={iStyle} placeholder="e.g. Employment Contract" value={form.title} onChange={fv('title')}/>
                  </div>
                  <div>
                    <label style={lStyle}>Load Template</label>
                    <select style={iStyle} value={form.template_id} onChange={e=>loadTemplate(e.target.value)}>
                      <option value="">Start from scratch</option>
                      {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Assign To</label>
                    <select style={iStyle} value={form.staff_id} onChange={fv('staff_id')}>
                      <option value="">Select employee…</option>
                      {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Expiry Date</label>
                    <input style={iStyle} type="date" value={form.expires_at} onChange={fv('expires_at')}/>
                  </div>
                </div>
                {/* Variable chips */}
                <div style={{marginBottom:12}}>
                  <label style={lStyle}>Dynamic Variables — click to insert</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {DEFAULT_VARIABLES.map(v=>(
                      <span key={v} onClick={()=>setForm(p=>({...p,content:(p.content||'')+v}))}
                        style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:'3px 8px',background:'var(--sky-pale)',color:'var(--sky)',borderRadius:6,cursor:'pointer',border:'1px solid #4a90c422',transition:'all .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--sky)'.replace(')',', .2)')}
                        onMouseLeave={e=>e.currentTarget.style.background='var(--sky-pale)'}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lStyle}>Contract Content *</label>
                  <textarea
                    style={{...iStyle,resize:'vertical',minHeight:400,lineHeight:1.8,fontFamily:"'DM Sans',sans-serif",fontSize:13}}
                    placeholder="Write your contract here. Use {{variable_name}} for dynamic content…"
                    value={form.content}
                    onChange={fv('content')}/>
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Variable values */}
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:12}}>Fill Variables</div>
                {DEFAULT_VARIABLES.filter(v=>!['{{employee_name}}','{{position}}','{{company_name}}','{{date_today}}'].includes(v)).map(v=>{
                  const key = v.replace('{{','').replace('}}','')
                  return(
                    <div key={v} style={{marginBottom:8}}>
                      <label style={{...lStyle,marginBottom:3}}>{key.replace(/_/g,' ')}</label>
                      <input style={{...iStyle,padding:'6px 10px'}} placeholder={`Enter ${key.replace(/_/g,' ')}…`}
                        value={form.variables[v]||''}
                        onChange={e=>setForm(p=>({...p,variables:{...p.variables,[v]:e.target.value}}))}/>
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {form.staff_id&&form.content&&(
                <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:13,padding:'14px',fontSize:11,color:'var(--text-muted)',lineHeight:1.7,maxHeight:200,overflowY:'auto'}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8,color:'var(--text-muted)'}}>Preview</div>
                  <div style={{whiteSpace:'pre-wrap',fontSize:11}}>
                    {resolveContent(form.content,form.variables,staff.find(s=>s.id===form.staff_id)).slice(0,500)}…
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={()=>saveContract(false)} disabled={saving}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--espresso)'}}>
                  💾 Save as Draft
                </button>
                <button onClick={()=>saveContract(true)} disabled={saving||!form.staff_id}
                  style={{background:form.staff_id?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:9,padding:'11px',fontSize:12,fontWeight:700,cursor:form.staff_id?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>
                  {saving?'Saving…':'📤 Send for Signature'}
                </button>
                {!form.staff_id&&<div style={{fontSize:10,color:'var(--text-muted)',textAlign:'center'}}>Select an employee to send</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── DETAIL VIEW ── */}
        {view==='detail'&&selected&&(()=>{
          const st = ss[selected.status]||ss.draft
          const s = selected.staff
          return(
            <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
              {/* Contract content */}
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'32px',lineHeight:1.9,fontSize:13,color:'var(--espresso)',whiteSpace:'pre-wrap',maxHeight:'calc(100vh - 160px)',overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>{selected.title}</div>
                <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:24,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                  Created {fmtDate(selected.created_at)} · {st.label}
                </div>
                {selected.content}
              </div>

              {/* Right panel */}
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Contract Details</div>
                  <div style={{fontSize:11,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--text-muted)'}}>Status</span>
                      <span style={{fontWeight:700,padding:'2px 8px',borderRadius:6,background:st.bg,color:st.color,fontSize:10}}>{st.label}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--text-muted)'}}>Created</span>
                      <span style={{fontFamily:"'DM Mono',monospace"}}>{fmtDate(selected.created_at)}</span>
                    </div>
                    {selected.sent_at&&<div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--text-muted)'}}>Sent</span>
                      <span style={{fontFamily:"'DM Mono',monospace"}}>{fmtDate(selected.sent_at)}</span>
                    </div>}
                    {selected.signed_at&&<div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'#4a7a1e',fontWeight:600}}>✅ Signed</span>
                      <span style={{fontFamily:"'DM Mono',monospace"}}>{fmtDate(selected.signed_at)}</span>
                    </div>}
                    {selected.expires_at&&<div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--text-muted)'}}>Expires</span>
                      <span style={{fontFamily:"'DM Mono',monospace",color:new Date(selected.expires_at)<new Date()?'#c0392b':'inherit'}}>{fmtDate(selected.expires_at)}</span>
                    </div>}
                  </div>
                </div>

                {s&&(
                  <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Employee</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{s.first_name} {s.last_name}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.email}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Signature status */}
                {selected.status==='signed'&&(
                  <SignaturePreview contractId={selected.id} supabase={supabase}/>
                )}

                {/* Actions */}
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {selected.status==='draft'&&selected.staff_id&&(
                    <button onClick={async()=>{await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',selected.id);await notifyOne(selected.staff_id,{type:'general',title:'📄 Contract Awaiting Signature',message:`"${selected.title}" has been sent to you for signature.`});await fetchAll();setSelected(p=>({...p,status:'pending_signature'}));showToast('📤','Sent!')}}
                      style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      📤 Send for Signature
                    </button>
                  )}
                  <select style={iStyle} value={selected.status} onChange={e=>updateStatus(selected.id,e.target.value)}>
                    {Object.entries(ss).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={()=>deleteContract(selected.id)}
                    style={{background:'transparent',color:'#c0392b',border:'1px solid #f5c6c6',borderRadius:9,padding:'9px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    🗑 Delete Contract
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── TEMPLATES ── */}
        {view==='templates'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700}}>Contract Templates</div>
              <button className="btn btn-primary" onClick={()=>setShowTplForm(!showTplForm)}>+ New Template</button>
            </div>
            {showTplForm&&(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>New Template</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div><label style={lStyle}>Template Name *</label><input style={iStyle} placeholder="e.g. Employment Contract" value={tplForm.name} onChange={e=>setTplForm(p=>({...p,name:e.target.value}))}/></div>
                  <div><label style={lStyle}>Description</label><input style={iStyle} placeholder="Brief description" value={tplForm.description} onChange={e=>setTplForm(p=>({...p,description:e.target.value}))}/></div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={lStyle}>Template Content *</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {DEFAULT_VARIABLES.map(v=>(
                      <span key={v} onClick={()=>setTplForm(p=>({...p,content:(p.content||'')+v}))}
                        style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:'2px 7px',background:'var(--sky-pale)',color:'var(--sky)',borderRadius:5,cursor:'pointer'}}>
                        {v}
                      </span>
                    ))}
                  </div>
                  <textarea style={{...iStyle,resize:'vertical',minHeight:300,lineHeight:1.8,fontSize:13}} placeholder="Write template content…" value={tplForm.content} onChange={e=>setTplForm(p=>({...p,content:e.target.value}))}/>
                </div>
                <div style={{display:'flex',gap:9}}>
                  <button onClick={()=>setShowTplForm(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'9px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                  <button onClick={saveTemplate} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:9,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>✓ Save Template</button>
                </div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {templates.map(t=>(
                <div key={t.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px',borderTop:'3px solid var(--matcha)'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>{t.name}</div>
                  {t.description&&<div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>{t.description}</div>}
                  <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:12}}>{t.content.slice(0,100)}…</div>
                  <button onClick={()=>{setForm(p=>({...p,template_id:t.id,content:t.content,title:t.name}));setView('new')}}
                    style={{background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",width:'100%'}}>
                    Use Template
                  </button>
                </div>
              ))}
              {templates.length===0&&<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:12}}>No templates yet. Create one above.</div>}
            </div>
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}

function SignaturePreview({ contractId, supabase }) {
  const [sig, setSig] = useState(null)
  useEffect(() => {
    supabase.from('contract_signatures').select('*').eq('contract_id',contractId).single().then(({data})=>setSig(data))
  },[contractId])
  if (!sig) return null
  return (
    <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:13,padding:'14px'}}>
      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color:'var(--matcha-dark)',marginBottom:8}}>✅ Signed</div>
      {sig.signature_data&&sig.signature_type!=='draw'&&(
        <div style={{fontSize:20,fontFamily:'cursive',color:'var(--espresso)',marginBottom:6}}>{sig.signature_data}</div>
      )}
      {sig.signature_type==='draw'&&(
        <img src={sig.signature_data} alt="Signature" style={{maxWidth:'100%',maxHeight:60,marginBottom:6}}/>
      )}
      <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>
        {new Date(sig.signed_at).toLocaleString('en-PH')}<br/>
        IP: {sig.ip_address||'—'}
      </div>
    </div>
  )
}
