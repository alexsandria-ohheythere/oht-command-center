'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

// Read ?staff=id from URL to pre-filter to a specific employee
function getStaffParam() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('staff') || ''
}

const CATEGORIES = ['All','Contract','NDA','Government Forms','Performance Reviews','Training Materials','Incident Report','General']
const CAT_COLORS = {'Contract':'#4a7a1e','NDA':'#c0392b','Government Forms':'#2d5a8a','Performance Reviews':'#8e44ad','Training Materials':'#a06000','General':'#7a6a50','Incident Report':'#c0392b'}
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const fmtSize = b => b ? (b>1024*1024?`${(b/1024/1024).toFixed(1)}MB`:`${(b/1024).toFixed(0)}KB`) : '—'
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

// Files/Document 201 is Alex + CJ only — HR does not get access, per role rules.
// AuthShell's own `require` prop exists but isn't actually wired up to anything,
// so this page checks the signed-in email directly, the same way Incident Reports does.
const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']

export default function FilesPage() {
  const supabase = createClient()
  const [files, setFiles]       = useState([])
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [catFilter, setCatFilter] = useState('All')
  const [staffFilter, setStaffFilter] = useState(getStaffParam)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [toast, setToast]       = useState(null)
  const [form, setForm] = useState({ staff_id:'', file_name:'', file_url:'', category:'General', description:'', can_download:true, can_upload:false })
  const [userEmail, setUserEmail] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email?.toLowerCase() || null)
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:f, error:fErr },{ data:s, error:sErr }] = await Promise.all([
      supabase.from('staff_files').select('*, staff(first_name,last_name,nickname,role)').order('created_at',{ascending:false}),
      supabase.from('staff').select('*').order('last_name'),
    ])
    if (fErr) { console.error('staff_files fetch error:', fErr.message); showToast('❌', `Files failed to load: ${fErr.message}`) }
    if (sErr) console.error('staff fetch error:', sErr.message)
    setFiles(f||[]); setStaff(s||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:typeof e==='boolean'?e:e.target.value}))

  async function uploadFile(e) {
    const file = e.target.files[0]; if(!file) return
    setSaving(true)
    // Upload to Supabase Storage
    const path = `${form.staff_id||'general'}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage.from('staff-files').upload(path, file)
    if (uploadError) { showToast('❌',uploadError.message); setSaving(false); return }
    const { data: { publicUrl } } = supabase.storage.from('staff-files').getPublicUrl(path)
    setForm(p=>({...p, file_name:file.name, file_url:publicUrl, file_size:file.size, file_type:file.type, storage_path:path}))
    showToast('✅','File uploaded — fill in details and save')
    setSaving(false)
    e.target.value=''
  }

  async function saveFile() {
    if (!form.file_url||!form.file_name) { showToast('⚠️','Upload a file first'); return }
    if (!form.staff_id) { showToast('⚠️','Select an employee'); return }
    setSaving(true)
    const { error } = await supabase.from('staff_files').insert([{...form, uploaded_by:'alex'}])
    if (error) { showToast('❌',error.message); setSaving(false); return }
    // Notify staff
    await notifyOne(form.staff_id, {
      type:'general',
      title:'📁 New File Added to Your 201',
      message:`A new file "${form.file_name}" has been added to your ${form.category} folder.`,
    })
    await fetchAll()
    setShowForm(false)
    setForm({staff_id:'',file_name:'',file_url:'',category:'General',description:'',can_download:true,can_upload:false})
    showToast('✅','File saved & employee notified')
    setSaving(false)
  }

  async function deleteFile(id, path) {
    if (!confirm('Delete this file?')) return
    if (path) await supabase.storage.from('staff-files').remove([path])
    await supabase.from('staff_files').delete().eq('id',id)
    setFiles(prev=>prev.filter(f=>f.id!==id))
    showToast('🗑️','File deleted')
  }

  const isAdmin = ADMIN_EMAILS.includes(userEmail)

  // HR sees everything in Document 201 EXCEPT the Incident Report category —
  // that stays Alex/CJ-only, matching how it's restricted everywhere else.
  const visibleFiles = isAdmin ? files : files.filter(f => f.category !== 'Incident Report')
  const visibleCategories = isAdmin ? CATEGORIES : CATEGORIES.filter(c => c !== 'Incident Report')

  const filtered = visibleFiles.filter(f => {
    if (catFilter!=='All' && f.category!==catFilter) return false
    if (staffFilter && f.staff_id!==staffFilter) return false
    if (search && !`${f.file_name} ${f.description||''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by staff
  const byStaff = {}
  filtered.forEach(f => {
    const id = f.staff_id||'unassigned'
    if (!byStaff[id]) byStaff[id] = { staff:f.staff, files:[] }
    byStaff[id].files.push(f)
  })

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Files · Document 201</div><div className="topbar-sub">{visibleFiles.length} files · {staff.length} employees</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" style={{...iStyle,width:200,padding:'6px 12px'}}/>
          <select style={{...iStyle,width:'auto'}} value={staffFilter} onChange={e=>setStaffFilter(e.target.value)}>
            <option value="">All Employees</option>
            {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ Upload File</button>
        </div>
      </div>

      <div className="page-content">
        {/* Upload form */}
        {showForm&&(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>Upload File to Employee 201</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
              <div>
                <label style={lStyle}>Employee *</label>
                <select style={iStyle} value={form.staff_id} onChange={fv('staff_id')}>
                  <option value="">Select employee…</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Category</label>
                <select style={iStyle} value={form.category} onChange={fv('category')}>
                  {visibleCategories.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Description</label>
                <input style={iStyle} placeholder="Brief description" value={form.description} onChange={fv('description')}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={lStyle}>File</label>
              {form.file_url?(
                <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--matcha-dark)'}}>✅ {form.file_name}</span>
                  <button onClick={()=>setForm(p=>({...p,file_url:'',file_name:'',storage_path:''}))} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12}}>Remove</button>
                </div>
              ):(
                <label style={{display:'flex',alignItems:'center',gap:8,background:'var(--sky-pale)',border:'2px dashed var(--sky)',borderRadius:9,padding:'16px',cursor:'pointer',justifyContent:'center'}}>
                  <span style={{fontSize:13,color:'var(--sky)',fontWeight:600}}>📁 Click to upload file</span>
                  <input type="file" ref={fileRef} style={{display:'none'}} onChange={uploadFile} disabled={saving}/>
                </label>
              )}
            </div>
            <div style={{display:'flex',gap:12,marginBottom:12}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12}}>
                <input type="checkbox" checked={form.can_download} onChange={e=>setForm(p=>({...p,can_download:e.target.checked}))}/> Employee can download
              </label>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12}}>
                <input type="checkbox" checked={form.can_upload} onChange={e=>setForm(p=>({...p,can_upload:e.target.checked}))}/> Employee can upload files
              </label>
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setShowForm(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'9px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={saveFile} disabled={saving} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:9,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving?'Saving…':'✓ Save File'}
              </button>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          {visibleCategories.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)}
              style={{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${catFilter===c?(CAT_COLORS[c]||'var(--espresso)'):'var(--border)'}`,background:catFilter===c?(CAT_COLORS[c]||'var(--espresso)')+'22':'transparent',color:catFilter===c?(CAT_COLORS[c]||'var(--espresso)'):'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
              {c} {c!=='All'?`(${visibleFiles.filter(f=>f.category===c).length})`:``}
            </button>
          ))}
        </div>

        {/* Files grouped by employee */}
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:Object.keys(byStaff).length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>📁</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No files yet</div>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Upload First File</button>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {Object.entries(byStaff).map(([staffId,{staff:s,files:sFiles}])=>(
              <div key={staffId} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                <div style={{background:'var(--espresso)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                  {s&&<div style={{width:32,height:32,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>}
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--cream)'}}>{s?`${s.first_name} ${s.last_name}`:'Unassigned'}</div>
                    {s&&<div style={{fontSize:10,color:'rgba(255,255,255,.5)'}}>{s.role} · {sFiles.length} file{sFiles.length!==1?'s':''}</div>}
                  </div>
                </div>
                <div style={{padding:'12px 16px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
                    {sFiles.map(f=>{
                      const color = CAT_COLORS[f.category]||'#7a6a50'
                      const isPDF = f.file_type?.includes('pdf')||f.file_name?.endsWith('.pdf')
                      const isImg = f.file_type?.includes('image')
                      return(
                        <div key={f.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px',borderLeft:`3px solid ${color}`}}>
                          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                            <div style={{fontSize:20}}>{isPDF?'📄':isImg?'🖼️':'📁'}</div>
                            <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:5,background:color+'22',color}}>{f.category}</span>
                          </div>
                          <div style={{fontSize:12,fontWeight:600,color:'var(--espresso)',marginBottom:2,wordBreak:'break-word'}}>{f.file_name}</div>
                          {f.description&&<div style={{fontSize:10,color:'var(--text-muted)',marginBottom:6,lineHeight:1.4}}>{f.description}</div>}
                          <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:8,fontFamily:"'DM Mono',monospace"}}>{fmtDate(f.created_at)}</div>
                          <div style={{display:'flex',gap:5}}>
                            <a href={f.file_url} target="_blank" rel="noreferrer"
                              style={{flex:1,background:'var(--sky-pale)',color:'var(--sky)',border:'none',borderRadius:6,padding:'5px 8px',fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center',display:'block'}}>
                              👁 Preview
                            </a>
                            <a href={f.file_url} download={f.file_name}
                              style={{flex:1,background:'var(--matcha-pale)',color:'var(--matcha-dark)',border:'none',borderRadius:6,padding:'5px 8px',fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center',display:'block'}}>
                              ↓ Download
                            </a>
                            <button onClick={()=>deleteFile(f.id,f.storage_path)}
                              style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-muted)',borderRadius:6,padding:'5px 7px',fontSize:11,cursor:'pointer'}}
                              onMouseEnter={e=>e.currentTarget.style.color='#c0392b'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
                              🗑
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
