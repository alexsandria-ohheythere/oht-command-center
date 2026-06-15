'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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
  'Cafe Supervisor':               'PHP 22,000',
  'Cafe Operations Support':       'PHP 18,000',
  'Senior Barista':                'PHP 17,000',
  'Junior Barista - Milk Station': 'PHP 15,000',
  'Junior Barista - Cashier':      'PHP 15,000',
  'Executive Chef':                'PHP 22,000',
  'Sous Chef':                     'PHP 18,000',
  'Kitchen Staff':                 'PHP 15,000',
}

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

// OHT Logo SVG (text-based fallback)
const OHT_LOGO_SVG = `<svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="40" rx="8" fill="#EF4576"/>
  <text x="60" y="16" font-family="Montserrat,sans-serif" font-size="9" font-weight="900" fill="white" text-anchor="middle">OH HEY THERE</text>
  <text x="60" y="30" font-family="Montserrat,sans-serif" font-size="7" font-weight="600" fill="rgba(255,255,255,0.8)" text-anchor="middle">MATCHA CAFE</text>
</svg>`

// Rich text editor toolbar
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [])

  function exec(cmd, val = null) {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    onChange(editorRef.current?.innerHTML || '')
  }

  const btnStyle = (active=false) => ({
    background: active ? 'var(--espresso)' : 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    color: active ? 'var(--cream)' : 'var(--text-primary)',
    fontFamily: "'DM Sans',sans-serif",
    fontWeight: 600,
    minWidth: 28,
    textAlign: 'center',
  })

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,border:'1px solid var(--border)',borderRadius:9,overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{display:'flex',gap:4,padding:'8px 10px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexWrap:'wrap',alignItems:'center'}}>
        <button style={btnStyle()} onClick={()=>exec('bold')} title="Bold"><strong>B</strong></button>
        <button style={btnStyle()} onClick={()=>exec('italic')} title="Italic"><em>I</em></button>
        <button style={btnStyle()} onClick={()=>exec('underline')} title="Underline"><u>U</u></button>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <button style={btnStyle()} onClick={()=>exec('formatBlock','h1')} title="Heading 1">H1</button>
        <button style={btnStyle()} onClick={()=>exec('formatBlock','h2')} title="Heading 2">H2</button>
        <button style={btnStyle()} onClick={()=>exec('formatBlock','h3')} title="Heading 3">H3</button>
        <button style={btnStyle()} onClick={()=>exec('formatBlock','p')} title="Paragraph">¶</button>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <button style={btnStyle()} onClick={()=>exec('insertUnorderedList')} title="Bullet list">• List</button>
        <button style={btnStyle()} onClick={()=>exec('insertOrderedList')} title="Numbered list">1. List</button>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <button style={btnStyle()} onClick={()=>exec('justifyLeft')} title="Align left">⬅</button>
        <button style={btnStyle()} onClick={()=>exec('justifyCenter')} title="Center">≡</button>
        <button style={btnStyle()} onClick={()=>exec('justifyRight')} title="Align right">➡</button>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <select onChange={e=>exec('fontSize',e.target.value)} defaultValue="3"
          style={{...iStyle,width:'auto',padding:'3px 6px',fontSize:11}}>
          {[['1','8pt'],['2','10pt'],['3','12pt'],['4','14pt'],['5','18pt'],['6','24pt'],['7','36pt']].map(([v,l])=>(
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 3px'}}/>
        <button style={btnStyle()} onClick={()=>exec('removeFormat')} title="Clear formatting">✕ Format</button>
      </div>
      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={()=>onChange(editorRef.current?.innerHTML||'')}
        style={{flex:1,padding:'20px',fontSize:13,lineHeight:1.8,color:'var(--espresso)',outline:'none',overflowY:'auto',minHeight:400,fontFamily:"'DM Sans',sans-serif"}}
        data-placeholder="Start writing your contract here, or add clauses from the library on the left…"
      />
    </div>
  )
}

// Contract preview / print view
function ContractPreview({ contract, staffMember, employeeSig, mgmtSig }) {
  const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
  return (
    <div id="contract-print" style={{background:'white',padding:'48px 56px',fontFamily:"'DM Sans',sans-serif",fontSize:13,lineHeight:1.9,color:'#1a1208',minHeight:'100%'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32,paddingBottom:20,borderBottom:'2px solid #EF4576'}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:900,color:'#EF4576',marginBottom:4}}>OHT Cafe</div>
          <div style={{fontSize:11,color:'#7a6a50',lineHeight:1.6}}>
            Unit A 156 A. Aguirre Ave.<br/>
            Barangay BF Homes, Parañaque City
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{background:'#EF4576',borderRadius:10,padding:'10px 16px',display:'inline-block'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:900,color:'white',letterSpacing:1}}>OH HEY THERE</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,.8)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>MATCHA CAFE</div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,marginBottom:6}}>{contract.title}</div>
        <div style={{fontSize:12,color:'#7a6a50'}}>{today}</div>
      </div>

      {/* Employee address */}
      {staffMember && (
        <div style={{marginBottom:24}}>
          <div style={{fontWeight:700}}>{staffMember.first_name} {staffMember.last_name}</div>
          <div style={{fontSize:12,color:'#7a6a50'}}>{staffMember.role}</div>
        </div>
      )}

      <div style={{marginBottom:20,fontSize:13}}>
        Dear {staffMember ? `${staffMember.first_name}` : 'Employee'},
      </div>
      <div style={{marginBottom:24,fontSize:13}}>
        We are pleased to inform you of your <strong>{contract.employment_type||'full-time'}</strong> engagement with OHT Cafe on the terms set out below:
      </div>

      {/* Contract content */}
      <div dangerouslySetInnerHTML={{__html: contract.content_html}}
        style={{marginBottom:32,'--tw-prose-body':'#1a1208'}}/>

      {/* Signature block */}
      <div style={{marginTop:48,paddingTop:24,borderTop:'1px solid #d8cebb'}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:16}}>IN WITNESS WHEREOF</div>
        <p style={{fontSize:12,color:'#7a6a50',marginBottom:32,lineHeight:1.7}}>
          If you acknowledge that you have read and fully understood this CONTRACT and willingly consent to its terms, please sign below.
        </p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48}}>
          {/* Employee signature */}
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:12}}>Employee</div>
            {employeeSig ? (
              <div style={{marginBottom:8,minHeight:60,display:'flex',alignItems:'flex-end'}}>
                {employeeSig.signature_type==='draw' ? (
                  <img src={employeeSig.signature_data} alt="Signature" style={{maxHeight:60,maxWidth:200}}/>
                ) : (
                  <span style={{fontFamily:'cursive',fontSize:28,color:'#1a1208'}}>{employeeSig.signature_data}</span>
                )}
              </div>
            ) : (
              <div style={{minHeight:60,borderBottom:'1px solid #1a1208',marginBottom:8}}/>
            )}
            <div style={{fontSize:11,fontWeight:600,borderTop:'1px solid #1a1208',paddingTop:6,marginBottom:3}}>
              {staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Employee Name'}
            </div>
            <div style={{fontSize:10,color:'#7a6a50'}}>Signature Over Printed Name</div>
            {employeeSig && <div style={{fontSize:9,color:'#7a6a50',marginTop:4,fontFamily:'monospace'}}>{fmtDT(employeeSig.signed_at)}</div>}
          </div>
          {/* Management signature */}
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:12}}>Noted By</div>
            {mgmtSig ? (
              <div style={{marginBottom:8,minHeight:60,display:'flex',alignItems:'flex-end'}}>
                {mgmtSig.signature_type==='draw' ? (
                  <img src={mgmtSig.signature_data} alt="Signature" style={{maxHeight:60,maxWidth:200}}/>
                ) : (
                  <span style={{fontFamily:'cursive',fontSize:28,color:'#1a1208'}}>{mgmtSig.signature_data}</span>
                )}
              </div>
            ) : (
              <div style={{minHeight:60,borderBottom:'1px solid #1a1208',marginBottom:8}}/>
            )}
            <div style={{fontSize:11,fontWeight:600,borderTop:'1px solid #1a1208',paddingTop:6,marginBottom:3}}>
              {mgmtSig ? (mgmtSig.audit_trail?.[0]?.signer==='alex' ? 'Agnes Alexsandria S. Lalog' : 'CJ') : 'Agnes Alexsandria S. Lalog'}
            </div>
            <div style={{fontSize:10,color:'#7a6a50'}}>Managing Director & Co-founder</div>
            {mgmtSig && <div style={{fontSize:9,color:'#7a6a50',marginTop:4,fontFamily:'monospace'}}>{fmtDT(mgmtSig.signed_at)}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

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

  // Builder
  const [editorHtml, setEditorHtml]   = useState('')
  const [builderForm, setBuilderForm] = useState({title:'',staff_id:'',employment_type:'Full-time',salary:'',start_date:'',expires_at:''})
  const [catFilter, setCatFilter]     = useState('All')
  const [clauseSearch, setClauseSearch] = useState('')
  const [previewMode, setPreviewMode] = useState(false)

  // Clause manager
  const [showClauseMgr, setShowClauseMgr] = useState(false)
  const [clauseForm, setClauseForm] = useState({title:'',content:'',category:'General',applicable_roles:[]})
  const [editingClause, setEditingClause] = useState(null)

  // Countersign
  const [showCountersign, setShowCountersign] = useState(false)
  const [mgmtSigner, setMgmtSigner]   = useState('alex')
  const [mgmtSignMode, setMgmtSignMode] = useState('type')
  const [mgmtTypedSig, setMgmtTypedSig] = useState('')
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
    setContracts(c||[]); setClauses(cl||[]); setStaff(s||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),4000)}
  const bfv = k => e => setBuilderForm(p=>({...p,[k]:e.target.value}))

  // Auto-fill when staff selected
  function handleStaffChange(staffId) {
    const s = staff.find(x=>x.id===staffId)
    if (s) {
      setBuilderForm(p=>({
        ...p, staff_id:staffId,
        salary: ROLE_SALARY[s.role] || '',
        title: `${p.employment_type} Contract — ${s.first_name} ${s.last_name}`,
      }))
    } else {
      setBuilderForm(p=>({...p, staff_id:staffId}))
    }
  }

  // Insert clause into editor
  function insertClause(clause) {
    const vars = getVars()
    let html = clause.content
    Object.entries(vars).forEach(([k,v]) => { html = html.replaceAll(k, `<strong>${v}</strong>`) })
    setEditorHtml(prev => prev + html + '<p></p>')
    // Trigger re-render of editor
    const editor = document.getElementById('rich-editor')
    if (editor) { editor.innerHTML = editorHtml + html + '<p></p>' }
  }

  function getVars() {
    const s = staff.find(x=>x.id===builderForm.staff_id)
    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    return {
      '{{employee_name}}': s ? `${s.first_name} ${s.last_name}` : '',
      '{{position}}': s?.role || '',
      '{{salary}}': builderForm.salary || '',
      '{{start_date}}': builderForm.start_date ? new Date(builderForm.start_date+'T00:00:00').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '',
      '{{date_today}}': today,
      '{{employment_type}}': builderForm.employment_type,
      '{{company_name}}': 'OHT Cafe',
    }
  }

  async function saveContract(sendNow=false) {
    if (!builderForm.title) { showToast('⚠️','Contract title required'); return }
    if (!editorHtml || editorHtml === '<p></p>' || editorHtml.trim() === '') { showToast('⚠️','Contract content is empty'); return }
    if (sendNow && !builderForm.staff_id) { showToast('⚠️','Select an employee to send'); return }
    setSaving(true)
    const payload = {
      title: builderForm.title,
      content_html: editorHtml,
      staff_id: builderForm.staff_id || null,
      status: sendNow ? 'pending_signature' : 'draft',
      employment_type: builderForm.employment_type,
      salary: builderForm.salary,
      start_date: builderForm.start_date || null,
      expires_at: builderForm.expires_at || null,
      created_by: 'alex',
      sent_at: sendNow ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('contracts').insert([payload]).select().single()
    if (error) { showToast('❌',error.message); setSaving(false); return }
    if (sendNow && builderForm.staff_id) {
      await notifyOne(builderForm.staff_id, {
        type:'general',
        title:'📄 New Contract Awaiting Your Signature',
        message:`"${builderForm.title}" has been sent to you. Please review and sign it in your portal.`,
      })
    }
    await fetchAll()
    setView('list')
    setEditorHtml('')
    setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',salary:'',start_date:'',expires_at:''})
    showToast(sendNow?'📤':'💾', sendNow?'Contract sent for signature!':'Draft saved!')
    setSaving(false)
  }

  async function openDetail(c) {
    setSelected(c)
    const { data: sigs } = await supabase.from('contract_signatures').select('*').eq('contract_id',c.id).order('signed_at')
    setSelectedSigs(sigs||[])
    setView('detail')
  }

  async function sendForSignature(c) {
    await supabase.from('contracts').update({status:'pending_signature',sent_at:new Date().toISOString()}).eq('id',c.id)
    if (c.staff_id) {
      await notifyOne(c.staff_id, {type:'general',title:'📄 Contract Awaiting Your Signature',message:`"${c.title}" has been sent to you for signature.`})
    }
    await fetchAll()
    setSelected(prev=>({...prev,status:'pending_signature'}))
    showToast('📤','Sent for signature!')
  }

  async function deleteContract(id) {
    if (!confirm('Delete this contract?')) return
    await supabase.from('contracts').delete().eq('id',id)
    await fetchAll(); setView('list'); setSelected(null)
    showToast('🗑️','Deleted')
  }

  // Clause manager
  async function saveClause() {
    if (!clauseForm.title||!clauseForm.content) { showToast('⚠️','Title and content required'); return }
    if (editingClause) {
      await supabase.from('contract_clauses').update(clauseForm).eq('id',editingClause.id)
    } else {
      const maxOrder = Math.max(0,...clauses.map(c=>c.sort_order))
      await supabase.from('contract_clauses').insert([{...clauseForm,sort_order:maxOrder+1}])
    }
    await fetchAll()
    setClauseForm({title:'',content:'',category:'General',applicable_roles:[]})
    setEditingClause(null)
    showToast('✅', editingClause?'Clause updated':'Clause created')
  }

  async function deleteClause(id) {
    if (!confirm('Delete this clause?')) return
    await supabase.from('contract_clauses').update({is_active:false}).eq('id',id)
    await fetchAll()
    showToast('🗑️','Clause removed')
  }

  // Countersign canvas
  function startDraw(e) {
    isDrawing.current=true
    const canvas=mgmtCanvasRef.current, ctx=canvas.getContext('2d')
    const rect=canvas.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo((e.clientX-rect.left)*(canvas.width/rect.width),(e.clientY-rect.top)*(canvas.height/rect.height))
  }
  function draw(e) {
    if(!isDrawing.current) return; e.preventDefault()
    const canvas=mgmtCanvasRef.current, ctx=canvas.getContext('2d')
    const rect=canvas.getBoundingClientRect()
    ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.strokeStyle='#1a1208'
    ctx.lineTo((e.clientX-rect.left)*(canvas.width/rect.width),(e.clientY-rect.top)*(canvas.height/rect.height)); ctx.stroke()
  }
  function endDraw() { isDrawing.current=false }

  async function submitCountersign() {
    if (!selected) return
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
      contract_id:selected.id, staff_id:null,
      signatory_type:'management', signature_type:mgmtSignMode,
      signature_data:sigData, signed_at:now,
      user_agent:navigator.userAgent,
      audit_trail:[{event:'management_countersigned',timestamp:now,signer:mgmtSigner}],
    }])
    await supabase.from('contracts').update({
      management_signed_at:now, management_signed_by:mgmtSigner,
      management_signature:sigData, management_signature_type:mgmtSignMode,
      status:'signed', updated_at:now,
    }).eq('id',selected.id)

    // Save PDF to staff 201
    if (selected.staff_id) {
      await notifyOne(selected.staff_id, {
        type:'general',
        title:'✅ Contract Fully Executed',
        message:`"${selected.title}" has been countersigned by ${mgmtSigner==='alex'?'Alex':'CJ'}. Your contract is now fully executed and saved to your Files.`,
      })
      // Save reference to staff_files
      await supabase.from('staff_files').insert([{
        staff_id:selected.staff_id,
        file_name:`${selected.title}.pdf`,
        file_url:'#contract-'+selected.id,
        file_type:'application/pdf',
        category:'Contract',
        description:`Signed contract — executed on ${fmtDate(now)}`,
        uploaded_by:'system',
        can_download:true,
        storage_path:'contract:'+selected.id,
      }])
    }

    await fetchAll()
    const { data:sigs } = await supabase.from('contract_signatures').select('*').eq('contract_id',selected.id).order('signed_at')
    setSelectedSigs(sigs||[])
    setSelected(prev=>({...prev,status:'signed',management_signed_at:now,management_signed_by:mgmtSigner}))
    setShowCountersign(false); setMgmtTypedSig(''); setSaving(false)
    showToast('✅','Contract fully executed & saved to employee 201!')
  }

  async function downloadContract() {
    if (!selected) return
    // Use browser print to PDF
    const printWindow = window.open('','_blank')
    const staffMember = staff.find(s=>s.id===selected.staff_id)
    const empSig = selectedSigs.find(s=>s.signatory_type==='employee')
    const mgmtSig = selectedSigs.find(s=>s.signatory_type==='management')

    const empSigHtml = empSig
      ? empSig.signature_type==='draw'
        ? `<img src="${empSig.signature_data}" style="max-height:60px;max-width:200px;"/>`
        : `<span style="font-family:cursive;font-size:28px;">${empSig.signature_data}</span>`
      : '<div style="border-bottom:1px solid #1a1208;min-height:60px;"></div>'

    const mgmtSigHtml = mgmtSig
      ? mgmtSig.signature_type==='draw'
        ? `<img src="${mgmtSig.signature_data}" style="max-height:60px;max-width:200px;"/>`
        : `<span style="font-family:cursive;font-size:28px;">${mgmtSig.signature_data}</span>`
      : '<div style="border-bottom:1px solid #1a1208;min-height:60px;"></div>'

    const today = new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>${selected.title}</title>
      <style>
        body{font-family:'Helvetica Neue',sans-serif;font-size:13px;line-height:1.9;color:#1a1208;margin:0;padding:48px 56px;}
        h1,h2,h3{font-family:Helvetica,sans-serif;} ul{margin:6px 0;} li{margin:3px 0;}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #EF4576;}
        .brand{font-size:20px;font-weight:900;color:#EF4576;margin-bottom:4px;}
        .logo-box{background:#EF4576;border-radius:10px;padding:10px 16px;text-align:right;}
        .logo-title{font-size:13px;font-weight:900;color:white;letter-spacing:1px;}
        .logo-sub{font-size:9px;color:rgba(255,255,255,.8);letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
        .contract-title{text-align:center;font-size:18px;font-weight:700;margin-bottom:6px;}
        .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;padding-top:24px;border-top:1px solid #d8cebb;}
        .sig-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a6a50;margin-bottom:12px;}
        .sig-name{font-size:11px;font-weight:600;border-top:1px solid #1a1208;padding-top:6px;margin-top:8px;}
        .sig-role{font-size:10px;color:#7a6a50;}
        .sig-ts{font-size:9px;color:#7a6a50;margin-top:4px;font-family:monospace;}
        @media print{body{padding:32px 40px;}}
      </style>
      </head><body>
      <div class="header">
        <div>
          <div class="brand">OHT Cafe</div>
          <div style="font-size:11px;color:#7a6a50;line-height:1.6;">Unit A 156 A. Aguirre Ave.<br/>Barangay BF Homes, Parañaque City</div>
        </div>
        <div class="logo-box">
          <div class="logo-title">OH HEY THERE</div>
          <div class="logo-sub">MATCHA CAFE</div>
        </div>
      </div>
      <div class="contract-title">${selected.title}</div>
      <div style="text-align:center;font-size:12px;color:#7a6a50;margin-bottom:28px;">${today}</div>
      ${staffMember?`<div style="margin-bottom:20px;"><strong>${staffMember.first_name} ${staffMember.last_name}</strong><br/><span style="color:#7a6a50;font-size:12px;">${staffMember.role}</span></div>`:''}
      <p>Dear ${staffMember?staffMember.first_name:'Employee'},</p>
      <p>We are pleased to inform you of your <strong>${selected.employment_type||'full-time'}</strong> engagement with OHT Cafe on the terms set out below:</p>
      ${selected.content_html}
      <div class="sig-grid">
        <div>
          <div class="sig-label">Employee</div>
          ${empSigHtml}
          <div class="sig-name">${staffMember?`${staffMember.first_name} ${staffMember.last_name}`:'Employee Name'}</div>
          <div class="sig-role">Signature Over Printed Name</div>
          ${empSig?`<div class="sig-ts">${fmtDT(empSig.signed_at)}</div>`:''}
        </div>
        <div>
          <div class="sig-label">Noted By</div>
          ${mgmtSigHtml}
          <div class="sig-name">${mgmtSig?(mgmtSig.audit_trail?.[0]?.signer==='alex'?'Agnes Alexsandria S. Lalog':'CJ'):'Agnes Alexsandria S. Lalog'}</div>
          <div class="sig-role">Managing Director & Co-founder</div>
          ${mgmtSig?`<div class="sig-ts">${fmtDT(mgmtSig.signed_at)}</div>`:''}
        </div>
      </div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>
    `)
    printWindow.document.close()
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
            <button onClick={()=>setShowClauseMgr(true)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:600,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>📚 Manage Clauses</button>
            <button className="btn btn-primary" onClick={()=>setView('builder')}>+ New Contract</button>
          </>}
          {view==='builder'&&<>
            <button onClick={()=>{setView('list');setEditorHtml('');setBuilderForm({title:'',staff_id:'',employment_type:'Full-time',salary:'',start_date:'',expires_at:''})}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Cancel</button>
            <button onClick={()=>setPreviewMode(!previewMode)} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{previewMode?'← Edit':'👁 Preview'}</button>
            <button onClick={()=>saveContract(false)} disabled={saving} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>💾 Save Draft</button>
            <button onClick={()=>saveContract(true)} disabled={saving||!builderForm.staff_id} style={{background:builderForm.staff_id?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:builderForm.staff_id?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>📤 Send for Signature</button>
          </>}
          {view==='detail'&&<>
            <button onClick={()=>{setView('list');setSelected(null);setSelectedSigs([])}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'7px 13px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>← Back</button>
            <button onClick={downloadContract} style={{background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>↓ Download PDF</button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* ── LIST ── */}
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
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:7,background:st.bg,color:st.color}}>{st.label}</span>
                        </td>
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

        {/* ── BUILDER ── */}
        {view==='builder'&&(
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr 240px',gap:14,height:'calc(100vh - 130px)'}}>
            {/* LEFT: Clause Library */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:8}}>📚 Clause Library</div>
                <input value={clauseSearch} onChange={e=>setClauseSearch(e.target.value)} placeholder="Search…" style={{...iStyle,padding:'6px 9px',fontSize:11,marginBottom:7}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {categories.map(cat=>(
                    <button key={cat} onClick={()=>setCatFilter(cat)}
                      style={{padding:'2px 7px',borderRadius:20,border:`1px solid ${catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--border)'}`,background:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)')+'22':'transparent',color:catFilter===cat?(CAT_COLORS[cat]||'var(--espresso)'):'var(--text-muted)',fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                {filteredClauses.map(clause=>{
                  const color=CAT_COLORS[clause.category]||'#7a6a50'
                  return(
                    <div key={clause.id}
                      onClick={()=>insertClause(clause)}
                      style={{padding:'9px 11px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',marginBottom:6,cursor:'pointer',transition:'all .15s',borderLeft:`3px solid ${color}`}}
                      onMouseEnter={e=>{e.currentTarget.style.background=color+'15';e.currentTarget.style.borderColor=color}}
                      onMouseLeave={e=>{e.currentTarget.style.background='var(--surface)';e.currentTarget.style.borderLeftColor=color;e.currentTarget.style.borderTopColor='var(--border)';e.currentTarget.style.borderRightColor='var(--border)';e.currentTarget.style.borderBottomColor='var(--border)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--espresso)',marginBottom:3}}>{clause.title}</div>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:color+'22',color}}>{clause.category}</span>
                        <span style={{fontSize:9,color:'var(--text-muted)'}}>Click to insert</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* MIDDLE: Rich text editor */}
            {!previewMode?(
              <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <RichEditor
                  value={editorHtml}
                  onChange={setEditorHtml}
                />
              </div>
            ):(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto',padding:'0'}}>
                <ContractPreview
                  contract={{...builderForm,content_html:editorHtml}}
                  staffMember={staff.find(s=>s.id===builderForm.staff_id)}
                  employeeSig={null} mgmtSig={null}
                />
              </div>
            )}

            {/* RIGHT: Settings */}
            <div style={{display:'flex',flexDirection:'column',gap:10,overflowY:'auto'}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:12}}>⚙️ Settings</div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Title *</label>
                  <input style={iStyle} value={builderForm.title} onChange={bfv('title')} placeholder="Contract title…"/>
                </div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Employment Type</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                    {['Full-time','Part-time','Freelancer','Consignee'].map(t=>(
                      <div key={t} onClick={()=>setBuilderForm(p=>({...p,employment_type:t}))}
                        style={{padding:'6px 5px',borderRadius:6,border:`1.5px solid ${builderForm.employment_type===t?'var(--matcha)':'var(--border)'}`,background:builderForm.employment_type===t?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:9,fontWeight:600,color:builderForm.employment_type===t?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Assign Employee</label>
                  <select style={iStyle} value={builderForm.staff_id} onChange={e=>handleStaffChange(e.target.value)}>
                    <option value="">Select…</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Salary / Rate</label>
                  <input style={iStyle} value={builderForm.salary} onChange={bfv('salary')} placeholder="e.g. PHP 17,000"/>
                </div>
                <div style={{marginBottom:9}}>
                  <label style={lStyle}>Start Date</label>
                  <input style={iStyle} type="date" value={builderForm.start_date} onChange={bfv('start_date')}/>
                </div>
                <div>
                  <label style={lStyle}>Expiry Date</label>
                  <input style={iStyle} type="date" value={builderForm.expires_at} onChange={bfv('expires_at')}/>
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

        {/* ── DETAIL ── */}
        {view==='detail'&&selected&&(()=>{
          const st=STATUS[selected.status]||STATUS.draft
          const s=selected.staff
          const empSig=selectedSigs.find(x=>x.signatory_type==='employee')
          const mgmtSig=selectedSigs.find(x=>x.signatory_type==='management')
          return(
            <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16,height:'calc(100vh-130px)'}}>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto'}}>
                <ContractPreview contract={selected} staffMember={s} employeeSig={empSig} mgmtSig={mgmtSig}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
                {/* Status */}
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'14px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>Status</div>
                  <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                  {selected.salary&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>💰 {selected.salary} · {selected.employment_type}</div>}
                  {selected.start_date&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>📅 Starts {fmtDate(selected.start_date)}</div>}
                </div>
                {/* Signatures */}
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
                {/* Actions */}
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
                {/* Employee info */}
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

      {/* ── CLAUSE MANAGER MODAL ── */}
      {showClauseMgr&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowClauseMgr(false)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:0,width:'100%',maxWidth:800,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,.3)',overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>📚 Manage Clauses</div>
              <button onClick={()=>setShowClauseMgr(false)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer',color:'var(--text-muted)'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',flex:1,overflow:'hidden'}}>
              {/* Existing clauses */}
              <div style={{borderRight:'1px solid var(--border)',overflowY:'auto',padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>Existing Clauses</div>
                {clauses.map(c=>{
                  const color=CAT_COLORS[c.category]||'#7a6a50'
                  return(
                    <div key={c.id} style={{padding:'10px 12px',borderRadius:9,border:'1px solid var(--border)',marginBottom:7,borderLeft:`3px solid ${color}`}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:600}}>{c.title}</span>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>{setEditingClause(c);setClauseForm({title:c.title,content:c.content,category:c.category,applicable_roles:c.applicable_roles||[]})}}
                            style={{background:'transparent',border:'none',fontSize:12,cursor:'pointer',color:'var(--sky)'}}>✏️</button>
                          <button onClick={()=>deleteClause(c.id)}
                            style={{background:'transparent',border:'none',fontSize:12,cursor:'pointer',color:'var(--text-muted)'}}
                            onMouseEnter={e=>e.currentTarget.style.color='#c0392b'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>🗑</button>
                        </div>
                      </div>
                      <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:color+'22',color}}>{c.category}</span>
                    </div>
                  )
                })}
              </div>
              {/* Edit/Create form */}
              <div style={{overflowY:'auto',padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10}}>{editingClause?'Edit Clause':'+ New Clause'}</div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Title *</label>
                  <input style={iStyle} value={clauseForm.title} onChange={e=>setClauseForm(p=>({...p,title:e.target.value}))} placeholder="Clause title…"/>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lStyle}>Category</label>
                  <select style={iStyle} value={clauseForm.category} onChange={e=>setClauseForm(p=>({...p,category:e.target.value}))}>
                    {['Role','Duties','Terms','Compensation','Legal','General'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={lStyle}>Content (HTML allowed)</label>
                  <textarea value={clauseForm.content} onChange={e=>setClauseForm(p=>({...p,content:e.target.value}))}
                    placeholder="Clause content… You can use <strong>, <ul>, <li>, <p> tags or plain text."
                    style={{...iStyle,resize:'vertical',minHeight:180,lineHeight:1.6,fontSize:12}}/>
                </div>
                <div style={{display:'flex',gap:8}}>
                  {editingClause&&<button onClick={()=>{setEditingClause(null);setClauseForm({title:'',content:'',category:'General',applicable_roles:[]})}} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Cancel</button>}
                  <button onClick={saveClause} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'9px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    {editingClause?'✓ Update Clause':'✓ Save Clause'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COUNTERSIGN MODAL ── */}
      {showCountersign&&selected&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowCountersign(false)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4}}>✍️ Countersign Contract</div>
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
