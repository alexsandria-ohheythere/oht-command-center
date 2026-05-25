'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import {
  EMPLOYMENT_TYPES, RATES, getBaseRate, getDailyRate,
  calcSSS, calcPhilHealth, calcPagIBIG, calcWithholdingTax,
  isServiceChargeEligible, LEAVE_ENTITLEMENT, computeCutoffPayroll, getDailyRate as getStaffDailyRate
} from '../../lib/payroll'

const ROLES = [
  'Cafe Supervisor','Cafe Operations Support','Senior Barista',
  'Junior Barista - Milk Station','Junior Barista - Cashier',
  'Executive Chef','Sous Chef','Kitchen Staff',
]

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}

const EMPTY = {
  first_name:'',last_name:'',middle_name:'',nickname:'',
  birthday:'',age:'',birthplace:'',email:'',mobile:'',
  sss:'',philhealth:'',pagibig:'',tin:'',
  house_no:'',street:'',village:'',barangay:'',city:'',zipcode:'',
  father_last:'',father_first:'',father_middle:'',
  mother_maiden:'',mother_first:'',mother_middle:'',
  emergency_name:'',emergency_contact:'',emergency_relationship:'',
  role:ROLES[2], employment_type:'Full-time',
  gdrive:'',hours_assigned:0,hours_consumed:0,monthly_pay:0,status:'active',
  late_minutes:0,absent_days:0,vacation_leave_used:0,sick_leave_used:0,
  service_charge_eligible:true,violation_count:0,late_count_this_month:0,
}

const getRoleColor = r => ROLE_COLORS[r]||'#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const peso = n => '₱'+(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})

const iStyle = {
  width:'100%',background:'var(--surface)',border:'1px solid var(--border)',
  borderRadius:8,padding:'9px 12px',fontSize:12,
  fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'
}
const lStyle = {
  display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,
  textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5
}
const sHead = (mt=18) => ({
  fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,
  color:'var(--espresso)',marginBottom:10,marginTop:mt,
  paddingBottom:6,borderBottom:'1px solid var(--border)',
  textTransform:'uppercase',letterSpacing:1
})

