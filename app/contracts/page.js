'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne, notifyAdmins } from '../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const STATUS_STYLES = {
  draft:             { label:'Draft',             color:'#7a6a50', bg:'#f0ede8' },
  pending_signature: { label:'Pending Signature', color:'#a06000', bg:'#fef3e2' },
  signed:            { label:'Fully Signed',      color:'#4a7a1e', bg:'#eef7e4' },
  expired:           { label:'Expired',           color:'#c0392b', bg:'#fdeaea' },
  archived:          { label:'Archived',          color:'#4a90c4', bg:'#e8f0fb' },
}

const ROLES = ['Cafe Supervisor','Cafe Operations Support','Senior Barista','Junior Barista - Milk Station','Junior Barista - Cashier','Executive Chef','Sous Chef','Kitchen Staff']
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

const CAT_COLORS = { Role:'#b06af5', Duties:'#4a90c4', Terms:'#4a7a1e', Compensation:'#d4a843', Legal:'#c0392b', General:'#7a6a50' }
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

// Salary defaults per role
const ROLE_SALARY = {
  'Cafe Supervisor':              { ft:'₱22,000/month', pt:'₱700/day' },
  'Cafe Operations Support':      { ft:'₱18,000/month', pt:'₱600/day' },
  'Senior Barista':               { ft:'₱17,000/month', pt:'₱570/day' },
  'Junior Barista - Milk Station':{ ft:'₱15,000/month', pt:'₱500/day' },
  'Junior Barista - Cashier':     { ft:'₱15,000/month', pt:'₱500/day' },
  'Executive Chef':               { ft:'₱22,000/month', pt:'₱700/day' },
  'Sous Chef':                    { ft:'₱18,000/month', pt:'₱600/day' },
  'Kitchen Staff':                { ft:'₱15,000/month', pt:'₱500/day' },
}

