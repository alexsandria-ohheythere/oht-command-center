'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne, notifyAdmins } from '../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const fmtDT   = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const STATUS = {
  draft:             { label:'Draft',             color:'#7a6a50', bg:'#f0ede8' },
  pending_signature: { label:'Pending Signature', color:'#a06000', bg:'#fef3e2' },
  signed:            { label:'Fully Signed',      color:'#4a7a1e', bg:'#eef7e4' },
  expired:           { label:'Expired',           color:'#c0392b', bg:'#fdeaea' },
  archived:          { label:'Archived',          color:'#4a90c4', bg:'#e8f0fb' },
}

const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const CAT_COLORS = {Role:'#b06af5',Duties:'#4a90c4',Terms:'#4a7a1e',Compensation:'#d4a843',Legal:'#c0392b',General:'#7a6a50'}

const ROLE_SALARY = {
  'Cafe Supervisor':'PHP 22,000','Cafe Operations Support':'PHP 18,000',
  'Senior Barista':'PHP 17,000','Junior Barista - Milk Station':'PHP 15,000',
  'Junior Barista - Cashier':'PHP 15,000','Executive Chef':'PHP 22,000',
  'Sous Chef':'PHP 18,000','Kitchen Staff':'PHP 15,000',
}

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

// ── Messenger helpers ────────────────────────────────────────────────────────
async function messengerSend(staffId, message) {
  try {
    await fetch('/api/messenger/send', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ staffId, message })
    })
  } catch(e) {}
}
async function messengerSendByEmails(emails, message) {
  try {
    await fetch('/api/messenger/send-by-emails', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ emails, message })
    })
  } catch(e) {}
}

