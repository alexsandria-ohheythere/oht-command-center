'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const ROLES = [
  'Cafe Supervisor',
  'Cafe Operations Support',
  'Senior Barista',
  'Junior Barista - Milk Station',
  'Junior Barista - Cashier',
  'Executive Chef',
  'Sous Chef',
  'Kitchen Staff',
]

const ROLE_COLORS = {
  'Cafe Supervisor':               '#b06af5',
  'Cafe Operations Support':       '#4a90c4',
  'Senior Barista':                '#7ab648',
  'Junior Barista - Milk Station': '#d4a843',
  'Junior Barista - Cashier':      '#e8845a',
  'Executive Chef':                '#c0392b',
  'Sous Chef':                     '#2d7a6a',
  'Kitchen Staff':                 '#5c3d1e',
}

const EMPTY = {
  first_name:'', last_name:'', middle_name:'', nickname:'',
  birthday:'', age:'', birthplace:'', email:'', mobile:'',
  sss:'', philhealth:'', pagibig:'', tin:'',
  house_no:'', street:'', village:'', barangay:'', city:'', zipcode:'',
  father_last:'', father_first:'', father_middle:'',
  mother_maiden:'', mother_first:'', mother_middle:'',
  emergency_name:'', emergency_contact:'', emergency_relationship:'',
  role: ROLES[0], gdrive:'', hours_assigned:0, hours_consumed:0, monthly_pay:0, status:'active',
}

const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()

