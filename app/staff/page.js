'use client'
import { useState, useRef } from 'react'
import AuthShell from '../../components/AuthShell'

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
  'Cafe Supervisor':              '#b06af5',
  'Cafe Operations Support':      '#4a90c4',
  'Senior Barista':               '#7ab648',
  'Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':     '#e8845a',
  'Executive Chef':               '#c0392b',
  'Sous Chef':                    '#2d7a6a',
  'Kitchen Staff':                '#5c3d1e',
}

const SAMPLE_STAFF = [
  { id:1,  firstName:'Maria',   lastName:'Santos',    nickname:'Mae',    role:'Senior Barista',               color:'#7ab648', hoursAssigned:160, hoursConsumed:148, monthlyPay:11100, gdrive:'', status:'active' },
  { id:2,  firstName:'Josie',   lastName:'Reyes',     nickname:'Jos',    role:'Junior Barista - Cashier',     color:'#e8845a', hoursAssigned:160, hoursConsumed:160, monthlyPay:9600,  gdrive:'', status:'active' },
  { id:3,  firstName:'Karl',    lastName:'Bautista',  nickname:'KarlB',  role:'Junior Barista - Milk Station',color:'#d4a843', hoursAssigned:160, hoursConsumed:132, monthlyPay:7920,  gdrive:'', status:'active' },
  { id:4,  firstName:'Trisha',  lastName:'Lim',       nickname:'Trish',  role:'Cafe Supervisor',              color:'#b06af5', hoursAssigned:176, hoursConsumed:176, monthlyPay:19360, gdrive:'', status:'active' },
  { id:5,  firstName:'Ryan',    lastName:'Cruz',      nickname:'Ry',     role:'Junior Barista - Milk Station',color:'#5c3d1e', hoursAssigned:160, hoursConsumed:155, monthlyPay:9300,  gdrive:'', status:'active' },
]

const EMPTY_STAFF = {
  firstName:'', lastName:'', middleName:'', nickname:'', birthday:'', age:'', birthplace:'',
  email:'', mobile:'',
  sss:'', philhealth:'', pagibig:'', tin:'',
  houseNo:'', street:'', village:'', barangay:'', city:'', zipcode:'',
  fatherLast:'', fatherFirst:'', fatherMiddle:'',
  motherMaiden:'', motherFirst:'', motherMiddle:'',
  emergencyName:'', emergencyContact:'', emergencyRelationship:'',
  role: ROLES[0], gdrive:'', status:'active',
}

function initials(f, l) {
  return ((f||'')[0]||'') + ((l||'')[0]||'')
}

function getRoleColor(role) {
  return ROLE_COLORS[role] || '#7a6a50'
}