export default function StaffPage() {
  const supabase = createClient()
  const [staff,setStaff]             = useState([])
  const [loading,setLoading]         = useState(true)
  const [saving,setSaving]           = useState(false)
  const [view,setView]               = useState('grid')
  const [selected,setSelected]       = useState(null)
  const [profileTab,setProfileTab]   = useState('info') // info | payroll
  const [form,setForm]               = useState(EMPTY)
  const [formMode,setFormMode]       = useState('add')
  const [search,setSearch]           = useState('')
  const [roleFilter,setRoleFilter]   = useState('')
  const [typeFilter,setTypeFilter]   = useState('')
  const [csvPreview,setCsvPreview]   = useState([])
  const [toast,setToast]             = useState(null)
  const fileRef = useRef()

  useEffect(()=>{ fetchStaff() },[])

  async function fetchStaff() {
    setLoading(true)
    const { data,error } = await supabase.from('staff').select('*').order('last_name',{ascending:true})
    if (!error) setStaff(data||[])
    setLoading(false)
  }

  function showToast(icon,msg){ setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }

  // ── AUTO-RATE ──
  function getAutoRate(employment_type, role) {
    const rate = getBaseRate(employment_type, role)
    if (!rate) return { monthly_pay:0 }
    if (rate.monthly) return { monthly_pay: rate.monthly }
    if (rate.daily)   return { monthly_pay: rate.daily * 26 }
    return { monthly_pay:0 }
  }

  // ── CSV ──
  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(l=>l.trim())
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s/g,''))
      const rows = lines.slice(1).map((line,i) => {
        const vals = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        const obj = {}; headers.forEach((h,idx)=>{ obj[h]=vals[idx]||'' })
        const emp_type = obj.employmenttype || obj.employment_type || 'Full-time'
        const role     = obj.role || ROLES[2]
        const autoRate = getAutoRate(emp_type, role)
        return {
          first_name:obj.firstname||'', last_name:obj.lastname||'',
          middle_name:obj.middlename||'', nickname:obj.nickname||'',
          birthday:obj.birthday||null, age:parseInt(obj.age)||null,
          birthplace:obj.birthplace||'', email:obj.email||'', mobile:obj.mobile||'',
          sss:obj.sss||'', philhealth:obj.philhealth||'', pagibig:obj.pagibig||'', tin:obj.tin||'',
          house_no:obj.houseno||'', street:obj.street||'', village:obj.village||'',
          barangay:obj.barangay||'', city:obj.city||'', zipcode:obj.zipcode||'',
          role, employment_type:emp_type,
          gdrive:obj.gdrive||'', status:'active',
          monthly_pay: parseInt(obj.monthlypay)||autoRate.monthly_pay||0,
          hours_assigned:0, hours_consumed:0,
          late_minutes:0, absent_days:0, vacation_leave_used:0, sick_leave_used:0,
          service_charge_eligible:true, violation_count:0, late_count_this_month:0,
        }
      }).filter(r=>r.first_name&&r.last_name)
      setCsvPreview(rows); setView('csv')
    }
    reader.readAsText(file); e.target.value=''
  }

  async function confirmCSV() {
    setSaving(true)
    const { error } = await supabase.from('staff').insert(csvPreview)
    if (error){ showToast('❌','Import failed: '+error.message); setSaving(false); return }
    await fetchStaff(); setCsvPreview([]); setView('grid')
    showToast('✅',`${csvPreview.length} staff imported`); setSaving(false)
  }

  // ── FORM ──
  function openAdd(){ setForm({...EMPTY}); setFormMode('add'); setView('form') }
  function openEdit(s){ setForm({...s,birthday:s.birthday||'',age:s.age||''}); setFormMode('edit'); setView('form') }
  const fv = k => e => {
    const val = e.target.value
    setForm(prev => {
      const next = {...prev,[k]:val}
      // Auto-fill rate when role or type changes
      if (k==='role'||k==='employment_type') {
        const autoRate = getAutoRate(k==='employment_type'?val:prev.employment_type, k==='role'?val:prev.role)
        if (autoRate.monthly_pay) next.monthly_pay = autoRate.monthly_pay
      }
      return next
    })
  }

  async function submitForm() {
    if (!form.first_name?.trim()){ showToast('⚠️','First name required'); return }
    if (!form.last_name?.trim()) { showToast('⚠️','Last name required');  return }
    setSaving(true)
    const payload = {...form}
    if (!payload.birthday) payload.birthday = null
    if (!payload.age) payload.age = null
    delete payload.id; delete payload.created_at

    if (formMode==='add') {
      const { error } = await supabase.from('staff').insert([payload])
      if (error){ showToast('❌',error.message); setSaving(false); return }
      showToast('✅',`${form.first_name} ${form.last_name} added`)
    } else {
      const { error } = await supabase.from('staff').update(payload).eq('id',form.id)
      if (error){ showToast('❌',error.message); setSaving(false); return }
      showToast('✅',`${form.first_name} ${form.last_name} updated`)
    }
    await fetchStaff(); setView('grid'); setSaving(false)
  }

  async function deleteStaff(id) {
    if (!confirm('Remove this staff member?')) return
    const { error } = await supabase.from('staff').delete().eq('id',id)
    if (error){ showToast('❌',error.message); return }
    await fetchStaff(); setView('grid'); showToast('🗑️','Staff member removed')
  }

  function downloadTemplate() {
    const headers = 'firstName,lastName,middleName,nickname,birthday,age,birthplace,email,mobile,sss,philhealth,pagibig,tin,houseNo,street,village,barangay,city,zipcode,role,employmentType,gdrive,monthlyPay'
    const sample  = 'Juan,Dela Cruz,Santos,Juanito,1998-05-15,27,Manila,juan@email.com,09171234567,34-5678901-2,12-345678901-2,1234-5678-9012,123-456-789-000,123,Rizal St,Green Village,Poblacion,Makati,1200,Senior Barista,Full-time,,17000'
    const blob = new Blob([headers+'\n'+sample],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='oht-staff-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const name = `${s.first_name} ${s.last_name} ${s.nickname||''}`.toLowerCase()
    if (q && !name.includes(q)) return false
    if (roleFilter && s.role!==roleFilter) return false
    if (typeFilter && s.employment_type!==typeFilter) return false
    return true
  })

  // ── PAYROLL PREVIEW for profile ──
  function getPayrollPreview(s) {
    // Build dummy shifts from stored late_minutes and absent_days for profile preview
    const type = s.employment_type || 'Full-time'
    const role = s.role || ''
    const daily = getStaffDailyRate(type, role)
    const hourly = daily / 8
    const minuteRate = hourly / 60
    const daysWorked = Math.max(0, 26 - (s.absent_days || 0))
    const paidHours = daysWorked * 8
    const lateMinutes = s.late_minutes || 0
    const lateCount = s.late_count_this_month || 0

    // Simulate shifts array for computeCutoffPayroll
    const fakeShifts = Array.from({ length: daysWorked }, (_, i) => ({
      paidHours: 8,
      lateMinutes: i === 0 ? lateMinutes : 0, // put all late mins on first shift
      rawHours: 9,
    }))

    return computeCutoffPayroll(s, fakeShifts)
  }

  const typeColors = {'Full-time':'#4a7a1e','Part-time':'#2d5a8a','Freelancer':'#8e44ad'}
  const typeBg    = {'Full-time':'#eef7e4','Part-time':'#e8f0fb','Freelancer':'#f5eeff'}

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Staff Directory</div>
          <div className="topbar-sub">{loading?'Loading…':`${staff.length} team members · Oh Hey There`}</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {view!=='grid' && <button className="btn btn-secondary" onClick={()=>setView('grid')}>← Back</button>}
          {view==='grid' && <>
            <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
              📂 Import CSV
              <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV} />
            </label>
            <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* ── GRID ── */}
        {view==='grid' && <>
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{position:'relative',flex:1,minWidth:160}}>
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'var(--text-muted)'}}>🔍</span>
              <input style={{...iStyle,paddingLeft:30}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <select style={{...iStyle,width:'auto',minWidth:180}} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <select style={{...iStyle,width:'auto',minWidth:140}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {EMPLOYMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',background:'var(--white)',border:'1px solid var(--border)',padding:'7px 12px',borderRadius:8}}>
              {filtered.length} / {staff.length}
            </div>
          </div>

          <div style={{background:'var(--sky-pale)',border:'1px solid #4a90c444',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:12,fontSize:12}}>
            <span>💡</span>
            <span style={{color:'var(--sky)',fontWeight:600}}>Bulk import via CSV</span>
            <span style={{color:'var(--text-muted)'}}>Required: <code style={{background:'#e8f0fb',padding:'1px 5px',borderRadius:4}}>firstName, lastName, role, employmentType</code></span>
            <button onClick={downloadTemplate} style={{marginLeft:'auto',background:'var(--sky)',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>↓ Template</button>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-muted)'}}>Loading staff…</div>
          ) : filtered.length===0 ? (
            <div style={{textAlign:'center',padding:'60px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>👥</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No staff yet</div>
              <button className="btn btn-primary" onClick={openAdd}>+ Add First Staff Member</button>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:12}}>
              {filtered.map(s=>{
                const eligible = isServiceChargeEligible(s.late_count_this_month||0, s.violation_count||0)
                const dailyRate = getDailyRate(s.employment_type||'Full-time', s.role)
                return (
                  <div key={s.id} onClick={()=>{setSelected(s);setProfileTab('info');setView('profile')}}
                    style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:16,cursor:'pointer',transition:'all .2s',borderTop:`3px solid ${getRoleColor(s.role)}`}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)'}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:11,marginBottom:12}}>
                      <div style={{width:42,height:42,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>
                        {initials(s.first_name,s.last_name)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:'var(--espresso)'}}>
                          {s.first_name} {s.last_name}
                          {s.nickname&&<span style={{fontSize:10,color:'var(--text-muted)',fontWeight:400}}> · "{s.nickname}"</span>}
                        </div>
                        <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role),border:`1px solid ${getRoleColor(s.role)}44`}}>{s.role}</span>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:typeBg[s.employment_type||'Full-time'],color:typeColors[s.employment_type||'Full-time']}}>{s.employment_type||'Full-time'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
                      {[
                        ['DAILY RATE',  peso(dailyRate),           'var(--gold)'],
                        ['LATES',       (s.late_count_this_month||0)+' this mo.', s.late_count_this_month>3?'#c0392b':'var(--matcha-dark)'],
                        ['SVC CHARGE',  eligible?'✅ Eligible':'❌ No',           eligible?'var(--matcha-dark)':'#c0392b'],
                      ].map(([label,val,color])=>(
                        <div key={label} style={{background:'var(--surface)',borderRadius:8,padding:'7px 5px',textAlign:'center'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color}}>{val}</div>
                          <div style={{fontSize:8,color:'var(--text-muted)',letterSpacing:.8,fontWeight:700,marginTop:1}}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {s.gdrive&&(
                      <a href={s.gdrive} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#1a73e8',fontWeight:600,textDecoration:'none'}}>
                        📁 View Payslips
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>}

        {/* ── CSV PREVIEW ── */}
        {view==='csv'&&<>
          <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <span>✅</span>
            <span style={{fontSize:13,fontWeight:600,color:'var(--matcha-dark)'}}>{csvPreview.length} staff ready to import</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              <button className="btn btn-secondary" onClick={()=>{setCsvPreview([]);setView('grid')}}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmCSV} disabled={saving}>{saving?'Importing…':'Confirm Import'}</button>
            </div>
          </div>
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--espresso)'}}>
                {['Name','Type','Role','Email','Daily Rate','City'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {csvPreview.map((s,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                    <td style={{padding:'9px 14px',fontWeight:600}}>{s.first_name} {s.last_name}</td>
                    <td style={{padding:'9px 14px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:typeBg[s.employment_type],color:typeColors[s.employment_type]}}>{s.employment_type}</span></td>
                    <td style={{padding:'9px 14px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role)}}>{s.role}</span></td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.email||'—'}</td>
                    <td style={{padding:'9px 14px',fontFamily:"'DM Mono',monospace",color:'var(--gold)'}}>{peso(getDailyRate(s.employment_type,s.role))}</td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.city||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* ── PROFILE ── */}
        {view==='profile'&&selected&&(()=>{
          const s = staff.find(x=>x.id===selected.id)||selected
          const eligible = isServiceChargeEligible(s.late_count_this_month||0,s.violation_count||0)
          const pay = getPayrollPreview(s)
          const vl_remaining = LEAVE_ENTITLEMENT.vacation - (s.vacation_leave_used||0)
          const sl_remaining = LEAVE_ENTITLEMENT.sick - (s.sick_leave_used||0)
          const isFullTime = (s.employment_type||'Full-time')==='Full-time'

          return (<div>
            {/* Header */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 24px',marginBottom:14,display:'flex',alignItems:'flex-start',gap:16}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(s.first_name,s.last_name)}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:19,fontWeight:900,color:'var(--espresso)'}}>
                  {s.first_name} {s.middle_name?s.middle_name[0]+'. ':''}{s.last_name}
                  {s.nickname&&<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:400,fontStyle:'italic'}}> · "{s.nickname}"</span>}
                </div>
                <div style={{display:'flex',gap:6,marginTop:5,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:10,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role),border:`1px solid ${getRoleColor(s.role)}55`}}>{s.role}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:10,background:typeBg[s.employment_type||'Full-time'],color:typeColors[s.employment_type||'Full-time']}}>{s.employment_type||'Full-time'}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:10,background:eligible?'#eef7e4':'#fdeaea',color:eligible?'var(--matcha-dark)':'#c0392b'}}>
                    {eligible?'✅ Service Charge Eligible':'❌ Not Eligible for Service Charge'}
                  </span>
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" onClick={()=>openEdit(s)}>✏️ Edit</button>
                <button className="btn btn-danger" onClick={()=>deleteStaff(s.id)}>🗑</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',gap:2,marginBottom:14,background:'var(--white)',border:'1px solid var(--border)',borderRadius:10,padding:4,width:'fit-content'}}>
              {[['info','👤 Profile'],['payroll','💸 Payroll']].map(([tab,label])=>(
                <button key={tab} onClick={()=>setProfileTab(tab)} style={{padding:'7px 16px',borderRadius:8,border:'none',background:profileTab===tab?'var(--espresso)':'transparent',color:profileTab===tab?'var(--cream)':'var(--text-muted)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                  {label}
                </button>
              ))}
            </div>

            {/* PROFILE TAB */}
            {profileTab==='info'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={sHead(0)}>Basic Details</div>
                  <PRow label="Birthday" value={s.birthday||'—'} />
                  <PRow label="Age" value={s.age||'—'} />
                  <PRow label="Birthplace" value={s.birthplace||'—'} />
                  <div style={sHead()}>Contact</div>
                  <PRow label="Email" value={s.email||'—'} />
                  <PRow label="Mobile" value={s.mobile||'—'} />
                  <div style={sHead()}>Government IDs</div>
                  <PRow label="SSS" value={s.sss||'—'} />
                  <PRow label="PhilHealth" value={s.philhealth||'—'} />
                  <PRow label="Pag-IBIG" value={s.pagibig||'—'} />
                  <PRow label="TIN" value={s.tin||'—'} />
                  <div style={sHead()}>Family Background</div>
                  <PRow label="Father" value={[s.father_first,s.father_middle,s.father_last].filter(Boolean).join(' ')||'—'} />
                  <PRow label="Mother" value={[s.mother_first,s.mother_middle,s.mother_maiden].filter(Boolean).join(' ')||'—'} />
                </div>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={sHead(0)}>Address</div>
                  <PRow label="House No." value={s.house_no||'—'} />
                  <PRow label="Street" value={s.street||'—'} />
                  <PRow label="Village" value={s.village||'—'} />
                  <PRow label="Barangay" value={s.barangay||'—'} />
                  <PRow label="City" value={s.city||'—'} />
                  <PRow label="Zip" value={s.zipcode||'—'} />
                  <div style={sHead()}>Emergency Contact</div>
                  <PRow label="Name" value={s.emergency_name||'—'} />
                  <PRow label="Number" value={s.emergency_contact||'—'} />
                  <PRow label="Relationship" value={s.emergency_relationship||'—'} />
                  <div style={sHead()}>Payslips</div>
                  {s.gdrive
                    ? <a href={s.gdrive} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,background:'#e8f4f8',border:'1px solid #1a73e855',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#1a73e8',fontWeight:600,textDecoration:'none'}}>📁 Open Google Drive Folder</a>
                    : <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No payslip folder linked yet.</div>
                  }
                </div>
              </div>
            )}

            {/* PAYROLL TAB */}
            {profileTab==='payroll'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                {/* Computation */}
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={sHead(0)}>Payroll Computation</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:12}}>Based on 26 working days · 8 paid hours/day · 1 hr unpaid break</div>

                  <PayRow label="Gross Pay"          value={peso(pay.gross)}          bold />
                  <div style={{height:8}}/>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',margin:'4px 0'}}>Deductions</div>
                  <PayRow label={`Late (${s.late_minutes||0} mins)`}  value={`-${peso(pay.late_deduction)}`}    red={pay.late_deduction>0} />
                  <PayRow label={`Absences (${s.absent_days||0} days)`} value={`-${peso(pay.absence_deduction)}`} red={pay.absence_deduction>0} />
                  {isFullTime&&<>
                    <PayRow label="SSS"        value={`-${peso(pay.sss)}`}        red />
                    <PayRow label="PhilHealth" value={`-${peso(pay.philhealth)}`} red />
                    <PayRow label="Pag-IBIG"   value={`-${peso(pay.pagibig)}`}    red />
                    <PayRow label="Withholding Tax" value={`-${peso(pay.tax)}`}   red={pay.tax>0} />
                  </>}
                  <div style={{borderTop:'2px solid var(--border)',marginTop:10,paddingTop:10}}>
                    <PayRow label="NET PAY" value={peso(pay.net_pay)} bold big />
                  </div>
                </div>

                {/* Attendance + Leaves */}
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                    <div style={sHead(0)}>Attendance This Month</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[
                        ['Late Count', s.late_count_this_month||0, s.late_count_this_month>3?'#c0392b':'var(--matcha-dark)'],
                        ['Late Minutes', s.late_minutes||0, 'var(--gold)'],
                        ['Absent Days', s.absent_days||0, s.absent_days>0?'#c0392b':'var(--matcha-dark)'],
                        ['Violations', s.violation_count||0, s.violation_count>0?'#c0392b':'var(--matcha-dark)'],
                      ].map(([label,val,color])=>(
                        <div key={label} style={{background:'var(--surface)',borderRadius:8,padding:'10px 12px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,color}}>{val}</div>
                          <div style={{fontSize:9,color:'var(--text-muted)',fontWeight:700,letterSpacing:.8,marginTop:2}}>{label.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:eligible?'#eef7e4':'#fdeaea',borderRadius:8,padding:'10px 12px',fontSize:12,fontWeight:600,color:eligible?'var(--matcha-dark)':'#c0392b',textAlign:'center'}}>
                      {eligible?'✅ Eligible for Service Charge this month':'❌ Not eligible — over 3 lates or has violation'}
                    </div>
                  </div>

                  {isFullTime&&(
                    <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                      <div style={sHead(0)}>Leave Credits</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {[
                          ['Vacation Leave', vl_remaining, LEAVE_ENTITLEMENT.vacation, s.vacation_leave_used||0],
                          ['Sick Leave', sl_remaining, LEAVE_ENTITLEMENT.sick, s.sick_leave_used||0],
                        ].map(([label,remaining,total,used])=>(
                          <div key={label} style={{background:'var(--surface)',borderRadius:8,padding:'12px'}}>
                            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:.8,textTransform:'uppercase',marginBottom:6}}>{label}</div>
                            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:remaining>0?'var(--matcha-dark)':'#c0392b'}}>{remaining}<span style={{fontSize:12,fontWeight:400,color:'var(--text-muted)'}}> / {total}</span></div>
                            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{used} used</div>
                            <div style={{height:4,background:'var(--cream-dark)',borderRadius:4,marginTop:8,overflow:'hidden'}}>
                              <div style={{height:'100%',background:remaining>0?'var(--matcha)':'#c0392b',width:`${(remaining/total)*100}%`,borderRadius:4}}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>)
        })()}

        {/* ── FORM ── */}
        {view==='form'&&(
          <div style={{maxWidth:700,margin:'0 auto'}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:20}}>
                {formMode==='add'?'+ Add Staff Member':`Edit — ${form.first_name} ${form.last_name}`}
              </div>

              {/* Employment type + Role — first */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div>
                  <label style={lStyle}>Employment Type *</label>
                  <select style={iStyle} value={form.employment_type} onChange={fv('employment_type')}>
                    {EMPLOYMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Role *</label>
                  <select style={iStyle} value={form.role} onChange={fv('role')}>
                    {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Auto rate display */}
              {(() => {
                const rate = getBaseRate(form.employment_type, form.role)
                const daily = getDailyRate(form.employment_type, form.role)
                if (!rate) return <div style={{fontSize:11,color:'#c0392b',marginBottom:12,padding:'8px 12px',background:'#fdeaea',borderRadius:8}}>⚠️ No rate defined for this employment type + role combination.</div>
                return (
                  <div style={{fontSize:11,color:'var(--matcha-dark)',marginBottom:12,padding:'8px 12px',background:'var(--matcha-pale)',borderRadius:8,display:'flex',gap:16}}>
                    <span>✅ <strong>Daily Rate:</strong> {peso(daily)}</span>
                    {rate.monthly&&<span><strong>Monthly:</strong> {peso(rate.monthly)}</span>}
                    <span style={{marginLeft:'auto',color:'var(--text-muted)'}}>8 paid hrs · 1 hr unpaid break</span>
                  </div>
                )
              })()}

              <div style={sHead()}>Basic Details</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>First Name *</label><input style={iStyle} value={form.first_name} onChange={fv('first_name')} /></div>
                <div><label style={lStyle}>Last Name *</label><input style={iStyle} value={form.last_name} onChange={fv('last_name')} /></div>
                <div><label style={lStyle}>Middle Name</label><input style={iStyle} value={form.middle_name} onChange={fv('middle_name')} /></div>
                <div><label style={lStyle}>Nickname</label><input style={iStyle} value={form.nickname} onChange={fv('nickname')} /></div>
                <div><label style={lStyle}>Birthday</label><input style={iStyle} type="date" value={form.birthday} onChange={fv('birthday')} /></div>
                <div><label style={lStyle}>Age</label><input style={iStyle} type="number" value={form.age} onChange={fv('age')} /></div>
                <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Birthplace</label><input style={iStyle} value={form.birthplace} onChange={fv('birthplace')} /></div>
              </div>

              <div style={sHead()}>Contact</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>Email</label><input style={iStyle} type="email" value={form.email} onChange={fv('email')} /></div>
                <div><label style={lStyle}>Mobile</label><input style={iStyle} value={form.mobile} onChange={fv('mobile')} placeholder="09XX XXX XXXX" /></div>
              </div>

              <div style={sHead()}>Government IDs</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>SSS</label><input style={iStyle} value={form.sss} onChange={fv('sss')} /></div>
                <div><label style={lStyle}>PhilHealth</label><input style={iStyle} value={form.philhealth} onChange={fv('philhealth')} /></div>
                <div><label style={lStyle}>Pag-IBIG</label><input style={iStyle} value={form.pagibig} onChange={fv('pagibig')} /></div>
                <div><label style={lStyle}>TIN</label><input style={iStyle} value={form.tin} onChange={fv('tin')} /></div>
              </div>

              <div style={sHead()}>Address</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>House No.</label><input style={iStyle} value={form.house_no} onChange={fv('house_no')} /></div>
                <div><label style={lStyle}>Street</label><input style={iStyle} value={form.street} onChange={fv('street')} /></div>
                <div><label style={lStyle}>Village</label><input style={iStyle} value={form.village} onChange={fv('village')} /></div>
                <div><label style={lStyle}>Barangay</label><input style={iStyle} value={form.barangay} onChange={fv('barangay')} /></div>
                <div><label style={lStyle}>City</label><input style={iStyle} value={form.city} onChange={fv('city')} /></div>
                <div><label style={lStyle}>Zip Code</label><input style={iStyle} value={form.zipcode} onChange={fv('zipcode')} /></div>
              </div>

              <div style={sHead()}>Family Background</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>Father's Last</label><input style={iStyle} value={form.father_last} onChange={fv('father_last')} /></div>
                <div><label style={lStyle}>Father's First</label><input style={iStyle} value={form.father_first} onChange={fv('father_first')} /></div>
                <div><label style={lStyle}>Father's Middle</label><input style={iStyle} value={form.father_middle} onChange={fv('father_middle')} /></div>
                <div><label style={lStyle}>Mother's Maiden</label><input style={iStyle} value={form.mother_maiden} onChange={fv('mother_maiden')} /></div>
                <div><label style={lStyle}>Mother's First</label><input style={iStyle} value={form.mother_first} onChange={fv('mother_first')} /></div>
                <div><label style={lStyle}>Mother's Middle</label><input style={iStyle} value={form.mother_middle} onChange={fv('mother_middle')} /></div>
              </div>

              <div style={sHead()}>Emergency Contact</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={lStyle}>Full Name</label><input style={iStyle} value={form.emergency_name} onChange={fv('emergency_name')} /></div>
                <div><label style={lStyle}>Contact Number</label><input style={iStyle} value={form.emergency_contact} onChange={fv('emergency_contact')} /></div>
                <div><label style={lStyle}>Relationship</label><input style={iStyle} value={form.emergency_relationship} onChange={fv('emergency_relationship')} /></div>
              </div>

              <div style={sHead()}>Payslips</div>
              <div style={{marginBottom:20}}>
                <label style={lStyle}>Google Drive Folder Link</label>
                <input style={iStyle} value={form.gdrive} onChange={fv('gdrive')} placeholder="https://drive.google.com/drive/folders/..." />
              </div>

              <div style={{display:'flex',gap:9}}>
                <button className="btn btn-secondary" onClick={()=>setView('grid')}>Cancel</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={submitForm} disabled={saving}>
                  {saving?'Saving…':formMode==='add'?'✓ Add Staff Member':'✓ Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

function PRow({label,value}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:500}}>{label}</span>
      <span style={{color:'var(--text-primary)',fontWeight:600,textAlign:'right',maxWidth:'60%'}}>{value}</span>
    </div>
  )
}

function PayRow({label,value,bold,big,red}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:big?14:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:bold?700:400}}>{label}</span>
      <span style={{fontWeight:bold?700:500,color:red?'#c0392b':bold?'var(--espresso)':'var(--text-primary)',fontFamily:"'DM Mono',monospace"}}>{value}</span>
    </div>
  )
}