const inputStyle = {
  width:'100%', background:'var(--surface)', border:'1px solid var(--border)',
  borderRadius:8, padding:'9px 12px', fontSize:12,
  fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none'
}
const labelStyle = {
  display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2,
  textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5
}
const sectionHead = {
  fontFamily:"'Montserrat',sans-serif", fontSize:12, fontWeight:700,
  color:'var(--espresso)', marginBottom:10, marginTop:18,
  paddingBottom:6, borderBottom:'1px solid var(--border)', textTransform:'uppercase', letterSpacing:1
}

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [view, setView]         = useState('grid')
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [formMode, setFormMode] = useState('add')
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [toast, setToast]       = useState(null)
  const fileRef = useRef()

  // ── FETCH ──
  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('last_name', { ascending: true })
    if (!error) setStaff(data || [])
    setLoading(false)
  }

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ── CSV ──
  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s/g,''))
      const rows = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''))
        const obj = {}; headers.forEach((h, idx) => { obj[h] = vals[idx] || '' })
        return {
          first_name: obj.firstname || obj.first_name || '',
          last_name:  obj.lastname  || obj.last_name  || '',
          middle_name: obj.middlename || '',
          nickname:   obj.nickname || '',
          birthday:   obj.birthday || null,
          age:        parseInt(obj.age) || null,
          birthplace: obj.birthplace || '',
          email:      obj.email || '',
          mobile:     obj.mobile || '',
          sss:        obj.sss || '',
          philhealth: obj.philhealth || '',
          pagibig:    obj.pagibig || '',
          tin:        obj.tin || '',
          house_no:   obj.houseno || '',
          street:     obj.street || '',
          village:    obj.village || '',
          barangay:   obj.barangay || '',
          city:       obj.city || '',
          zipcode:    obj.zipcode || '',
          role:       obj.role || ROLES[0],
          gdrive:     obj.gdrive || '',
          hours_assigned: parseInt(obj.hoursassigned) || 0,
          hours_consumed: parseInt(obj.hoursconsumed) || 0,
          monthly_pay:    parseInt(obj.monthlypay)    || 0,
          status: 'active',
        }
      }).filter(r => r.first_name && r.last_name)
      setCsvPreview(rows)
      setView('csv')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function confirmCSV() {
    setSaving(true)
    const { error } = await supabase.from('staff').insert(csvPreview)
    if (error) { showToast('❌', 'Import failed: ' + error.message); setSaving(false); return }
    await fetchStaff()
    setCsvPreview([])
    setView('grid')
    showToast('✅', `${csvPreview.length} staff imported successfully`)
    setSaving(false)
  }

  // ── FORM ──
  function openAdd() { setForm({...EMPTY}); setFormMode('add'); setView('form') }
  function openEdit(s) { setForm({...s, birthday: s.birthday||'', age: s.age||''}); setFormMode('edit'); setView('form') }
  const f = k => e => setForm(prev => ({...prev, [k]: e.target.value}))

  async function submitForm() {
    if (!form.first_name?.trim()) { showToast('⚠️','First name required'); return }
    if (!form.last_name?.trim())  { showToast('⚠️','Last name required');  return }
    setSaving(true)
    const payload = { ...form }
    if (!payload.birthday) payload.birthday = null
    if (!payload.age) payload.age = null
    delete payload.id; delete payload.created_at

    if (formMode === 'add') {
      const { error } = await supabase.from('staff').insert([payload])
      if (error) { showToast('❌', error.message); setSaving(false); return }
      showToast('✅', `${form.first_name} ${form.last_name} added`)
    } else {
      const { error } = await supabase.from('staff').update(payload).eq('id', form.id)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      showToast('✅', `${form.first_name} ${form.last_name} updated`)
    }
    await fetchStaff()
    setView('grid')
    setSaving(false)
  }

  async function deleteStaff(id) {
    if (!confirm('Remove this staff member? This cannot be undone.')) return
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) { showToast('❌', error.message); return }
    await fetchStaff()
    setView('grid')
    showToast('🗑️','Staff member removed')
  }

  function downloadTemplate() {
    const headers = 'firstName,lastName,middleName,nickname,birthday,age,birthplace,email,mobile,sss,philhealth,pagibig,tin,houseNo,street,village,barangay,city,zipcode,role,gdrive,hoursAssigned,hoursConsumed,monthlyPay'
    const sample  = 'Juan,Dela Cruz,Santos,Juanito,1998-05-15,27,Manila,juan@email.com,09171234567,34-5678901-2,12-345678901-2,1234-5678-9012,123-456-789-000,123,Rizal St,Green Village,Poblacion,Makati,1200,Senior Barista,,160,0,0'
    const blob = new Blob([headers+'\n'+sample], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='oht-staff-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const name = `${s.first_name} ${s.last_name} ${s.nickname||''}`.toLowerCase()
    if (q && !name.includes(q)) return false
    if (roleFilter && s.role !== roleFilter) return false
    return true
  })

  return (
    <AuthShell>
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Staff Directory</div>
          <div className="topbar-sub">{loading ? 'Loading…' : `${staff.length} team members · Oh Hey There`}</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {view !== 'grid' && <button className="btn btn-secondary" onClick={() => setView('grid')}>← Back</button>}
          {view === 'grid' && <>
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
        {view === 'grid' && <>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{position:'relative',flex:1,minWidth:180}}>
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'var(--text-muted)'}}>🔍</span>
              <input style={{...inputStyle,paddingLeft:30}} placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <select style={{...inputStyle,width:'auto',minWidth:200}} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',background:'var(--white)',border:'1px solid var(--border)',padding:'7px 12px',borderRadius:8}}>
              {filtered.length} of {staff.length}
            </div>
          </div>

          <div style={{background:'var(--sky-pale)',border:'1px solid #4a90c444',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:12,fontSize:12}}>
            <span>💡</span>
            <span style={{color:'var(--sky)',fontWeight:600}}>Bulk import via CSV</span>
            <span style={{color:'var(--text-muted)'}}>Required: <code style={{background:'#e8f0fb',padding:'1px 5px',borderRadius:4}}>firstName, lastName, role</code></span>
            <button onClick={downloadTemplate} style={{marginLeft:'auto',background:'var(--sky)',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>↓ Download Template</button>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-muted)',fontSize:13}}>Loading staff…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>👥</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:'var(--espresso)',marginBottom:6}}>No staff yet</div>
              <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Add your first team member or import via CSV</div>
              <button className="btn btn-primary" onClick={openAdd}>+ Add First Staff Member</button>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {filtered.map(s => (
                <div key={s.id} onClick={() => {setSelected(s); setView('profile')}}
                  style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:16,cursor:'pointer',transition:'all .2s',borderTop:`3px solid ${getRoleColor(s.role)}`}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:11,marginBottom:12}}>
                    <div style={{width:42,height:42,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(s.first_name,s.last_name)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,color:'var(--espresso)'}}>
                        {s.first_name} {s.last_name}
                      </div>
                      {s.nickname && <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>"{s.nickname}"</div>}
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role),border:`1px solid ${getRoleColor(s.role)}44`,marginTop:4,display:'inline-block',letterSpacing:.3}}>
                        {s.role}
                      </span>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {[['HRS ASSIGNED',(s.hours_assigned||0)+'h','var(--sky)'],['HRS CONSUMED',(s.hours_consumed||0)+'h','var(--matcha-dark)'],['MONTHLY PAY','₱'+(s.monthly_pay||0).toLocaleString(),'var(--gold)']].map(([label,val,color])=>(
                      <div key={label} style={{background:'var(--surface)',borderRadius:8,padding:'8px 6px',textAlign:'center'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color}}>{val}</div>
                        <div style={{fontSize:8,color:'var(--text-muted)',letterSpacing:.8,fontWeight:700,marginTop:2}}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {s.gdrive && (
                    <a href={s.gdrive} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                      style={{display:'flex',alignItems:'center',gap:5,marginTop:10,fontSize:10,color:'#1a73e8',fontWeight:600,textDecoration:'none'}}>
                      📁 View Payslips
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── CSV PREVIEW ── */}
        {view === 'csv' && <>
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
              <thead>
                <tr style={{background:'var(--espresso)'}}>
                  {['Name','Nickname','Role','Email','Mobile','City'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((s,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                    <td style={{padding:'9px 14px',fontWeight:600}}>{s.first_name} {s.last_name}</td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.nickname||'—'}</td>
                    <td style={{padding:'9px 14px'}}><span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role)}}>{s.role}</span></td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.email||'—'}</td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.mobile||'—'}</td>
                    <td style={{padding:'9px 14px',color:'var(--text-muted)'}}>{s.city||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* ── PROFILE ── */}
        {view === 'profile' && selected && (() => {
          const s = staff.find(x=>x.id===selected.id) || selected
          return (
            <div>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'22px 24px',marginBottom:14,display:'flex',alignItems:'flex-start',gap:18}}>
                <div style={{width:60,height:60,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'white',flexShrink:0}}>
                  {initials(s.first_name,s.last_name)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:900,color:'var(--espresso)'}}>
                    {s.first_name} {s.middle_name?s.middle_name[0]+'. ':''}{s.last_name}
                  </div>
                  {s.nickname && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>"{s.nickname}"</div>}
                  <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:10,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role),border:`1px solid ${getRoleColor(s.role)}55`,marginTop:6,display:'inline-block'}}>
                    {s.role}
                  </span>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-secondary" onClick={()=>openEdit(s)}>✏️ Edit</button>
                  <button className="btn btn-danger" onClick={()=>deleteStaff(s.id)}>🗑 Remove</button>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                {[['Hours Assigned',(s.hours_assigned||0)+'h','var(--sky)','🕐'],['Hours Consumed',(s.hours_consumed||0)+'h','var(--matcha-dark)','✅'],['Monthly Pay','₱'+(s.monthly_pay||0).toLocaleString(),'var(--gold)','💸']].map(([label,val,color,icon])=>(
                  <div key={label} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 20px'}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>{icon} {label}</div>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:26,fontWeight:700,color}}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={sectionHead}>Basic Details</div>
                  <PRow label="Birthday"   value={s.birthday||'—'} />
                  <PRow label="Age"        value={s.age||'—'} />
                  <PRow label="Birthplace" value={s.birthplace||'—'} />
                  <div style={sectionHead}>Contact</div>
                  <PRow label="Email"  value={s.email||'—'} />
                  <PRow label="Mobile" value={s.mobile||'—'} />
                  <div style={sectionHead}>Government IDs</div>
                  <PRow label="SSS"       value={s.sss||'—'} />
                  <PRow label="PhilHealth" value={s.philhealth||'—'} />
                  <PRow label="Pag-IBIG"  value={s.pagibig||'—'} />
                  <PRow label="TIN"       value={s.tin||'—'} />
                  <div style={sectionHead}>Family Background</div>
                  <PRow label="Father's Name" value={[s.father_first,s.father_middle,s.father_last].filter(Boolean).join(' ')||'—'} />
                  <PRow label="Mother's Name" value={[s.mother_first,s.mother_middle,s.mother_maiden].filter(Boolean).join(' ')||'—'} />
                </div>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={sectionHead}>Address</div>
                  <PRow label="House No." value={s.house_no||'—'} />
                  <PRow label="Street"    value={s.street||'—'} />
                  <PRow label="Village"   value={s.village||'—'} />
                  <PRow label="Barangay"  value={s.barangay||'—'} />
                  <PRow label="City"      value={s.city||'—'} />
                  <PRow label="Zip Code"  value={s.zipcode||'—'} />
                  <div style={sectionHead}>Emergency Contact</div>
                  <PRow label="Name"         value={s.emergency_name||'—'} />
                  <PRow label="Number"       value={s.emergency_contact||'—'} />
                  <PRow label="Relationship" value={s.emergency_relationship||'—'} />
                  <div style={sectionHead}>Payslips</div>
                  {s.gdrive
                    ? <a href={s.gdrive} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,background:'#e8f4f8',border:'1px solid #1a73e855',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#1a73e8',fontWeight:600,textDecoration:'none'}}>
                        📁 Open Google Drive Folder
                      </a>
                    : <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No payslip folder linked yet.</div>
                  }
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── FORM ── */}
        {view === 'form' && (
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:20,color:'var(--espresso)'}}>
                {formMode==='add'?'+ Add Staff Member':`Edit — ${form.first_name} ${form.last_name}`}
              </div>

              <div style={{marginBottom:16}}>
                <label style={labelStyle}>Role & Access Level *</label>
                <select style={inputStyle} value={form.role} onChange={f('role')}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>This determines what the employee can access in their portal.</div>
              </div>

              <div style={sectionHead}>Basic Details</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>First Name *</label><input style={inputStyle} value={form.first_name} onChange={f('first_name')} /></div>
                <div><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={form.last_name} onChange={f('last_name')} /></div>
                <div><label style={labelStyle}>Middle Name</label><input style={inputStyle} value={form.middle_name} onChange={f('middle_name')} /></div>
                <div><label style={labelStyle}>Nickname</label><input style={inputStyle} value={form.nickname} onChange={f('nickname')} placeholder="What they go by" /></div>
                <div><label style={labelStyle}>Birthday</label><input style={inputStyle} type="date" value={form.birthday} onChange={f('birthday')} /></div>
                <div><label style={labelStyle}>Age</label><input style={inputStyle} type="number" value={form.age} onChange={f('age')} /></div>
                <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Birthplace</label><input style={inputStyle} value={form.birthplace} onChange={f('birthplace')} /></div>
              </div>

              <div style={sectionHead}>Contact</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={f('email')} /></div>
                <div><label style={labelStyle}>Mobile Number</label><input style={inputStyle} value={form.mobile} onChange={f('mobile')} placeholder="09XX XXX XXXX" /></div>
              </div>

              <div style={sectionHead}>Government IDs</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>SSS</label><input style={inputStyle} value={form.sss} onChange={f('sss')} /></div>
                <div><label style={labelStyle}>PhilHealth</label><input style={inputStyle} value={form.philhealth} onChange={f('philhealth')} /></div>
                <div><label style={labelStyle}>Pag-IBIG</label><input style={inputStyle} value={form.pagibig} onChange={f('pagibig')} /></div>
                <div><label style={labelStyle}>TIN</label><input style={inputStyle} value={form.tin} onChange={f('tin')} /></div>
              </div>

              <div style={sectionHead}>Address</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>House No.</label><input style={inputStyle} value={form.house_no} onChange={f('house_no')} /></div>
                <div><label style={labelStyle}>Street Name</label><input style={inputStyle} value={form.street} onChange={f('street')} /></div>
                <div><label style={labelStyle}>Village</label><input style={inputStyle} value={form.village} onChange={f('village')} /></div>
                <div><label style={labelStyle}>Barangay</label><input style={inputStyle} value={form.barangay} onChange={f('barangay')} /></div>
                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.city} onChange={f('city')} /></div>
                <div><label style={labelStyle}>Zip Code</label><input style={inputStyle} value={form.zipcode} onChange={f('zipcode')} /></div>
              </div>

              <div style={sectionHead}>Family Background</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>Father's Last Name</label><input style={inputStyle} value={form.father_last} onChange={f('father_last')} /></div>
                <div><label style={labelStyle}>Father's First Name</label><input style={inputStyle} value={form.father_first} onChange={f('father_first')} /></div>
                <div><label style={labelStyle}>Father's Middle Name</label><input style={inputStyle} value={form.father_middle} onChange={f('father_middle')} /></div>
                <div><label style={labelStyle}>Mother's Maiden Name</label><input style={inputStyle} value={form.mother_maiden} onChange={f('mother_maiden')} /></div>
                <div><label style={labelStyle}>Mother's First Name</label><input style={inputStyle} value={form.mother_first} onChange={f('mother_first')} /></div>
                <div><label style={labelStyle}>Mother's Middle Name</label><input style={inputStyle} value={form.mother_middle} onChange={f('mother_middle')} /></div>
              </div>

              <div style={sectionHead}>Emergency Contact</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:4}}>
                <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={form.emergency_name} onChange={f('emergency_name')} /></div>
                <div><label style={labelStyle}>Contact Number</label><input style={inputStyle} value={form.emergency_contact} onChange={f('emergency_contact')} /></div>
                <div><label style={labelStyle}>Relationship</label><input style={inputStyle} value={form.emergency_relationship} onChange={f('emergency_relationship')} /></div>
              </div>

              <div style={sectionHead}>Payslips</div>
              <div style={{marginBottom:20}}>
                <label style={labelStyle}>Google Drive Folder Link</label>
                <input style={inputStyle} value={form.gdrive} onChange={f('gdrive')} placeholder="https://drive.google.com/drive/folders/..." />
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>Paste the Google Drive folder link where this employee's payslips are stored.</div>
              </div>

              <div style={{display:'flex',gap:9}}>
                <button className="btn btn-secondary" onClick={()=>setView('grid')}>Cancel</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={submitForm} disabled={saving}>
                  {saving ? 'Saving…' : formMode==='add' ? '✓ Add Staff Member' : '✓ Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

function PRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:500}}>{label}</span>
      <span style={{color:'var(--text-primary)',fontWeight:600,textAlign:'right',maxWidth:'60%'}}>{value}</span>
    </div>
  )
}