export default function StaffPage() {
  const [staff, setStaff] = useState(SAMPLE_STAFF)
  const [view, setView] = useState('grid') // grid | profile | form | csv
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_STAFF)
  const [formMode, setFormMode] = useState('add') // add | edit
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [csvError, setCsvError] = useState('')
  const [toast, setToast] = useState(null)
  const [csvPreview, setCsvPreview] = useState([])
  const fileRef = useRef()

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ── CSV IMPORT ──
  function handleCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const required = ['firstname', 'lastname', 'role']
      const missing = required.filter(r => !headers.includes(r))
      if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); return }
      const rows = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const obj = {}
        headers.forEach((h, idx) => { obj[h] = vals[idx] || '' })
        return {
          id: Date.now() + i,
          firstName: obj.firstname || '',
          lastName: obj.lastname || '',
          middleName: obj.middlename || '',
          nickname: obj.nickname || '',
          birthday: obj.birthday || '',
          age: obj.age || '',
          birthplace: obj.birthplace || '',
          email: obj.email || '',
          mobile: obj.mobile || '',
          sss: obj.sss || '', philhealth: obj.philhealth || '',
          pagibig: obj.pagibig || '', tin: obj.tin || '',
          houseNo: obj.houseno || '', street: obj.street || '',
          village: obj.village || '', barangay: obj.barangay || '',
          city: obj.city || '', zipcode: obj.zipcode || '',
          fatherLast: '', fatherFirst: '', fatherMiddle: '',
          motherMaiden: '', motherFirst: '', motherMiddle: '',
          emergencyName: '', emergencyContact: '', emergencyRelationship: '',
          role: obj.role || ROLES[0],
          gdrive: obj.gdrive || '',
          status: 'active',
          hoursAssigned: parseInt(obj.hoursassigned) || 0,
          hoursConsumed: parseInt(obj.hoursconsumed) || 0,
          monthlyPay: parseInt(obj.monthlypay) || 0,
        }
      }).filter(r => r.firstName && r.lastName)
      setCsvPreview(rows)
      setCsvError('')
      setView('csv')
    }
    reader.readAsText(file)
  }

  function confirmCSV() {
    setStaff(prev => [...prev, ...csvPreview])
    setCsvPreview([])
    setView('grid')
    showToast('✅', `${csvPreview.length} staff imported successfully`)
  }

  // ── FORM ──
  function openAdd() {
    setForm({ ...EMPTY_STAFF })
    setFormMode('add')
    setView('form')
  }

  function openEdit(s) {
    setForm({ ...s })
    setFormMode('edit')
    setView('form')
  }

  function submitForm() {
    if (!form.firstName || !form.lastName) { showToast('⚠️', 'First and last name required'); return }
    if (!ROLES.includes(form.role)) { showToast('⚠️', 'Please select a valid role'); return }
    if (formMode === 'add') {
      const newS = { ...form, id: Date.now(), hoursAssigned: 0, hoursConsumed: 0, monthlyPay: 0, color: getRoleColor(form.role) }
      setStaff(prev => [...prev, newS])
      showToast('✅', `${form.firstName} ${form.lastName} added`)
    } else {
      setStaff(prev => prev.map(s => s.id === form.id ? { ...form, color: getRoleColor(form.role) } : s))
      showToast('✅', `${form.firstName} ${form.lastName} updated`)
    }
    setView('grid')
  }

  function deleteStaff(id) {
    if (!confirm('Remove this staff member?')) return
    setStaff(prev => prev.filter(s => s.id !== id))
    setView('grid')
    showToast('🗑️', 'Staff member removed')
  }

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const name = `${s.firstName} ${s.lastName} ${s.nickname}`.toLowerCase()
    if (q && !name.includes(q)) return false
    if (roleFilter && s.role !== roleFilter) return false
    return true
  })

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

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
    fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700,
    color:'var(--espresso)', marginBottom:12, marginTop:20,
    paddingBottom:6, borderBottom:'1px solid var(--border)'
  }

  return (
    <AuthShell>
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Staff Directory</div>
          <div className="topbar-sub">{staff.length} team members · Oh Hey There</div>
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'center' }}>
          {view !== 'grid' && (
            <button className="btn btn-secondary" onClick={() => setView('grid')}>← Back</button>
          )}
          {view === 'grid' && <>
            <label style={{
              display:'flex', alignItems:'center', gap:6, background:'var(--sky-pale)',
              border:'1px solid var(--sky)', borderRadius:8, padding:'7px 14px',
              fontSize:11, fontWeight:700, color:'var(--sky)', cursor:'pointer'
            }}>
              📂 Import CSV
              <input type="file" accept=".csv" ref={fileRef} style={{ display:'none' }} onChange={handleCSV} />
            </label>
            <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
          </>}
        </div>
      </div>

      <div className="page-content">

        {/* ── GRID VIEW ── */}
        {view === 'grid' && <>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative', flex:1, minWidth:180 }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--text-muted)' }}>🔍</span>
              <input style={{ ...inputStyle, paddingLeft:30 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select style={{ ...inputStyle, width:'auto', minWidth:200 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--text-muted)', background:'var(--white)', border:'1px solid var(--border)', padding:'7px 12px', borderRadius:8 }}>
              {filtered.length} of {staff.length}
            </div>
          </div>

          {/* CSV template download */}
          <div style={{ background:'var(--sky-pale)', border:'1px solid #4a90c444', borderRadius:10, padding:'11px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
            <span style={{ fontSize:16 }}>💡</span>
            <span style={{ color:'var(--sky)', fontWeight:600 }}>Bulk import via CSV</span>
            <span style={{ color:'var(--text-muted)' }}>Required columns: <code style={{ background:'#e8f0fb', padding:'1px 5px', borderRadius:4 }}>firstName, lastName, role</code> · Optional: nickname, email, mobile, birthday, sss, philhealth, pagibig, tin, city, gdrive</span>
            <button onClick={downloadTemplate} style={{ marginLeft:'auto', background:'var(--sky)', color:'white', border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap' }}>
              ↓ Download Template
            </button>
          </div>

          {/* Staff cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => { setSelected(s); setView('profile') }}
                style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'16px', cursor:'pointer', transition:'all .2s', borderTop:`3px solid ${getRoleColor(s.role)}` }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>

                <div style={{ display:'flex', alignItems:'flex-start', gap:11, marginBottom:12 }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:getRoleColor(s.role), display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'white', flexShrink:0, fontFamily:"'Playfair Display',serif" }}>
                    {initials(s.firstName, s.lastName)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:'var(--espresso)' }}>
                      {s.firstName} {s.lastName}
                    </div>
                    {s.nickname && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>"{s.nickname}"</div>}
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background:getRoleColor(s.role)+'22', color:getRoleColor(s.role), border:`1px solid ${getRoleColor(s.role)}44`, marginTop:4, display:'inline-block', letterSpacing:.3 }}>
                      {s.role}
                    </span>
                  </div>
                </div>

                {/* Bento stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[
                    ['HRS ASSIGNED', s.hoursAssigned + 'h', 'var(--sky)'],
                    ['HRS CONSUMED', s.hoursConsumed + 'h', 'var(--matcha-dark)'],
                    ['MONTHLY PAY', '₱' + (s.monthlyPay||0).toLocaleString(), 'var(--gold)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background:'var(--surface)', borderRadius:8, padding:'8px 6px', textAlign:'center' }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700, color }}>{val}</div>
                      <div style={{ fontSize:8, color:'var(--text-muted)', letterSpacing:.8, fontWeight:700, marginTop:2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {s.gdrive && (
                  <a href={s.gdrive} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ display:'flex', alignItems:'center', gap:5, marginTop:10, fontSize:10, color:'#1a73e8', fontWeight:600, textDecoration:'none' }}>
                    📁 View Payslips (Google Drive)
                  </a>
                )}
              </div>
            ))}
          </div>
        </>}

        {/* ── CSV PREVIEW ── */}
        {view === 'csv' && <>
          <div style={{ background:'var(--matcha-pale)', border:'1px solid var(--matcha)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:16 }}>✅</span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--matcha-dark)' }}>{csvPreview.length} staff members ready to import</span>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="btn btn-secondary" onClick={() => { setCsvPreview([]); setView('grid') }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmCSV}>Confirm Import</button>
            </div>
          </div>
          {csvError && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'var(--prio-high)' }}>{csvError}</div>}
          <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--espresso)' }}>
                  {['Name','Nickname','Role','Email','Mobile','City'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--matcha-light)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((s,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)', background: i%2===0?'var(--white)':'var(--surface)' }}>
                    <td style={{ padding:'9px 14px', fontWeight:600 }}>{s.firstName} {s.lastName}</td>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)' }}>{s.nickname||'—'}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background:getRoleColor(s.role)+'22', color:getRoleColor(s.role) }}>{s.role}</span>
                    </td>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)' }}>{s.email||'—'}</td>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)' }}>{s.mobile||'—'}</td>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)' }}>{s.city||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* ── PROFILE VIEW ── */}
        {view === 'profile' && selected && (() => {
          const s = staff.find(x => x.id === selected.id) || selected
          return (
            <div>
              {/* Profile header */}
              <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:14, padding:'22px 24px', marginBottom:14, display:'flex', alignItems:'flex-start', gap:18 }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:getRoleColor(s.role), display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'white', fontFamily:"'Playfair Display',serif", flexShrink:0 }}>
                  {initials(s.firstName, s.lastName)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:'var(--espresso)' }}>
                    {s.firstName} {s.middleName ? s.middleName[0]+'. ' : ''}{s.lastName}
                  </div>
                  {s.nickname && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>"{s.nickname}"</div>}
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:10, background:getRoleColor(s.role)+'22', color:getRoleColor(s.role), border:`1px solid ${getRoleColor(s.role)}55`, marginTop:6, display:'inline-block' }}>
                    {s.role}
                  </span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-secondary" onClick={() => openEdit(s)}>✏️ Edit</button>
                  <button className="btn btn-danger" onClick={() => deleteStaff(s.id)}>🗑 Remove</button>
                </div>
              </div>

              {/* Bento */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                {[
                  ['Hours Assigned', s.hoursAssigned + 'h', 'var(--sky)', '🕐'],
                  ['Hours Consumed', s.hoursConsumed + 'h', 'var(--matcha-dark)', '✅'],
                  ['Monthly Pay', '₱' + (s.monthlyPay||0).toLocaleString(), 'var(--gold)', '💸'],
                ].map(([label, val, color, icon]) => (
                  <div key={label} style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px' }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>{icon} {label}</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {/* Employee data */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px' }}>
                  <div style={sectionHead}>Basic Details</div>
                  <ProfileRow label="Birthday" value={s.birthday||'—'} />
                  <ProfileRow label="Age" value={s.age||'—'} />
                  <ProfileRow label="Birthplace" value={s.birthplace||'—'} />
                  <div style={sectionHead}>Contact</div>
                  <ProfileRow label="Email" value={s.email||'—'} />
                  <ProfileRow label="Mobile" value={s.mobile||'—'} />
                  <div style={sectionHead}>Government IDs</div>
                  <ProfileRow label="SSS" value={s.sss||'—'} />
                  <ProfileRow label="PhilHealth" value={s.philhealth||'—'} />
                  <ProfileRow label="Pag-IBIG" value={s.pagibig||'—'} />
                  <ProfileRow label="TIN" value={s.tin||'—'} />
                </div>
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px' }}>
                  <div style={sectionHead}>Address</div>
                  <ProfileRow label="House No." value={s.houseNo||'—'} />
                  <ProfileRow label="Street" value={s.street||'—'} />
                  <ProfileRow label="Village" value={s.village||'—'} />
                  <ProfileRow label="Barangay" value={s.barangay||'—'} />
                  <ProfileRow label="City" value={s.city||'—'} />
                  <ProfileRow label="Zip Code" value={s.zipcode||'—'} />
                  <div style={sectionHead}>Emergency Contact</div>
                  <ProfileRow label="Name" value={s.emergencyName||'—'} />
                  <ProfileRow label="Number" value={s.emergencyContact||'—'} />
                  <ProfileRow label="Relationship" value={s.emergencyRelationship||'—'} />
                  <div style={sectionHead}>Payslips</div>
                  {s.gdrive
                    ? <a href={s.gdrive} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#e8f4f8', border:'1px solid #1a73e855', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#1a73e8', fontWeight:600, textDecoration:'none' }}>
                        📁 Open Google Drive Folder
                      </a>
                    : <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>No payslip folder linked yet. Edit profile to add.</div>
                  }
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── FORM VIEW ── */}
        {view === 'form' && (
          <div style={{ maxWidth:680, margin:'0 auto' }}>
            <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:14, padding:'24px 28px' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, marginBottom:20, color:'var(--espresso)' }}>
                {formMode === 'add' ? '+ Add Staff Member' : `Edit — ${form.firstName} ${form.lastName}`}
              </div>

              {/* Role — first because it sets access */}
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Role & Access Level *</label>
                <select style={inputStyle} value={form.role} onChange={f('role')}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:5 }}>This determines what the employee can access in their portal.</div>
              </div>

              <div style={sectionHead}>Basic Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>First Name *</label><input style={inputStyle} value={form.firstName} onChange={f('firstName')} /></div>
                <div><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={form.lastName} onChange={f('lastName')} /></div>
                <div><label style={labelStyle}>Middle Name</label><input style={inputStyle} value={form.middleName} onChange={f('middleName')} /></div>
                <div><label style={labelStyle}>Nickname</label><input style={inputStyle} value={form.nickname} onChange={f('nickname')} placeholder="What they go by" /></div>
                <div><label style={labelStyle}>Birthday</label><input style={inputStyle} type="date" value={form.birthday} onChange={f('birthday')} /></div>
                <div><label style={labelStyle}>Age</label><input style={inputStyle} type="number" value={form.age} onChange={f('age')} /></div>
                <div style={{ gridColumn:'1/-1' }}><label style={labelStyle}>Birthplace</label><input style={inputStyle} value={form.birthplace} onChange={f('birthplace')} /></div>
              </div>

              <div style={sectionHead}>Contact</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={f('email')} /></div>
                <div><label style={labelStyle}>Mobile Number</label><input style={inputStyle} value={form.mobile} onChange={f('mobile')} placeholder="09XX XXX XXXX" /></div>
              </div>

              <div style={sectionHead}>Government IDs</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>SSS</label><input style={inputStyle} value={form.sss} onChange={f('sss')} /></div>
                <div><label style={labelStyle}>PhilHealth</label><input style={inputStyle} value={form.philhealth} onChange={f('philhealth')} /></div>
                <div><label style={labelStyle}>Pag-IBIG</label><input style={inputStyle} value={form.pagibig} onChange={f('pagibig')} /></div>
                <div><label style={labelStyle}>TIN</label><input style={inputStyle} value={form.tin} onChange={f('tin')} /></div>
              </div>

              <div style={sectionHead}>Address</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>House No.</label><input style={inputStyle} value={form.houseNo} onChange={f('houseNo')} /></div>
                <div><label style={labelStyle}>Street Name</label><input style={inputStyle} value={form.street} onChange={f('street')} /></div>
                <div><label style={labelStyle}>Village</label><input style={inputStyle} value={form.village} onChange={f('village')} /></div>
                <div><label style={labelStyle}>Barangay</label><input style={inputStyle} value={form.barangay} onChange={f('barangay')} /></div>
                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.city} onChange={f('city')} /></div>
                <div><label style={labelStyle}>Zip Code</label><input style={inputStyle} value={form.zipcode} onChange={f('zipcode')} /></div>
              </div>

              <div style={sectionHead}>Family Background</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>Father's Last Name</label><input style={inputStyle} value={form.fatherLast} onChange={f('fatherLast')} /></div>
                <div><label style={labelStyle}>Father's First Name</label><input style={inputStyle} value={form.fatherFirst} onChange={f('fatherFirst')} /></div>
                <div><label style={labelStyle}>Father's Middle Name</label><input style={inputStyle} value={form.fatherMiddle} onChange={f('fatherMiddle')} /></div>
                <div><label style={labelStyle}>Mother's Maiden Name</label><input style={inputStyle} value={form.motherMaiden} onChange={f('motherMaiden')} /></div>
                <div><label style={labelStyle}>Mother's First Name</label><input style={inputStyle} value={form.motherFirst} onChange={f('motherFirst')} /></div>
                <div><label style={labelStyle}>Mother's Middle Name</label><input style={inputStyle} value={form.motherMiddle} onChange={f('motherMiddle')} /></div>
              </div>

              <div style={sectionHead}>Emergency Contact</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={form.emergencyName} onChange={f('emergencyName')} /></div>
                <div><label style={labelStyle}>Contact Number</label><input style={inputStyle} value={form.emergencyContact} onChange={f('emergencyContact')} /></div>
                <div><label style={labelStyle}>Relationship</label><input style={inputStyle} value={form.emergencyRelationship} onChange={f('emergencyRelationship')} /></div>
              </div>

              <div style={sectionHead}>Payslips</div>
              <div style={{ marginBottom:20 }}>
                <label style={labelStyle}>Google Drive Folder Link</label>
                <input style={inputStyle} value={form.gdrive} onChange={f('gdrive')} placeholder="https://drive.google.com/drive/folders/..." />
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:5 }}>Paste the Google Drive folder link where this employee's payslips are stored.</div>
              </div>

              <div style={{ display:'flex', gap:9 }}>
                <button className="btn btn-secondary" onClick={() => setView('grid')}>Cancel</button>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={submitForm}>
                  {formMode === 'add' ? '✓ Add Staff Member' : '✓ Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position:'fixed', bottom:22, right:22, background:'var(--espresso)', color:'var(--cream)',
          border:'1px solid #3d3020', borderRadius:12, padding:'12px 16px', fontSize:12,
          fontWeight:500, display:'flex', alignItems:'center', gap:9,
          boxShadow:'0 8px 28px rgba(0,0,0,.2)', zIndex:1000
        }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )

  function downloadTemplate() {
    const headers = 'firstName,lastName,middleName,nickname,birthday,age,birthplace,email,mobile,sss,philhealth,pagibig,tin,houseNo,street,village,barangay,city,zipcode,role,gdrive,hoursAssigned,hoursConsumed,monthlyPay'
    const sample = 'Juan,Dela Cruz,Santos,Juanito,1998-05-15,27,Manila,juan@email.com,09171234567,34-5678901-2,12-345678901-2,1234-5678-9012,123-456-789-000,123,Rizal St,Green Village,Poblacion,Makati,1200,Senior Barista,,160,0,0'
    const blob = new Blob([headers + '\n' + sample], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='oht-staff-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }
}

function ProfileRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--cream-dark)', fontSize:12 }}>
      <span style={{ color:'var(--text-muted)', fontWeight:500 }}>{label}</span>
      <span style={{ color:'var(--text-primary)', fontWeight:600, textAlign:'right', maxWidth:'60%' }}>{value}</span>
    </div>
  )
}