// ── Rich Text Editor ──
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null)
  useEffect(() => {
    if (editorRef.current && !editorRef.current._initialized) {
      editorRef.current.innerHTML = value || ''
      editorRef.current._initialized = true
    }
  }, [])
  function exec(cmd, val=null) {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    onChange(editorRef.current?.innerHTML || '')
  }
  const btn = (label, cmd, val=null, title='') => (
    <button key={label} title={title||label} onClick={()=>exec(cmd,val)}
      style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:5,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'var(--text-primary)',fontFamily:"'DM Sans',sans-serif",fontWeight:600,minWidth:28,textAlign:'center'}}>
      {label}
    </button>
  )
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,border:'1px solid var(--border)',borderRadius:9,overflow:'hidden'}}>
      <div style={{display:'flex',gap:4,padding:'8px 10px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexWrap:'wrap',alignItems:'center'}}>
        {btn('B','bold',null,'Bold')}
        {btn('I','italic',null,'Italic')}
        {btn('U','underline',null,'Underline')}
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        {btn('H1','formatBlock',null,'Heading 1')}
        {btn('H2','formatBlock','h2','Heading 2')}
        {btn('H3','formatBlock','h3','Heading 3')}
        {btn('¶','formatBlock','p','Paragraph')}
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        {btn('• List','insertUnorderedList')}
        {btn('1. List','insertOrderedList')}
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <select onChange={e=>exec('fontSize',e.target.value)} defaultValue="3"
          style={{...iStyle,width:'auto',padding:'3px 6px',fontSize:11}}>
          {[['1','8pt'],['2','10pt'],['3','12pt'],['4','14pt'],['5','18pt'],['6','24pt'],['7','36pt']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        {btn('✕ Format','removeFormat')}
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={()=>onChange(editorRef.current?.innerHTML||'')}
        style={{flex:1,padding:'20px',fontSize:13,lineHeight:1.8,color:'var(--espresso)',outline:'none',overflowY:'auto',minHeight:400,fontFamily:"'DM Sans',sans-serif"}}/>
    </div>
  )
}

// ── Contract Preview ──
function ContractPreview({ contract, staffMember, employeeSig, mgmtSig }) {
  const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
  const vars = contract.variables || {}
  const companyName = vars.company_name || 'OH HEY THERE Corp.'
  const addr1 = vars.address_line1 || 'Unit A 156 A. Aguirre Ave.'
  const addr2 = vars.address_line2 || 'Barangay BF Homes'
  const addr3 = vars.address_line3 || 'Parañaque City'
  const logoUrl = vars.logo_url || '/oht-logo.png'
  const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Employee'

  return (
    <div style={{background:'white',padding:'56px 64px',fontFamily:"'DM Sans',sans-serif",fontSize:13,lineHeight:1.9,color:'#1a1208',minHeight:'100%',maxWidth:800,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:48}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:900,color:'#EF4576',marginBottom:6}}>{companyName}</div>
          <div style={{fontSize:12,color:'#1a1208',lineHeight:1.8}}>{addr1}<br/>{addr2}<br/>{addr3}</div>
        </div>
        <img src={logoUrl} alt={companyName} style={{height:90,width:'auto',objectFit:'contain',maxWidth:160}}/>
      </div>
      <div style={{textAlign:'center',marginBottom:40}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,lineHeight:1.5,letterSpacing:.5}}>
          {(contract.title||'EMPLOYMENT CONTRACT').toUpperCase()}
        </div>
      </div>
      <div style={{marginBottom:24,fontSize:13}}>{today}</div>
      {staffMember && (
        <div style={{marginBottom:24}}>
          <div style={{fontWeight:700,fontSize:13}}>{staffName}</div>
          <div style={{fontSize:12,color:'#1a1208'}}>{staffMember.role}</div>
        </div>
      )}
      <div style={{marginBottom:20}}>Dear {staffName};</div>
      <div style={{marginBottom:32,lineHeight:1.9}}>
        We are pleased to inform that you will be in <strong>{contract.employment_type||'full-time'}</strong> engagement with {companyName}, with the position of <strong>{staffMember?.role||'[Position]'}</strong> on the terms set out below:
      </div>
      <div dangerouslySetInnerHTML={{__html: contract.content_html}} style={{marginBottom:40,lineHeight:1.9}}/>
      <div style={{marginTop:56}}>
        <div style={{marginBottom:24,lineHeight:1.8,fontSize:13}}>
          If you acknowledge that you have read and fully understood this CONTRACT and that you willingly and voluntarily assent and consent to the terms and conditions thereof, please sign on the space provided below.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,marginTop:40}}>
          <div>
            {employeeSig ? (
              <div style={{minHeight:70,display:'flex',alignItems:'flex-end',paddingBottom:4,marginBottom:4}}>
                {employeeSig.signature_type==='draw'
                  ? <img src={employeeSig.signature_data} alt="sig" style={{maxHeight:65,maxWidth:220}}/>
                  : <span style={{fontFamily:'cursive',fontSize:30,color:'#1a1208'}}>{employeeSig.signature_data}</span>}
              </div>
            ) : <div style={{minHeight:70,borderBottom:'1px solid #1a1208',marginBottom:4}}/>}
            <div style={{borderTop:'1px solid #1a1208',paddingTop:6,marginBottom:2,fontSize:12,fontWeight:600}}>{staffName}</div>
            <div style={{fontSize:11,color:'#7a6a50'}}>Signature Over Printed Name</div>
            <div style={{minHeight:28,borderBottom:'1px solid #1a1208',margin:'20px 0 4px'}}/>
            <div style={{fontSize:11,color:'#7a6a50'}}>Date</div>
            {employeeSig && <div style={{fontSize:9,color:'#7a6a50',marginTop:6,fontFamily:'monospace'}}>{fmtDT(employeeSig.signed_at)}</div>}
          </div>
          <div>
            <div style={{fontSize:11,color:'#7a6a50',marginBottom:8}}>Noted by:</div>
            {mgmtSig ? (
              <div style={{minHeight:70,display:'flex',alignItems:'flex-end',paddingBottom:4,marginBottom:4}}>
                {mgmtSig.signature_type==='draw'
                  ? <img src={mgmtSig.signature_data} alt="sig" style={{maxHeight:65,maxWidth:220}}/>
                  : <span style={{fontFamily:'cursive',fontSize:30,color:'#1a1208'}}>{mgmtSig.signature_data}</span>}
              </div>
            ) : <div style={{minHeight:70,borderBottom:'1px solid #1a1208',marginBottom:4}}/>}
            <div style={{borderTop:'1px solid #1a1208',paddingTop:6,marginBottom:2,fontSize:12,fontWeight:600}}>
              {mgmtSig ? (mgmtSig.audit_trail?.[0]?.signer==='alex' ? 'Agnes Alexsandria S. Lalog' : 'CJ') : 'Agnes Alexsandria S. Lalog'}
            </div>
            <div style={{fontSize:11,color:'#7a6a50'}}>Managing Director & Co-founder</div>
            {mgmtSig && <div style={{fontSize:9,color:'#7a6a50',marginTop:6,fontFamily:'monospace'}}>{fmtDT(mgmtSig.signed_at)}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──
export default function ContractsPage() {
  const supabase = createClient()
  const [view, setView]           = useState('list')
  const [contracts, setContracts] = useState([])
  const [clauses, setClauses]     = useState([])
  const [staff, setStaff]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState(null)
  const [selectedSigs, setSelectedSigs] = useState([])
  const [toast, setToast]         = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStaff, setFilterStaff]   = useState('')
  const [editorHtml, setEditorHtml]     = useState('')
  const [previewMode, setPreviewMode]   = useState(false)
  const [builderForm, setBuilderForm]   = useState({
    title:'', staff_id:'', employment_type:'Full-time', salary:'', start_date:'', expires_at:'',
    company_name:'OH HEY THERE Corp.', address_line1:'Unit A 156 A. Aguirre Ave.',
    address_line2:'Barangay BF Homes', address_line3:'Parañaque City', logo_url:'/oht-logo.png',
  })
  const [catFilter, setCatFilter]         = useState('All')
  const [clauseSearch, setClauseSearch]   = useState('')
  const [showClauseMgr, setShowClauseMgr] = useState(false)
  const [clauseForm, setClauseForm]       = useState({title:'',content:'',category:'General',applicable_roles:[]})
  const [editingClause, setEditingClause] = useState(null)
  const [showCountersign, setShowCountersign] = useState(false)
  const [mgmtSigner, setMgmtSigner]   = useState('alex')
  const [mgmtSignMode, setMgmtSignMode] = useState('type')
  const [mgmtTypedSig, setMgmtTypedSig] = useState('')
  const mgmtCanvasRef = useRef(null)
  const isDrawing = useRef(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:c, error:ce },{ data:cl },{ data:s }] = await Promise.all([
      supabase.from('contracts').select('id,title,content_html,staff_id,status,employment_type,salary,start_date,expires_at,created_by,sent_at,employee_signed_at,employee_signature,employee_signature_type,management_signed_at,management_signed_by,management_signature,management_signature_type,variables,created_at,updated_at, staff(first_name,last_name,nickname,role,email)').order('created_at',{ascending:false}),
      supabase.from('contract_clauses').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('staff').select('*').order('last_name'),
    ])
    if (ce) console.error('Contracts fetch error:', ce.message)
    setContracts(c||[]); setClauses(cl||[]); setStaff(s||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),4000)}
  const bfv = k => e => setBuilderForm(p=>({...p,[k]:e.target.value}))

  function handleStaffChange(staffId) {
    const s = staff.find(x=>x.id===staffId)
    if (s) {
      setBuilderForm(p=>({...p, staff_id:staffId, salary:ROLE_SALARY[s.role]||'',
        title:`${p.employment_type} Contract — ${s.first_name} ${s.last_name}`}))
    } else {
      setBuilderForm(p=>({...p, staff_id:staffId}))
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setBuilderForm(p=>({...p, logo_url:ev.target.result}))
    reader.readAsDataURL(file); e.target.value=''
  }

  function insertClause(clause) {
    const s = staff.find(x=>x.id===builderForm.staff_id)
    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    const vars = {
      '{{employee_name}}': s ? `${s.first_name} ${s.last_name}` : '',
      '{{position}}': s?.role||'', '{{salary}}':builderForm.salary||'',
      '{{start_date}}': builderForm.start_date ? new Date(builderForm.start_date+'T00:00:00').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '',
      '{{date_today}}':today, '{{employment_type}}':builderForm.employment_type,
      '{{company_name}}':builderForm.company_name,
    }
    let html = clause.content
    Object.entries(vars).forEach(([k,v]) => { html = html.replaceAll(k, v?`<strong>${v}</strong>`:`[${k}]`) })
    const newHtml = editorHtml + html + '<p></p>'
    setEditorHtml(newHtml)
    const editor = document.querySelector('[contenteditable]')
    if (editor) editor.innerHTML = newHtml
  }

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
      const staffMember = staff.find(s=>s.id===builderForm.staff_id)
      const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Staff'
      await notifyOne(builderForm.staff_id,{type:'general',title:'📄 New Contract Awaiting Your Signature',message:`"${builderForm.title}" has been sent to you for signature.`})
      await messengerSend(builderForm.staff_id, `📄 Contract Ready for Signature\n\n"${builderForm.title}" has been sent to you.\n\nPlease log in to your OHT Staff Portal to review and sign.`)
      await messengerSendByEmails(['hr.ohtgroup@gmail.com'], `📄 Contract Sent\n\n"${builderForm.title}" has been sent to ${staffName} for signature.`)
    }
    await fetchAll(); setView('list'); setEditorHtml('')
    setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',salary:'',start_date:'',expires_at:'',
      company_name:'OH HEY THERE Corp.',address_line1:'Unit A 156 A. Aguirre Ave.',
      address_line2:'Barangay BF Homes',address_line3:'Parañaque City',logo_url:'/oht-logo.png'})
    showToast(sendNow?'📤':'💾',sendNow?'Contract sent!':'Draft saved!'); setSaving(false)
  }

  async function openDetail(c) {
    setSelected(c)
    const { data:sigs } = await supabase.from('contract_signatures').select('*').eq('contract_id',c.id).order('signed_at')
    setSelectedSigs(sigs||[]); setView('detail')
  }

  async function sendForSignature(c) {
    await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',c.id)
    if (c.staff_id) {
      const staffMember = staff.find(s=>s.id===c.staff_id)
      const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Staff'
      await notifyOne(c.staff_id,{type:'general',title:'📄 Contract Awaiting Your Signature',message:`"${c.title}" has been sent to you.`})
      await messengerSend(c.staff_id, `📄 Contract Ready for Signature\n\n"${c.title}" has been sent to you.\n\nPlease log in to your OHT Staff Portal to review and sign.`)
      await messengerSendByEmails(['hr.ohtgroup@gmail.com'], `📄 Contract Sent\n\n"${c.title}" has been sent to ${staffName} for signature.`)
    }
    await fetchAll(); setSelected(prev=>({...prev,status:'pending_signature'})); showToast('📤','Sent!')
  }

  async function deleteContract(id) {
    if (!confirm('Delete this contract?')) return
    await supabase.from('contracts').delete().eq('id',id)
    await fetchAll(); setView('list'); setSelected(null); showToast('🗑️','Deleted')
  }

  async function saveClause() {
    if (!clauseForm.title||!clauseForm.content) { showToast('⚠️','Title and content required'); return }
    if (editingClause) {
      await supabase.from('contract_clauses').update(clauseForm).eq('id',editingClause.id)
    } else {
      const maxOrder = Math.max(0,...clauses.map(c=>c.sort_order))
      await supabase.from('contract_clauses').insert([{...clauseForm,sort_order:maxOrder+1}])
    }
    await fetchAll(); setClauseForm({title:'',content:'',category:'General',applicable_roles:[]}); setEditingClause(null)
    showToast('✅',editingClause?'Clause updated':'Clause created')
  }

  async function deleteClause(id) {
    if (!confirm('Delete this clause?')) return
    await supabase.from('contract_clauses').update({is_active:false}).eq('id',id)
    await fetchAll(); showToast('🗑️','Clause removed')
  }

  function startDraw(e) {
    isDrawing.current=true; const canvas=mgmtCanvasRef.current,ctx=canvas.getContext('2d')
    const rect=canvas.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo((e.clientX-rect.left)*(canvas.width/rect.width),(e.clientY-rect.top)*(canvas.height/rect.height))
  }
  function draw(e) {
    if(!isDrawing.current) return; e.preventDefault()
    const canvas=mgmtCanvasRef.current,ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect()
    ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.strokeStyle='#1a1208'
    ctx.lineTo((e.clientX-rect.left)*(canvas.width/rect.width),(e.clientY-rect.top)*(canvas.height/rect.height)); ctx.stroke()
  }
  function endDraw() { isDrawing.current=false }

  async function submitCountersign() {
    let sigData=''
    if (mgmtSignMode==='draw') {
      const canvas=mgmtCanvasRef.current
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
      if(!pixels.some(p=>p!==0)){showToast('⚠️','Please draw your signature');return}
      sigData=canvas.toDataURL('image/png')
    } else {
      if(!mgmtTypedSig.trim()){showToast('⚠️','Please type your name');return}
      sigData=mgmtTypedSig
    }
    setSaving(true)
    const now=new Date().toISOString()
    await supabase.from('contract_signatures').insert([{
      contract_id:selected.id, staff_id:null, signatory_type:'management',
      signature_type:mgmtSignMode, signature_data:sigData, signed_at:now,
      user_agent:navigator.userAgent,
      audit_trail:[{event:'management_countersigned',timestamp:now,signer:mgmtSigner}],
    }])
    await supabase.from('contracts').update({
      management_signed_at:now, management_signed_by:mgmtSigner,
      management_signature:sigData, management_signature_type:mgmtSignMode,
      status:'signed', updated_at:now,
    }).eq('id',selected.id)
    if (selected.staff_id) {
      const csStaffMember = staff.find(s=>s.id===selected.staff_id)
      const csStaffName = csStaffMember ? `${csStaffMember.first_name} ${csStaffMember.last_name}` : 'Staff'
      const signerName = mgmtSigner==='alex'?'Alex':'CJ'
      await notifyOne(selected.staff_id,{type:'general',title:'✅ Contract Fully Executed',
        message:`"${selected.title}" has been countersigned by ${signerName}. Your contract is now fully executed.`})
      await supabase.from('staff_files').insert([{
        staff_id:selected.staff_id, file_name:`${selected.title}.pdf`,
        file_url:'#contract-'+selected.id, file_type:'application/pdf',
        category:'Contract', description:`Signed contract — executed on ${fmtDate(now)}`,
        uploaded_by:'system', can_download:true, storage_path:'contract:'+selected.id,
      }])
      // Messenger to staff member
      await messengerSend(selected.staff_id, `✅ Contract Fully Executed\n\n"${selected.title}" has been countersigned by ${signerName}.\n\nYour contract is now active. A copy has been saved to your Files.`)
      // Messenger to Richelle (HR)
      await messengerSendByEmails(['hr.ohtgroup@gmail.com'], `✅ Contract Executed\n\n"${selected.title}" for ${csStaffName} has been fully countersigned by ${signerName}.`)
    }
    await fetchAll()
    const { data:sigs } = await supabase.from('contract_signatures').select('*').eq('contract_id',selected.id).order('signed_at')
    setSelectedSigs(sigs||[])
    setSelected(prev=>({...prev,status:'signed',management_signed_at:now,management_signed_by:mgmtSigner}))
    setShowCountersign(false); setMgmtTypedSig(''); setSaving(false)
    showToast('✅','Fully executed & saved to employee 201!')
  }

  function downloadContract() {
    if (!selected) return
    const empSig = selectedSigs.find(s=>s.signatory_type==='employee')
    const mgmtSig = selectedSigs.find(s=>s.signatory_type==='management')
    const staffMember = staff.find(s=>s.id===selected.staff_id)
    const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Employee'
    const vars = selected.variables || {}
    const companyName = vars.company_name || 'OH HEY THERE Corp.'
    const addr1 = vars.address_line1 || 'Unit A 156 A. Aguirre Ave.'
    const addr2 = vars.address_line2 || 'Barangay BF Homes'
    const addr3 = vars.address_line3 || 'Parañaque City'
    const logoUrl = vars.logo_url?.startsWith('data:') ? vars.logo_url : window.location.origin+(vars.logo_url||'/oht-logo.png')
    const empSigHtml = empSig ? (empSig.signature_type==='draw' ? `<img src="${empSig.signature_data}" style="max-height:65px;max-width:220px;"/>` : `<span style="font-family:cursive;font-size:28px;">${empSig.signature_data}</span>`) : ''
    const mgmtSigHtml = mgmtSig ? (mgmtSig.signature_type==='draw' ? `<img src="${mgmtSig.signature_data}" style="max-height:65px;max-width:220px;"/>` : `<span style="font-family:cursive;font-size:28px;">${mgmtSig.signature_data}</span>`) : ''
    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    const w = window.open('','_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>${selected.title}</title>
    <style>
      body{font-family:'Helvetica Neue',Helvetica,sans-serif;font-size:13px;line-height:1.9;color:#1a1208;padding:56px 72px;max-width:900px;margin:0 auto;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;}
      .brand{font-size:16px;font-weight:900;color:#EF4576;margin-bottom:6px;font-family:Helvetica,sans-serif;}
      .addr{font-size:12px;line-height:1.8;}
      .logo{height:90px;width:auto;object-fit:contain;max-width:160px;}
      .title{text-align:center;font-size:16px;font-weight:700;letter-spacing:.5px;line-height:1.5;margin-bottom:40px;font-family:Helvetica,sans-serif;}
      .content ul{margin:6px 0 6px 24px;} .content li{margin:3px 0;} .content ol{margin:6px 0 6px 24px;}
      .content strong{font-weight:700;} .content h1,.content h2,.content h3{margin:16px 0 8px;}
      .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px;}
      .sig-line{min-height:70px;border-bottom:1px solid #1a1208;margin-bottom:4px;display:flex;align-items:flex-end;padding-bottom:4px;}
      .sig-name{font-size:12px;font-weight:600;border-top:1px solid #1a1208;padding-top:6px;margin-bottom:2px;}
      .sig-role{font-size:11px;color:#7a6a50;}
      .sig-date-line{min-height:28px;border-bottom:1px solid #1a1208;margin:20px 0 4px;}
      .sig-ts{font-size:9px;color:#7a6a50;margin-top:6px;font-family:monospace;}
      @media print{body{padding:40px 56px;}}
    </style></head><body>
    <div class="header">
      <div><div class="brand">${companyName}</div><div class="addr">${addr1}<br/>${addr2}<br/>${addr3}</div></div>
      <img class="logo" src="${logoUrl}" alt="${companyName}"/>
    </div>
    <div class="title">${(selected.title||'').toUpperCase()}</div>
    <div style="margin-bottom:24px;">${today}</div>
    ${staffMember?`<div style="margin-bottom:24px;"><strong>${staffName}</strong><br/>${staffMember.role}</div>`:''}
    <div style="margin-bottom:20px;">Dear ${staffName};</div>
    <div style="margin-bottom:32px;">We are pleased to inform that you will be in <strong>${selected.employment_type||'full-time'}</strong> engagement with ${companyName}, with the position of <strong>${staffMember?.role||''}</strong> on the terms set out below:</div>
    <div class="content">${selected.content_html}</div>
    <div style="margin-top:40px;margin-bottom:24px;">If you acknowledge that you have read and fully understood this CONTRACT and that you willingly and voluntarily assent and consent to the terms and conditions thereof, please sign on the space provided below.</div>
    <div class="sig-grid">
      <div><div class="sig-line">${empSigHtml}</div><div class="sig-name">${staffName}</div><div class="sig-role">Signature Over Printed Name</div><div class="sig-date-line"></div><div class="sig-role">Date</div>${empSig?`<div class="sig-ts">${fmtDT(empSig.signed_at)}</div>`:''}</div>
      <div><div style="font-size:11px;color:#7a6a50;margin-bottom:8px;">Noted by:</div><div class="sig-line">${mgmtSigHtml}</div><div class="sig-name">${mgmtSig?(mgmtSig.audit_trail?.[0]?.signer==='alex'?'Agnes Alexsandria S. Lalog':'CJ'):'Agnes Alexsandria S. Lalog'}</div><div class="sig-role">Managing Director & Co-founder</div>${mgmtSig?`<div class="sig-ts">${fmtDT(mgmtSig.signed_at)}</div>`:''}</div>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),500);<\/script></body></html>`)
    w.document.close()
  }

  const filteredClauses = clauses.filter(c => {
    if (catFilter!=='All' && c.category!==catFilter) return false
    if (clauseSearch && !c.title.toLowerCase().includes(clauseSearch.toLowerCase())) return false
    return true
  })
  const categories = ['All',...[...new Set(clauses.map(c=>c.category))]]
  const filtered = contracts.filter(c => {
    if (filterStatus!=='all' && c.status!==filterStatus) return false
    if (filterStaff && c.staff_id!==filterStaff) return false
    return true
  })

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Contracts</div>
          <div className="topbar-sub">{contracts.length} contracts · {contracts.filter(c=>c.status==='pending_signature').length} pending</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {view==='list'&&<>
            <button onClick={()=>setShowClauseMgr(true)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:600,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>📚 Clauses</button>
            <button className="btn btn-primary" onClick={()=>setView('builder')}>+ New Contract</button>
          </>}
          {view==='builder'&&<>
            <button onClick={()=>{setView('list');setEditorHtml('');}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Cancel</button>
            <button onClick={()=>setPreviewMode(!previewMode)} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{previewMode?'← Edit':'👁 Preview'}</button>
            <button onClick={()=>saveContract(false)} disabled={saving} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>💾 Draft</button>
            <button onClick={()=>saveContract(true)} disabled={saving||!builderForm.staff_id} style={{background:builderForm.staff_id?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:builderForm.staff_id?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>📤 Send</button>
          </>}
          {view==='detail'&&<>
            <button onClick={()=>{setView('list');setSelected(null);setSelectedSigs([])}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>← Back</button>
            <button onClick={downloadContract} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>↓ PDF</button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* LIST */}
        {view==='list'&&<>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['all',...Object.keys(STATUS)].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${filterStatus===s?'var(--espresso)':'var(--border)'}`,background:filterStatus===s?'var(--espresso)':'transparent',color:filterStatus===s?'var(--cream)':'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',transition:'all .15s'}}>
                  {s==='all'?`All (${contracts.length})`:STATUS[s]?.label+' ('+contracts.filter(c=>c.status===s).length+')'}
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
                  {['Contract','Employee','Status','Signatures','Date','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c,i)=>{
                    const st=STATUS[c.status]||STATUS.draft
                    const s=c.staff
                    return(
                      <tr key={c.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)',cursor:'pointer'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--matcha-pale)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--white)':'var(--surface)'}>
                        <td style={{padding:'11px 14px'}} onClick={()=>openDetail(c)}>
                          <div style={{fontWeight:600,fontSize:12}}>{c.title}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{c.employment_type} · {c.salary||'—'}</div>
                        </td>
                        <td style={{padding:'11px 14px'}} onClick={()=>openDetail(c)}>
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
                        <td style={{padding:'11px 14px'}}><span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:7,background:st.bg,color:st.color}}>{st.label}</span></td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{fontSize:10,display:'flex',flexDirection:'column',gap:2}}>
                            <span>{c.employee_signed_at?'✅':'⏳'} Employee</span>
                            <span>{c.management_signed_at?'✅':'⏳'} Management</span>
                          </div>
                        </td>
                        <td style={{padding:'11px 14px',fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{fmtDate(c.created_at)}</td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>openDetail(c)} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>View</button>
                            {c.status==='draft'&&c.staff_id&&<button onClick={()=>sendForSignature(c)} style={{background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Send</button>}
                            {c.employee_signed_at&&!c.management_signed_at&&<button onClick={()=>{setSelected(c);setShowCountersign(true)}} style={{background:'#fdeef3',color:'#EF4576',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Countersign</button>}
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

        {/* BUILDER */}
        {view==='builder'&&(
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr 240px',gap:14,height:'calc(100vh - 130px)'}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:8}}>📚 Clauses</div>
                <input value={clauseSearch} onChange={e=>setClauseSearch(e.target.value)} placeholder="Search…" style={{...iStyle,padding:'6px 9px',fontSize:11,marginBottom:7}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {categories.map(cat=>(
                    <button key={cat} onClick={()=>setCatFilter(cat)}
                      style={{padding:'2px 7px',borderRadius:20,border:`1px solid ${catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--border)'}`,background:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)')+'22':'transparent',color:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--text-muted)',fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                {filteredClauses.map(clause=>{
                  const color=CAT_COLORS[clause.category]||'#7a6a50'
                  return(
                    <div key={clause.id} onClick={()=>insertClause(clause)}
                      style={{padding:'9px 11px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',marginBottom:6,cursor:'pointer',transition:'all .15s',borderLeft:`3px solid ${color}`}}
                      onMouseEnter={e=>{e.currentTarget.style.background=color+'15'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='var(--surface)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--espresso)',marginBottom:3}}>{clause.title}</div>
                      <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:color+'22',color}}>{clause.category}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            {previewMode?(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto'}}>
                <ContractPreview contract={{...builderForm,content_html:editorHtml}} staffMember={staff.find(s=>s.id===builderForm.staff_id)} employeeSig={null} mgmtSig={null}/>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <RichEditor value={editorHtml} onChange={setEditorHtml}/>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:10,overflowY:'auto'}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:12}}>⚙️ Settings</div>
                <div style={{marginBottom:9}}><label style={lStyle}>Title *</label><input style={iStyle} value={builderForm.title} onChange={bfv('title')} placeholder="Contract title…"/></div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Type</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                    {['Full-time','Part-time','Freelancer','Consignee'].map(t=>(
                      <div key={t} onClick={()=>setBuilderForm(p=>({...p,employment_type:t}))}
                        style={{padding:'6px 5px',borderRadius:6,border:`1.5px solid ${builderForm.employment_type===t?'var(--matcha)':'var(--border)'}`,background:builderForm.employment_type===t?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:9,fontWeight:600,color:builderForm.employment_type===t?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:9}}><label style={lStyle}>Employee</label><select style={iStyle} value={builderForm.staff_id} onChange={e=>handleStaffChange(e.target.value)}><option value="">Select…</option>{staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}</select></div>
                <div style={{marginBottom:9}}><label style={lStyle}>Salary / Rate</label><input style={iStyle} value={builderForm.salary} onChange={bfv('salary')} placeholder="e.g. PHP 17,000"/></div>
                <div style={{marginBottom:9}}><label style={lStyle}>Start Date</label><input style={iStyle} type="date" value={builderForm.start_date} onChange={bfv('start_date')}/></div>
                <div><label style={lStyle}>Expiry Date</label><input style={iStyle} type="date" value={builderForm.expires_at} onChange={bfv('expires_at')}/></div>
              </div>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,marginBottom:10}}>🏢 Header</div>
                <div style={{marginBottom:8}}><label style={lStyle}>Company Name</label><input style={{...iStyle,padding:'6px 9px',fontSize:11}} value={builderForm.company_name} onChange={e=>setBuilderForm(p=>({...p,company_name:e.target.value}))}/></div>
                <div style={{marginBottom:8}}><label style={lStyle}>Address Line 1</label><input style={{...iStyle,padding:'6px 9px',fontSize:11}} value={builderForm.address_line1} onChange={e=>setBuilderForm(p=>({...p,address_line1:e.target.value}))}/></div>
                <div style={{marginBottom:8}}><label style={lStyle}>Address Line 2</label><input style={{...iStyle,padding:'6px 9px',fontSize:11}} value={builderForm.address_line2} onChange={e=>setBuilderForm(p=>({...p,address_line2:e.target.value}))}/></div>
                <div style={{marginBottom:10}}><label style={lStyle}>Address Line 3</label><input style={{...iStyle,padding:'6px 9px',fontSize:11}} value={builderForm.address_line3} onChange={e=>setBuilderForm(p=>({...p,address_line3:e.target.value}))}/></div>
                <div>
                  <label style={lStyle}>Logo</label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={builderForm.logo_url} alt="Logo" style={{height:36,width:'auto',objectFit:'contain',border:'1px solid var(--border)',borderRadius:6,padding:4,background:'white',maxWidth:60}}/>
                    <label style={{flex:1,background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:7,padding:'5px 8px',fontSize:10,fontWeight:700,cursor:'pointer',textAlign:'center',fontFamily:"'DM Sans',sans-serif"}}>
                      Replace Logo
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoUpload}/>
                    </label>
                  </div>
                </div>
              </div>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,marginBottom:8}}>✍️ Signatories</div>
                <div style={{fontSize:10,color:'var(--text-muted)',lineHeight:1.8}}>
                  <div>1️⃣ Employee signs first</div>
                  <div>2️⃣ Alex or CJ countersigns</div>
                  <div>3️⃣ PDF saved to employee 201</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {view==='detail'&&selected&&(()=>{
          const st=STATUS[selected.status]||STATUS.draft
          const s=selected.staff
          const empSig=selectedSigs.find(x=>x.signatory_type==='employee')
          const mgmtSig=selectedSigs.find(x=>x.signatory_type==='management')
          return(
            <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto',maxHeight:'calc(100vh - 150px)'}}>
                <ContractPreview contract={selected} staffMember={s} employeeSig={empSig} mgmtSig={mgmtSig}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12,overflowY:'auto',maxHeight:'calc(100vh - 150px)'}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>Status</div>
                  <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                  {selected.salary&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>💰 {selected.salary} · {selected.employment_type}</div>}
                  {selected.start_date&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>📅 Starts {fmtDate(selected.start_date)}</div>}
                </div>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>✍️ Signatures</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{padding:'10px 12px',borderRadius:9,background:empSig?'var(--matcha-pale)':'var(--surface)',border:`1px solid ${empSig?'var(--matcha)':'var(--border)'}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:empSig?'var(--matcha-dark)':'var(--text-muted)',marginBottom:3}}>{empSig?'✅ Employee Signed':'⏳ Employee Pending'}</div>
                      {empSig&&<div style={{fontSize:9,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{fmtDT(empSig.signed_at)}</div>}
                    </div>
                    <div style={{padding:'10px 12px',borderRadius:9,background:mgmtSig?'var(--matcha-pale)':'var(--surface)',border:`1px solid ${mgmtSig?'var(--matcha)':'var(--border)'}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:mgmtSig?'var(--matcha-dark)':'var(--text-muted)',marginBottom:3}}>{mgmtSig?`✅ ${selected.management_signed_by==='alex'?'Alex':'CJ'} Countersigned`:'⏳ Mgmt Pending'}</div>
                      {mgmtSig&&<div style={{fontSize:9,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{fmtDT(mgmtSig.signed_at)}</div>}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {selected.status==='draft'&&selected.staff_id&&(
                    <button onClick={()=>sendForSignature(selected)} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>📤 Send for Signature</button>
                  )}
                  {empSig&&!mgmtSig&&(
                    <button onClick={()=>setShowCountersign(true)} style={{background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>✍️ Countersign Now</button>
                  )}
                  {selected.status==='signed'&&(
                    <button onClick={downloadContract} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>↓ Download PDF</button>
                  )}
                  <button onClick={()=>deleteContract(selected.id)} style={{background:'transparent',color:'#c0392b',border:'1px solid #f5c6c6',borderRadius:9,padding:'9px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>🗑 Delete</button>
                </div>
                {s&&(
                  <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white'}}>{initials(s.first_name,s.last_name)}</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:12}}>{s.first_name} {s.last_name}</div>
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

      {/* CLAUSE MANAGER */}
      {showClauseMgr&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowClauseMgr(false)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:0,width:'100%',maxWidth:800,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,.3)',overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>📚 Manage Clauses</div>
              <button onClick={()=>setShowClauseMgr(false)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer',color:'var(--text-muted)'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',flex:1,overflow:'hidden'}}>
              <div style={{borderRight:'1px solid var(--border)',overflowY:'auto',padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>Existing Clauses</div>
                {clauses.map(c=>{
                  const color=CAT_COLORS[c.category]||'#7a6a50'
                  return(
                    <div key={c.id} style={{padding:'10px 12px',borderRadius:9,border:'1px solid var(--border)',marginBottom:7,borderLeft:`3px solid ${color}`}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:600}}>{c.title}</span>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>{setEditingClause(c);setClauseForm({title:c.title,content:c.content,category:c.category,applicable_roles:c.applicable_roles||[]})}} style={{background:'transparent',border:'none',fontSize:12,cursor:'pointer',color:'var(--sky)'}}>✏️</button>
                          <button onClick={()=>deleteClause(c.id)} style={{background:'transparent',border:'none',fontSize:12,cursor:'pointer',color:'var(--text-muted)'}} onMouseEnter={e=>e.currentTarget.style.color='#c0392b'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>🗑</button>
                        </div>
                      </div>
                      <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:color+'22',color}}>{c.category}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{overflowY:'auto',padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>{editingClause?'Edit Clause':'+ New Clause'}</div>
                <div style={{marginBottom:10}}><label style={lStyle}>Title *</label><input style={iStyle} value={clauseForm.title} onChange={e=>setClauseForm(p=>({...p,title:e.target.value}))} placeholder="Clause title…"/></div>
                <div style={{marginBottom:10}}><label style={lStyle}>Category</label><select style={iStyle} value={clauseForm.category} onChange={e=>setClauseForm(p=>({...p,category:e.target.value}))}>{['Role','Duties','Terms','Compensation','Legal','General'].map(c=><option key={c}>{c}</option>)}</select></div>
                <div style={{marginBottom:12}}><label style={lStyle}>Content (HTML allowed)</label><textarea value={clauseForm.content} onChange={e=>setClauseForm(p=>({...p,content:e.target.value}))} placeholder="Use <strong>, <ul>, <li>, <p> tags…" style={{...iStyle,resize:'vertical',minHeight:180,lineHeight:1.6,fontSize:12}}/></div>
                <div style={{display:'flex',gap:8}}>
                  {editingClause&&<button onClick={()=>{setEditingClause(null);setClauseForm({title:'',content:'',category:'General',applicable_roles:[]})}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Cancel</button>}
                  <button onClick={saveClause} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'9px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    {editingClause?'✓ Update':'✓ Save Clause'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COUNTERSIGN MODAL */}
      {showCountersign&&selected&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowCountersign(false)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4}}>✍️ Countersign</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:20}}>"{selected.title}"</div>
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
              <label style={lStyle}>Method</label>
              <div style={{display:'flex',gap:7,marginBottom:12}}>
                {[['type','⌨️ Type'],['draw','✍️ Draw']].map(([m,l])=>(
                  <button key={m} onClick={()=>setMgmtSignMode(m)}
                    style={{flex:1,padding:'8px',borderRadius:7,border:`1.5px solid ${mgmtSignMode===m?'#EF4576':'var(--border)'}`,background:mgmtSignMode===m?'#fdeef3':'var(--surface)',color:mgmtSignMode===m?'#EF4576':'var(--text-muted)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    {l}
                  </button>
                ))}
              </div>
              {mgmtSignMode==='type'&&(
                <div>
                  <input value={mgmtTypedSig} onChange={e=>setMgmtTypedSig(e.target.value)} placeholder="Type your full name…"
                    style={{...iStyle,fontFamily:'cursive',fontSize:18,padding:'12px'}}/>
                  {mgmtTypedSig&&<div style={{marginTop:8,padding:'12px',background:'var(--surface)',borderRadius:8,textAlign:'center',fontFamily:'cursive',fontSize:26,color:'var(--espresso)'}}>{mgmtTypedSig}</div>}
                </div>
              )}
              {mgmtSignMode==='draw'&&(
                <div>
                  <canvas ref={mgmtCanvasRef} width={400} height={100}
                    style={{border:'2px solid var(--border)',borderRadius:8,background:'var(--surface)',cursor:'crosshair',width:'100%',touchAction:'none',display:'block'}}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}/>
                  <button onClick={()=>mgmtCanvasRef.current?.getContext('2d').clearRect(0,0,400,100)} style={{fontSize:10,color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer',marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Clear</button>
                </div>
              )}
            </div>
            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:11,color:'#a06000',lineHeight:1.6}}>
              ⚖️ This contract will be marked <strong>Fully Signed</strong> and saved to the employee's Files · 201.
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setShowCountersign(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={submitCountersign} disabled={saving}
                style={{flex:1,background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving?'Processing…':'✍️ Countersign & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
