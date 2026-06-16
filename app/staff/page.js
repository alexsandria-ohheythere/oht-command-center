'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const ROLES = ['Cafe Supervisor','Cafe Operations Support','Senior Barista','Junior Barista - Milk Station','Junior Barista - Cashier','Executive Chef','Sous Chef','Kitchen Staff']
const EMP_TYPES = ['Full-time','Part-time','Freelancer']
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

const iStyle = {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',width:'100%'}

const EMPTY = {first_name:'',last_name:'',nickname:'',role:'Senior Barista',employment_type:'Full-time',email:'',phone:'',min_shifts_per_week:0}

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState(EMPTY)
  const [search, setSearch]         = useState('')
  const [toast, setToast]           = useState(null)
  const [showOnboard, setShowOnboard] = useState(null) // staff object
  const [onboardPass, setOnboardPass] = useState('')
  const [onboarding, setOnboarding]   = useState(false)
  const fileRef = useRef()

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('last_name')
    setStaff(data || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }

  // ── INLINE EDIT ──
  function startEdit(s) {
    setEditingId(s.id)
    setEditForm({ first_name:s.first_name||'', last_name:s.last_name||'', nickname:s.nickname||'', role:s.role||'Senior Barista', employment_type:s.employment_type||'Full-time', email:s.email||'', phone:s.phone||'', min_shifts_per_week:s.min_shifts_per_week||0 })
  }

  async function saveEdit(id) {
    setSaving(true)
    const { error } = await supabase.from('staff').update(editForm).eq('id', id)
    if (error) { showToast('❌', error.message); setSaving(false); return }
    setStaff(prev => prev.map(s => s.id===id ? {...s,...editForm} : s))
    setEditingId(null)
    showToast('✅', 'Staff profile updated')
    setSaving(false)
  }

  function cancelEdit() { setEditingId(null); setEditForm({}) }

  // ── DELETE ──
  async function deleteStaff(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) { showToast('❌', error.message); return }
    setStaff(prev => prev.filter(s => s.id !== id))
    showToast('🗑️', `${name} removed`)
  }

  // ── ADD STAFF ──
  async function addStaff() {
    if (!addForm.first_name || !addForm.last_name) { showToast('⚠️','First and last name required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('staff').insert([addForm]).select().single()
    if (error) { showToast('❌', error.message); setSaving(false); return }
    setStaff(prev => [...prev, data])
    setShowAdd(false)
    setAddForm(EMPTY)
    showToast('✅', `${addForm.first_name} ${addForm.last_name} added`)
    setSaving(false)
  }

  // ── ONBOARD (create Supabase Auth account) ──
  async function onboardStaff() {
    if (!showOnboard?.email) { showToast('⚠️','Staff must have an email address'); return }
    if (!onboardPass || onboardPass.length < 6) { showToast('⚠️','Password must be at least 6 characters'); return }
    setOnboarding(true)
    // Call Supabase Admin API via our edge function or service role
    // Since we can't use service role on client, we'll use signUp which creates the user
    const { error } = await supabase.auth.signUp({
      email: showOnboard.email,
      password: onboardPass,
      options: { emailRedirectTo: null }
    })
    if (error && !error.message.includes('already registered')) {
      showToast('❌', error.message); setOnboarding(false); return
    }
    showToast('✅', `Account created for ${showOnboard.first_name}! Share ${showOnboard.email} + password with them.`)
    setShowOnboard(null)
    setOnboardPass('')
    setOnboarding(false)
  }

  // ── CSV IMPORT ──
  function handleCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const lines = ev.target.result.split('\n').filter(l=>l.trim())
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'))
      const rows = []
      for (let i=1;i<lines.length;i++) {
        const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        const obj={}; headers.forEach((h,idx)=>{obj[h]=vals[idx]||''})
        if (!obj.first_name && !obj.last_name) continue
        rows.push({ first_name:obj.first_name||'', last_name:obj.last_name||'', nickname:obj.nickname||'', role:obj.role||'Senior Barista', employment_type:obj.employment_type||'Full-time', email:obj.email||'', phone:obj.phone||'' })
      }
      if (!rows.length) { showToast('⚠️','No valid rows found'); return }
      const { error } = await supabase.from('staff').insert(rows)
      if (error) { showToast('❌', error.message); return }
      await fetchStaff()
      showToast('✅', `${rows.length} staff imported`)
    }
    reader.readAsText(file); e.target.value=''
  }

  const filtered = staff.filter(s => `${s.first_name} ${s.last_name} ${s.nickname||''} ${s.role}`.toLowerCase().includes(search.toLowerCase()))
  const ef = k => e => setEditForm(p=>({...p,[k]:e.target.value}))
  const af = k => e => setAddForm(p=>({...p,[k]:e.target.value}))

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Staff Directory</div>
          <div className="topbar-sub">{staff.length} team members</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff…"
            style={{...iStyle,width:200,padding:'7px 12px'}}/>
          <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
            📂 Import CSV <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV}/>
          </label>
          <button className="btn btn-primary" onClick={()=>setShowAdd(!showAdd)}>+ Add Staff</button>
        </div>
      </div>

      <div className="page-content">
        {/* Add form */}
        {showAdd && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Add New Staff Member</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>First Name *</label><input style={iStyle} value={addForm.first_name} onChange={af('first_name')} placeholder="First name"/></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Last Name *</label><input style={iStyle} value={addForm.last_name} onChange={af('last_name')} placeholder="Last name"/></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Nickname</label><input style={iStyle} value={addForm.nickname} onChange={af('nickname')} placeholder="Nickname"/></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Email</label><input style={iStyle} value={addForm.email} onChange={af('email')} placeholder="email@example.com"/></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Role</label>
                <select style={iStyle} value={addForm.role} onChange={af('role')}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Type</label>
                <select style={iStyle} value={addForm.employment_type} onChange={af('employment_type')}>{EMP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:4}}>Phone</label><input style={iStyle} value={addForm.phone} onChange={af('phone')} placeholder="09xx"/></div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
                <label style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:6}}>Min. Shifts / Week</label>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div onClick={()=>setAddForm(p=>({...p,min_shifts_per_week:p.min_shifts_per_week===5?0:5}))}
                    style={{width:40,height:22,borderRadius:11,background:addForm.min_shifts_per_week===5?'var(--matcha)':'var(--border)',cursor:'pointer',transition:'background .2s',position:'relative',flexShrink:0}}>
                    <div style={{width:16,height:16,borderRadius:'50%',background:'white',position:'absolute',top:3,left:addForm.min_shifts_per_week===5?21:3,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                  </div>
                  <span style={{fontSize:11,color:addForm.min_shifts_per_week===5?'var(--matcha-dark)':'var(--text-muted)',fontWeight:600}}>
                    {addForm.min_shifts_per_week===5?'5 shifts required':'Not required'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:9}}>
              <button className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addStaff} disabled={saving}>{saving?'Adding…':'✓ Add Staff'}</button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading…</div> : (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'var(--espresso)'}}>
                  {['','Name','Role','Type','Email','Phone','Min Shifts','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 12px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s,i) => {
                  const isEditing = editingId === s.id
                  return (
                    <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                      {/* Avatar */}
                      <td style={{padding:'8px 12px',width:36}}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>
                          {initials(s.first_name,s.last_name)}
                        </div>
                      </td>

                      {/* Name */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <div style={{display:'flex',gap:5}}>
                            <input style={{...iStyle,width:90}} value={editForm.first_name} onChange={ef('first_name')} placeholder="First"/>
                            <input style={{...iStyle,width:90}} value={editForm.last_name} onChange={ef('last_name')} placeholder="Last"/>
                            <input style={{...iStyle,width:70}} value={editForm.nickname} onChange={ef('nickname')} placeholder="Nickname"/>
                          </div>
                        ) : (
                          <div>
                            <div style={{fontWeight:600}}>{s.first_name} {s.last_name}</div>
                            {s.nickname && <div style={{fontSize:10,color:'var(--text-muted)'}}>"{s.nickname}"</div>}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <select style={iStyle} value={editForm.role} onChange={ef('role')}>
                            {ROLES.map(r=><option key={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:getRoleColor(s.role)+'22',color:getRoleColor(s.role)}}>{s.role}</span>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <select style={iStyle} value={editForm.employment_type} onChange={ef('employment_type')}>
                            {EMP_TYPES.map(t=><option key={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>{s.employment_type||'Full-time'}</span>
                        )}
                      </td>

                      {/* Email */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <input style={iStyle} value={editForm.email} onChange={ef('email')} placeholder="email@example.com"/>
                        ) : (
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>{s.email||'—'}</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <input style={iStyle} value={editForm.phone} onChange={ef('phone')} placeholder="09xx"/>
                        ) : (
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>{s.phone||'—'}</span>
                        )}
                      </td>

                      {/* Min Shifts */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div onClick={()=>setEditForm(p=>({...p,min_shifts_per_week:p.min_shifts_per_week===5?0:5}))}
                              style={{width:36,height:20,borderRadius:10,background:editForm.min_shifts_per_week===5?'var(--matcha)':'var(--border)',cursor:'pointer',transition:'background .2s',position:'relative',flexShrink:0}}>
                              <div style={{width:14,height:14,borderRadius:'50%',background:'white',position:'absolute',top:3,left:editForm.min_shifts_per_week===5?19:3,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                            </div>
                            <span style={{fontSize:10,color:editForm.min_shifts_per_week===5?'var(--matcha-dark)':'var(--text-muted)',fontWeight:600,whiteSpace:'nowrap'}}>
                              {editForm.min_shifts_per_week===5?'5 req.':'Off'}
                            </span>
                          </div>
                        ) : (
                          s.min_shifts_per_week===5
                            ? <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:'var(--matcha-pale)',color:'var(--matcha-dark)'}}>5 / wk</span>
                            : <span style={{fontSize:10,color:'var(--border)'}}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{padding:'8px 12px'}}>
                        {isEditing ? (
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>saveEdit(s.id)} disabled={saving}
                              style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:6,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              {saving?'…':'Save'}
                            </button>
                            <button onClick={cancelEdit}
                              style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <button onClick={()=>startEdit(s)}
                              style={{background:'transparent',color:'var(--sky)',border:'1px solid #4a90c444',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              ✏️ Edit
                            </button>
                            <button onClick={()=>{setShowOnboard(s);setOnboardPass('')}}
                              style={{background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'1px solid #7ab64844',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              🔑 Onboard
                            </button>
                            <button onClick={()=>deleteStaff(s.id, `${s.first_name} ${s.last_name}`)}
                              style={{background:'transparent',color:'var(--border)',border:'none',fontSize:14,cursor:'pointer',padding:'4px'}}
                              onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>
                              🗑
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ONBOARD MODAL */}
      {showOnboard && (
        <div onClick={e=>e.target===e.currentTarget&&setShowOnboard(null)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:420,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4}}>🔑 Onboard Staff</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:20,lineHeight:1.6}}>
              Create a staff portal account for <strong>{showOnboard.first_name} {showOnboard.last_name}</strong>.<br/>
              They'll use <strong>{showOnboard.email||'(no email set)'}</strong> to log in.
            </div>
            {!showOnboard.email && (
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#a06000'}}>
                ⚠️ This staff member has no email. Edit their profile first to add one.
              </div>
            )}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',display:'block',marginBottom:6}}>Temporary Password</label>
              <input type="text" value={onboardPass} onChange={e=>setOnboardPass(e.target.value)}
                placeholder="Set a temporary password (min. 6 chars)"
                style={{...iStyle,fontSize:13,padding:'10px 12px'}}/>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5}}>Share this password with the staff member. They can change it later.</div>
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setShowOnboard(null)}
                style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
              <button onClick={onboardStaff} disabled={onboarding||!showOnboard.email}
                style={{flex:1,background:showOnboard.email?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:9,padding:10,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {onboarding?'Creating account…':'✓ Create Portal Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