export default function ContractsPage() {
  const supabase = createClient()
  const [view, setView]             = useState('list')
  const [contracts, setContracts]   = useState([])
  const [clauses, setClauses]       = useState([])
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [selected, setSelected]     = useState(null)
  const [toast, setToast]           = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStaff, setFilterStaff]   = useState('')

  // Builder state
  const [builderForm, setBuilderForm] = useState({
    title:'', staff_id:'', employment_type:'Full-time',
    start_date:'', salary:'', expires_at:'', custom_vars:{}
  })
  const [selectedClauses, setSelectedClauses] = useState([]) // ordered list of clause IDs
  const [dragIdx, setDragIdx]     = useState(null)
  const [catFilter, setCatFilter] = useState('All')
  const [clauseSearch, setClauseSearch] = useState('')
  const [preview, setPreview]     = useState(false)

  // Manage signatory modal
  const [showMgmtSign, setShowMgmtSign]     = useState(false)
  const [mgmtSigner, setMgmtSigner]         = useState('alex')
  const [mgmtSignMode, setMgmtSignMode]     = useState('type')
  const [mgmtTypedSig, setMgmtTypedSig]     = useState('')
  const mgmtCanvasRef = useRef(null)
  const isDrawing = useRef(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:c },{ data:cl },{ data:s }] = await Promise.all([
      supabase.from('contracts').select('*, staff(first_name,last_name,nickname,role,email)').order('created_at',{ascending:false}),
      supabase.from('contract_clauses').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('staff').select('*').order('last_name'),
    ])
    setContracts(c||[]); setClauses(cl||[]); setStaff(s||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),4000)}
  const bfv = k => e => setBuilderForm(p=>({...p,[k]:e.target.value}))

  // Auto-suggest clauses when role or employment type changes
  function autoSuggestClauses(role, empType) {
    const suggested = clauses.filter(c => {
      if (c.applicable_roles?.length === 0) return true
      return c.applicable_roles?.includes(role)
    }).filter(c => {
      if (empType === 'Full-time' && c.title === 'Pay - Part Time') return false
      if (empType !== 'Full-time' && c.title === 'Pay - Full Time') return false
      if (empType !== 'Full-time' && c.title === 'Hours of Work - Full Time') return false
      return true
    })
    setSelectedClauses(suggested.map(c => c.id))
  }

  function handleStaffChange(staffId) {
    setBuilderForm(p => ({ ...p, staff_id: staffId }))
    const s = staff.find(s => s.id === staffId)
    if (s) {
      const salary = ROLE_SALARY[s.role]
      setBuilderForm(p => ({
        ...p, staff_id: staffId,
        salary: builderForm.employment_type === 'Full-time' ? salary?.ft || '' : salary?.pt || '',
        title: `${builderForm.employment_type} Contract — ${s.first_name} ${s.last_name}`
      }))
      autoSuggestClauses(s.role, builderForm.employment_type)
    }
  }

  function handleEmpTypeChange(empType) {
    setBuilderForm(p => ({ ...p, employment_type: empType }))
    const s = staff.find(s => s.id === builderForm.staff_id)
    if (s) {
      const salary = ROLE_SALARY[s.role]
      setBuilderForm(p => ({
        ...p, employment_type: empType,
        salary: empType === 'Full-time' ? salary?.ft || '' : salary?.pt || '',
      }))
      autoSuggestClauses(s.role, empType)
    }
  }

  // Toggle clause in/out
  function toggleClause(clauseId) {
    setSelectedClauses(prev =>
      prev.includes(clauseId) ? prev.filter(id => id !== clauseId) : [...prev, clauseId]
    )
  }

  // Drag to reorder selected clauses
  function onDragStart(idx) { setDragIdx(idx) }
  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setSelectedClauses(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIdx(idx)
  }
  function onDragEnd() { setDragIdx(null) }

  // Build final contract content from clauses + variables
  function buildContent() {
    const staffMember = staff.find(s => s.id === builderForm.staff_id)
    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    const vars = {
      '{{employee_name}}': staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '',
      '{{position}}': staffMember?.role || '',
      '{{salary}}': builderForm.salary || '',
      '{{start_date}}': builderForm.start_date ? new Date(builderForm.start_date+'T00:00:00').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '',
      '{{company_name}}': 'OHT Cafe',
      '{{date_today}}': today,
      '{{employment_type}}': builderForm.employment_type,
      ...builderForm.custom_vars,
    }
    const header = `OHT Cafe
Unit A 156 A. Aguirre Ave., Barangay BF Homes, Parañaque City

${builderForm.employment_type.toUpperCase()} EMPLOYMENT CONTRACT & NON-DISCLOSURE AGREEMENT

${today}

${staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : ''}

Dear ${staffMember ? `${staffMember.first_name}` : 'Employee'};

We are pleased to inform you of your ${builderForm.employment_type.toLowerCase()} engagement with OHT Cafe on the terms set out below:\n\n`

    const orderedClauses = selectedClauses.map((id,i) => {
      const clause = clauses.find(c => c.id === id)
      if (!clause) return ''
      let content = clause.content
      Object.entries(vars).forEach(([k,v]) => { content = content.replaceAll(k, v||`[${k}]`) })
      return `${i+1}. ${content}`
    }).join('\n\n')

    const footer = `\n\nIN WITNESS WHEREOF, the parties have executed this Employment Contract as of the date first written above.\n\nIf you acknowledge that you have read and fully understood this CONTRACT and willingly consent to its terms, please sign below.\n\n\n_______________________________\nSignature Over Printed Name (Employee)\n\n_______________________________\nDate\n\n\nNoted by:\n\nAgnes Alexsandria S. Lalog\n_______________________________\nManaging Director & Co-founder\n\nCJ [Lastname]\n_______________________________\nCEO & Co-founder`

    return header + orderedClauses + footer
  }

  async function saveContract(sendNow = false) {
    if (!builderForm.title) { showToast('⚠️','Contract title required'); return }
    if (selectedClauses.length === 0) { showToast('⚠️','Add at least one clause'); return }
    if (sendNow && !builderForm.staff_id) { showToast('⚠️','Select an employee to send'); return }
    setSaving(true)
    const content = buildContent()
    const payload = {
      title: builderForm.title,
      content,
      staff_id: builderForm.staff_id || null,
      status: sendNow ? 'pending_signature' : 'draft',
      variables: { ...builderForm.custom_vars, salary:builderForm.salary, start_date:builderForm.start_date, employment_type:builderForm.employment_type },
      expires_at: builderForm.expires_at || null,
      created_by: 'alex',
      sent_at: sendNow ? new Date().toISOString() : null,
    }
    const { data, error } = await supabase.from('contracts').insert([payload]).select().single()
    if (error) { showToast('❌',error.message); setSaving(false); return }
    if (sendNow && builderForm.staff_id) {
      await notifyOne(builderForm.staff_id, {
        type:'general',
        title:'📄 Contract Awaiting Your Signature',
        message:`"${builderForm.title}" has been sent to you. Please review and sign it in your portal.`,
      })
    }
    await fetchAll()
    setView('list')
    setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',start_date:'',salary:'',expires_at:'',custom_vars:{}})
    setSelectedClauses([])
    showToast(sendNow?'📤':'💾', sendNow?'Contract sent for signature!':'Saved as draft')
    setSaving(false)
  }

  async function deleteContract(id) {
    if (!confirm('Delete this contract?')) return
    await supabase.from('contracts').delete().eq('id',id)
    setContracts(prev=>prev.filter(c=>c.id!==id))
    setView('list'); setSelected(null)
    showToast('🗑️','Deleted')
  }

  // Management countersign
  function startDraw(e) {
    isDrawing.current = true
    const canvas = mgmtCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX||e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY||e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath(); ctx.moveTo(x,y)
  }
  function draw(e) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = mgmtCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX||e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY||e.touches?.[0]?.clientY) - rect.top
    ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.strokeStyle='#1a1208'
    ctx.lineTo(x,y); ctx.stroke()
  }
  function endDraw() { isDrawing.current = false }
  function clearCanvas() {
    const canvas = mgmtCanvasRef.current
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
  }

  async function submitMgmtSignature() {
    if (!selected) return
    let sigData = ''
    if (mgmtSignMode === 'draw') {
      const canvas = mgmtCanvasRef.current
      sigData = canvas.toDataURL('image/png')
    } else {
      if (!mgmtTypedSig.trim()) { showToast('⚠️','Please type your name'); return }
      sigData = mgmtTypedSig
    }
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('contract_signatures').insert([{
      contract_id: selected.id,
      staff_id: null,
      signature_type: mgmtSignMode,
      signature_data: sigData,
      signed_at: now,
      signatory_type: 'management',
      user_agent: navigator.userAgent,
      audit_trail: [{ event:'management_countersigned', timestamp:now, signer:mgmtSigner }],
    }])
    await supabase.from('contracts').update({
      management_signed_at: now,
      management_signed_by: mgmtSigner,
      management_signature: sigData,
      status: 'signed',
    }).eq('id', selected.id)
    // Notify the employee
    if (selected.staff_id) {
      await notifyOne(selected.staff_id, {
        type:'general',
        title:'✅ Contract Fully Executed',
        message:`"${selected.title}" has been countersigned by ${mgmtSigner==='alex'?'Alex (Managing Director)':'CJ (CEO)'}. Your contract is now fully executed.`,
      })
    }
    await fetchAll()
    setSelected(prev=>({...prev,status:'signed',management_signed_at:now,management_signed_by:mgmtSigner}))
    setShowMgmtSign(false); setMgmtTypedSig(''); setSaving(false)
    showToast('✅','Contract countersigned & fully executed!')
  }

  // Filtered clauses for library
  const filteredClauses = clauses.filter(c => {
    if (catFilter !== 'All' && c.category !== catFilter) return false
    if (clauseSearch && !c.title.toLowerCase().includes(clauseSearch.toLowerCase())) return false
    return true
  })
  const categories = ['All', ...new Set(clauses.map(c => c.category))]
  const selectedClauseObjects = selectedClauses.map(id => clauses.find(c => c.id === id)).filter(Boolean)

  const filtered = contracts.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterStaff && c.staff_id !== filterStaff) return false
    return true
  })

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Contracts</div>
          <div className="topbar-sub">{contracts.length} total · {contracts.filter(c=>c.status==='pending_signature').length} awaiting signature</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {view!=='list'&&<button className="btn btn-secondary" onClick={()=>{setView('list');setSelected(null);setPreview(false)}}>← Back</button>}
          {view==='list'&&<button className="btn btn-primary" onClick={()=>{setView('builder');setSelectedClauses([]);setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',start_date:'',salary:'',expires_at:'',custom_vars:{}})}}>+ New Contract</button>}
          {view==='builder'&&<>
            <button onClick={()=>setPreview(!preview)} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              {preview?'← Edit':'👁 Preview'}
            </button>
            <button onClick={()=>saveContract(false)} disabled={saving} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--espresso)'}}>
              💾 Save Draft
            </button>
            <button onClick={()=>saveContract(true)} disabled={saving||!builderForm.staff_id} style={{background:builderForm.staff_id?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,cursor:builderForm.staff_id?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>
              📤 Send for Signature
            </button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* ── LIST ── */}
        {view==='list'&&<>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['all',...Object.keys(STATUS_STYLES)].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${filterStatus===s?'var(--espresso)':'var(--border)'}`,background:filterStatus===s?'var(--espresso)':'transparent',color:filterStatus===s?'var(--cream)':'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s',whiteSpace:'nowrap'}}>
                  {s==='all'?`All (${contracts.length})`:STATUS_STYLES[s]?.label+' ('+contracts.filter(c=>c.status===s).length+')'}
                </button>
              ))}
            </div>
            <select style={{...iStyle,width:'auto'}} value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}>
              <option value="">All Staff</option>
              {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>

          {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:
          filtered.length===0?(
            <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:8}}>No contracts yet</div>
              <button className="btn btn-primary" onClick={()=>setView('builder')}>+ Create First Contract</button>
            </div>
          ):(
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--espresso)'}}>
                  {['Contract','Employee','Status','Signatories','Created','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c,i)=>{
                    const st = STATUS_STYLES[c.status]||STATUS_STYLES.draft
                    const s = c.staff
                    const employeeSigned = c.signed_at
                    const mgmtSigned = c.management_signed_at
                    return(
                      <tr key={c.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)',cursor:'pointer'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--matcha-pale)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--white)':'var(--surface)'}>
                        <td style={{padding:'11px 14px'}} onClick={()=>{setSelected(c);setView('detail')}}>
                          <div style={{fontWeight:600}}>{c.title}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>by {c.created_by==='alex'?'Alex':'CJ'} · {fmtDate(c.created_at)}</div>
                        </td>
                        <td style={{padding:'11px 14px'}} onClick={()=>{setSelected(c);setView('detail')}}>
                          {s?(
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <div style={{width:24,height:24,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                              <div>
                                <div style={{fontWeight:600,fontSize:11}}>{s.first_name} {s.last_name}</div>
                                <div style={{fontSize:9,color:'var(--text-muted)'}}>{s.role}</div>
                              </div>
                            </div>
                          ):<span style={{color:'var(--text-muted)',fontSize:11}}>—</span>}
                        </td>
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:7,background:st.bg,color:st.color}}>{st.label}</span>
                        </td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',flexDirection:'column',gap:3}}>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10}}>
                              <span style={{fontSize:12}}>{employeeSigned?'✅':'⏳'}</span>
                              <span style={{color:employeeSigned?'var(--matcha-dark)':'var(--text-muted)',fontWeight:employeeSigned?600:400}}>
                                Employee {employeeSigned?'signed':'pending'}
                              </span>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10}}>
                              <span style={{fontSize:12}}>{mgmtSigned?'✅':'⏳'}</span>
                              <span style={{color:mgmtSigned?'var(--matcha-dark)':'var(--text-muted)',fontWeight:mgmtSigned?600:400}}>
                                {mgmtSigned?`${c.management_signed_by==='alex'?'Alex':'CJ'} signed`:'Mgmt pending'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text-muted)'}}>{fmtDate(c.created_at)}</td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>{setSelected(c);setView('detail')}} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>View</button>
                            {c.signed_at&&!c.management_signed_at&&(
                              <button onClick={()=>{setSelected(c);setShowMgmtSign(true)}} style={{background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Countersign</button>
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

        {/* ── BUILDER ── */}
        {view==='builder'&&!preview&&(
          <div style={{display:'grid',gridTemplateColumns:'280px 1fr 260px',gap:14,height:'calc(100vh - 130px)'}}>

            {/* LEFT — Clause Library */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'14px 14px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>📚 Clause Library</div>
                <input value={clauseSearch} onChange={e=>setClauseSearch(e.target.value)} placeholder="Search clauses…"
                  style={{...iStyle,padding:'6px 10px',fontSize:11,marginBottom:8}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {categories.map(cat=>(
                    <button key={cat} onClick={()=>setCatFilter(cat)}
                      style={{padding:'3px 8px',borderRadius:20,border:`1px solid ${catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--border)'}`,background:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)')+'22':'transparent',color:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--text-muted)',fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
                {filteredClauses.map(clause=>{
                  const isSelected = selectedClauses.includes(clause.id)
                  const color = CAT_COLORS[clause.category]||'#7a6a50'
                  return(
                    <div key={clause.id} onClick={()=>toggleClause(clause.id)}
                      style={{padding:'10px 12px',borderRadius:9,border:`1.5px solid ${isSelected?color:'var(--border)'}`,background:isSelected?color+'15':'var(--surface)',marginBottom:7,cursor:'pointer',transition:'all .15s'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600,color:isSelected?color:'var(--espresso)'}}>{clause.title}</span>
                        <span style={{fontSize:14}}>{isSelected?'✅':'➕'}</span>
                      </div>
                      <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4,background:color+'22',color}}>{clause.category}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* MIDDLE — Contract canvas */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:3}}>📄 Contract</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>Drag clauses below to reorder. Click ✕ to remove.</div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                {selectedClauseObjects.length===0?(
                  <div style={{textAlign:'center',padding:'40px',color:'var(--border)',border:'2px dashed var(--border)',borderRadius:10,marginTop:10}}>
                    <div style={{fontSize:32,marginBottom:8}}>📋</div>
                    <div style={{fontSize:12}}>Click clauses from the library to add them here</div>
                  </div>
                ):selectedClauseObjects.map((clause,idx)=>{
                  const color = CAT_COLORS[clause.category]||'#7a6a50'
                  return(
                    <div key={clause.id}
                      draggable
                      onDragStart={()=>onDragStart(idx)}
                      onDragOver={e=>onDragOver(e,idx)}
                      onDragEnd={onDragEnd}
                      style={{background:'var(--surface)',border:`1.5px solid ${dragIdx===idx?color:'var(--border)'}`,borderRadius:9,padding:'12px 13px',marginBottom:8,cursor:'grab',borderLeft:`4px solid ${color}`,opacity:dragIdx===idx?.5:1,transition:'all .15s'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12,color:'var(--text-muted)',cursor:'grab'}}>⠿</span>
                          <span style={{fontSize:11,fontWeight:700,color:color}}>{clause.title}</span>
                          <span style={{fontSize:9,background:color+'22',color,padding:'1px 6px',borderRadius:4,fontWeight:600}}>{clause.category}</span>
                        </div>
                        <button onClick={()=>toggleClause(clause.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:14,padding:'0 2px'}}
                          onMouseEnter={e=>e.currentTarget.style.color='#c0392b'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>✕</button>
                      </div>
                      <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{clause.content.slice(0,120)}{clause.content.length>120?'…':''}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:10,color:'var(--text-muted)'}}>{selectedClauses.length} clause{selectedClauses.length!==1?'s':''} added</span>
                {selectedClauses.length>0&&<button onClick={()=>setPreview(true)} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'none',borderRadius:7,padding:'5px 12px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>👁 Preview Contract</button>}
              </div>
            </div>

            {/* RIGHT — Settings */}
            <div style={{display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:14}}>⚙️ Contract Settings</div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Contract Title *</label>
                  <input style={iStyle} value={builderForm.title} onChange={bfv('title')} placeholder="e.g. Full-time Contract — Berna Castro"/>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Employment Type</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {['Full-time','Part-time','Freelancer'].map(t=>(
                      <div key={t} onClick={()=>handleEmpTypeChange(t)}
                        style={{padding:'7px 6px',borderRadius:7,border:`1.5px solid ${builderForm.employment_type===t?'var(--matcha)':'var(--border)'}`,background:builderForm.employment_type===t?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:600,color:builderForm.employment_type===t?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Assign Employee</label>
                  <select style={iStyle} value={builderForm.staff_id} onChange={e=>handleStaffChange(e.target.value)}>
                    <option value="">Select employee…</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Salary / Rate</label>
                  <input style={iStyle} value={builderForm.salary} onChange={bfv('salary')} placeholder="e.g. ₱17,000/month"/>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Start Date</label>
                  <input style={iStyle} type="date" value={builderForm.start_date} onChange={bfv('start_date')}/>
                </div>
                <div style={{marginBottom:0}}>
                  <label style={lStyle}>Expiry Date</label>
                  <input style={iStyle} type="date" value={builderForm.expires_at} onChange={bfv('expires_at')}/>
                </div>
              </div>

              {builderForm.staff_id&&(()=>{
                const s = staff.find(x=>x.id===builderForm.staff_id)
                if(!s) return null
                return(
                  <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:13,padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{initials(s.first_name,s.last_name)}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:'var(--matcha-dark)'}}>{s.first_name} {s.last_name}</div>
                        <div style={{fontSize:10,color:'var(--matcha-dark)',opacity:.8}}>{s.role}</div>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:'var(--matcha-dark)',opacity:.7}}>✅ Clauses auto-suggested for this role and employment type</div>
                  </div>
                )
              })()}

              {/* Signatory info */}
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>✍️ Signatories</div>
                <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.8}}>
                  <div>1️⃣ <strong>Employee</strong> signs first</div>
                  <div>2️⃣ <strong>Alex or CJ</strong> countersigns</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {view==='builder'&&preview&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:14}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'40px',lineHeight:1.9,fontSize:13,color:'var(--espresso)',whiteSpace:'pre-wrap',maxHeight:'calc(100vh - 160px)',overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
              {buildContent()}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:13,padding:'14px',fontSize:12,color:'var(--matcha-dark)',lineHeight:1.7}}>
                ✅ {selectedClauses.length} clauses<br/>
                👤 {builderForm.staff_id?staff.find(s=>s.id===builderForm.staff_id)?.first_name:'No employee'}<br/>
                💼 {builderForm.employment_type}<br/>
                💰 {builderForm.salary||'—'}<br/>
                📅 {builderForm.start_date||'—'}
              </div>
              <button onClick={()=>setPreview(false)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>← Back to Builder</button>
              <button onClick={()=>saveContract(false)} disabled={saving} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>💾 Save Draft</button>
              <button onClick={()=>saveContract(true)} disabled={saving||!builderForm.staff_id} style={{background:builderForm.staff_id?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:builderForm.staff_id?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>📤 Send for Signature</button>
            </div>
          </div>
        )}

        {/* ── DETAIL ── */}
        {view==='detail'&&selected&&(()=>{
          const st = STATUS_STYLES[selected.status]||STATUS_STYLES.draft
          const s = selected.staff
          const employeeSigned = selected.signed_at
          const mgmtSigned = selected.management_signed_at
          return(
            <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'36px',lineHeight:1.9,fontSize:13,color:'var(--espresso)',whiteSpace:'pre-wrap',maxHeight:'calc(100vh - 160px)',overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
                {selected.content}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Contract Status</div>
                  <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                </div>

                {/* Signature tracker */}
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>✍️ Signatures</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{padding:'10px 12px',borderRadius:9,background:employeeSigned?'var(--matcha-pale)':'var(--surface)',border:`1px solid ${employeeSigned?'var(--matcha)':'var(--border)'}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:employeeSigned?'var(--matcha-dark)':'var(--text-muted)',marginBottom:3}}>
                        {employeeSigned?'✅':'⏳'} Employee Signature
                      </div>
                      {employeeSigned?(
                        <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{fmtDateTime(employeeSigned)}</div>
                      ):(
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>Waiting for employee</div>
                      )}
                    </div>
                    <div style={{padding:'10px 12px',borderRadius:9,background:mgmtSigned?'var(--matcha-pale)':'var(--surface)',border:`1px solid ${mgmtSigned?'var(--matcha)':'var(--border)'}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:mgmtSigned?'var(--matcha-dark)':'var(--text-muted)',marginBottom:3}}>
                        {mgmtSigned?'✅':'⏳'} Management Signature
                      </div>
                      {mgmtSigned?(
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:'var(--matcha-dark)'}}>{selected.management_signed_by==='alex'?'Alex (Managing Director)':'CJ (CEO)'}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{fmtDateTime(mgmtSigned)}</div>
                        </div>
                      ):(
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{employeeSigned?'Ready for countersign':'Waiting for employee first'}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {selected.status==='draft'&&selected.staff_id&&(
                    <button onClick={async()=>{await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',selected.id);await notifyOne(selected.staff_id,{type:'general',title:'📄 Contract Awaiting Signature',message:`"${selected.title}" has been sent to you for signature.`});await fetchAll();setSelected(p=>({...p,status:'pending_signature'}));showToast('📤','Sent!')}}
                      style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      📤 Send for Signature
                    </button>
                  )}
                  {employeeSigned&&!mgmtSigned&&(
                    <button onClick={()=>setShowMgmtSign(true)}
                      style={{background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      ✍️ Countersign Now
                    </button>
                  )}
                  <button onClick={()=>deleteContract(selected.id)}
                    style={{background:'transparent',color:'#c0392b',border:'1px solid #f5c6c6',borderRadius:9,padding:'9px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    🗑 Delete Contract
                  </button>
                </div>

                {s&&(
                  <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white'}}>{initials(s.first_name,s.last_name)}</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{s.first_name} {s.last_name}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.email}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── MANAGEMENT COUNTERSIGN MODAL ── */}
      {showMgmtSign&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowMgmtSign(false)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4}}>✍️ Management Countersign</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:20}}>"{selected?.title}"</div>

            <div style={{marginBottom:14}}>
              <label style={lStyle}>Signing As</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['alex','Alex','Managing Director'],['cj','CJ','CEO']].map(([val,name,role])=>(
                  <div key={val} onClick={()=>setMgmtSigner(val)}
                    style={{padding:'10px 12px',borderRadius:9,border:`1.5px solid ${mgmtSigner===val?'var(--matcha)':'var(--border)'}`,background:mgmtSigner===val?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',transition:'all .15s'}}>
                    <div style={{fontSize:12,fontWeight:700,color:mgmtSigner===val?'var(--matcha-dark)':'var(--espresso)'}}>{name}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>{role}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={lStyle}>Signature Method</label>
              <div style={{display:'flex',gap:7,marginBottom:12}}>
                {[['draw','✍️ Draw'],['type','⌨️ Type']].map(([m,l])=>(
                  <button key={m} onClick={()=>setMgmtSignMode(m)}
                    style={{flex:1,padding:'8px',borderRadius:7,border:`1.5px solid ${mgmtSignMode===m?'#EF4576':'var(--border)'}`,background:mgmtSignMode===m?'#fdeef3':'var(--surface)',color:mgmtSignMode===m?'#EF4576':'var(--text-muted)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    {l}
                  </button>
                ))}
              </div>
              {mgmtSignMode==='draw'&&(
                <div>
                  <canvas ref={mgmtCanvasRef} width={400} height={100}
                    style={{border:'2px solid var(--border)',borderRadius:8,background:'var(--surface)',cursor:'crosshair',width:'100%',touchAction:'none'}}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                  <button onClick={clearCanvas} style={{fontSize:10,color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer',marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Clear</button>
                </div>
              )}
              {mgmtSignMode==='type'&&(
                <div>
                  <input value={mgmtTypedSig} onChange={e=>setMgmtTypedSig(e.target.value)} placeholder="Type your full name…"
                    style={{...iStyle,fontFamily:'cursive',fontSize:20,padding:'12px'}}/>
                  {mgmtTypedSig&&<div style={{marginTop:8,padding:'12px',background:'var(--surface)',borderRadius:8,textAlign:'center',fontFamily:'cursive',fontSize:24,color:'var(--espresso)'}}>{mgmtTypedSig}</div>}
                </div>
              )}
            </div>

            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:11,color:'#a06000',lineHeight:1.6}}>
              ⚖️ By countersigning, you confirm this contract is fully executed on behalf of OHT Cafe. This action is permanent and will notify the employee.
            </div>

            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setShowMgmtSign(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={submitMgmtSignature} disabled={saving}
                style={{flex:1,background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving?'Processing…':'✍️ Countersign Contract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
