'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const ROLES = [
  'Cafe Supervisor','Cafe Operations Support','Senior Barista',
  'Junior Barista - Milk Station','Junior Barista - Cashier',
  'Executive Chef','Sous Chef','Kitchen Staff',
]

const SHIFTS = [
  { id:'am',  label:'AM Shift',  time:'6:30AM–3:30PM',  color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'ops', label:'OPS Shift', time:'8:00AM–5:00PM',  color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5' },
  { id:'mid', label:'Mid Shift', time:'11:00AM–8:00PM', color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM Shift',  time:'3:00PM–11:00PM', color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }

export default function RolesPage() {
  const supabase = createClient()
  const [tasks, setTasks]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedRole, setSelectedRole] = useState(ROLES[0])
  const [selectedShift, setSelectedShift] = useState('am')
  const [newTask, setNewTask]           = useState('')
  const [newCategory, setNewCategory]   = useState('General')
  const [adding, setAdding]             = useState(false)
  const [editingId, setEditingId]       = useState(null)
  const [editText, setEditText]         = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [toast, setToast]               = useState(null)
  const [dragOver, setDragOver]         = useState(null)
  const [dragItem, setDragItem]         = useState(null)

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase.from('role_tasks').select('*').order('role').order('shift_type').order('category').order('task_order')
    setTasks(data || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3000) }

  const currentTasks = tasks.filter(t => t.role === selectedRole && t.shift_type === selectedShift && t.is_active)

  // Get unique categories for current shift/role
  const categories = [...new Set(currentTasks.map(t => t.category || 'General'))]

  async function addTask() {
    if (!newTask.trim()) return
    setAdding(true)
    const order = currentTasks.length
    const { data, error } = await supabase.from('role_tasks').insert([{
      role: selectedRole, shift_type: selectedShift,
      task_name: newTask.trim(), task_order: order, is_active: true,
      category: newCategory.trim() || 'General'
    }]).select().single()
    if (error) { showToast('❌', error.message); setAdding(false); return }
    setTasks(prev => [...prev, data])
    setNewTask('')
    setAdding(false)
    showToast('✅', 'Task added')
  }

  async function deleteTask(id) {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`
    await supabase.from('role_tasks').update({ is_active: false }).eq('id', id)
    await supabase.from('shift_task_assignments').delete().eq('task_id', id).eq('shift_date', today)
    setTasks(prev => prev.filter(t => t.id !== id))
    showToast('🗑️', 'Task removed')
  }

  async function saveEdit(id) {
    if (!editText.trim()) return
    await supabase.from('role_tasks').update({ task_name: editText.trim(), category: editCategory.trim() || 'General' }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? {...t, task_name: editText.trim(), category: editCategory.trim() || 'General'} : t))
    setEditingId(null)
    showToast('✅', 'Task updated')
  }

  async function reorderTasks(fromId, toId) {
    const list = [...currentTasks]
    const fromIdx = list.findIndex(t => t.id === fromId)
    const toIdx   = list.findIndex(t => t.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...list]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = tasks.map(t => {
      const idx = reordered.findIndex(r => r.id === t.id)
      return idx !== -1 ? {...t, task_order: idx} : t
    })
    setTasks(updated)
    await Promise.all(reordered.map((t, i) => supabase.from('role_tasks').update({ task_order: i }).eq('id', t.id)))
  }

  async function copyFromShift(fromShift) {
    const source = tasks.filter(t => t.role === selectedRole && t.shift_type === fromShift && t.is_active)
    if (!source.length) { showToast('⚠️', 'No tasks in that shift to copy'); return }
    const inserts = source.map((t, i) => ({ role: selectedRole, shift_type: selectedShift, task_name: t.task_name, category: t.category || 'General', task_order: currentTasks.length + i, is_active: true }))
    const { data } = await supabase.from('role_tasks').insert(inserts).select()
    setTasks(prev => [...prev, ...(data||[])])
    showToast('📋', `${source.length} tasks copied`)
  }

  function getTaskCount(role) {
    return tasks.filter(t => t.role === role && t.is_active).length
  }

  const shift = SHIFTS.find(s => s.id === selectedShift)

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Role Task Templates</div>
          <div className="topbar-sub">Define what each role does per shift · {tasks.filter(t=>t.is_active).length} total tasks</div>
        </div>
      </div>

      <div style={{display:'flex',height:'calc(100vh - 56px)',overflow:'hidden'}}>

        {/* ROLE SIDEBAR */}
        <div style={{width:220,flexShrink:0,background:'var(--white)',borderRight:'1px solid var(--border)',overflowY:'auto'}}>
          <div style={{padding:'12px 14px 6px',fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'var(--text-muted)'}}>Roles</div>
          {ROLES.map(role => {
            const count = getTaskCount(role)
            const active = selectedRole === role
            return (
              <div key={role} onClick={() => setSelectedRole(role)}
                style={{padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderLeft:`3px solid ${active?ROLE_COLORS[role]:'transparent'}`,background:active?ROLE_COLORS[role]+'11':'transparent',transition:'all .15s'}}
                onMouseEnter={e=>!active&&(e.currentTarget.style.background='var(--surface)')}
                onMouseLeave={e=>!active&&(e.currentTarget.style.background='transparent')}>
                <div style={{width:8,height:8,borderRadius:'50%',background:ROLE_COLORS[role],flexShrink:0}}></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:active?700:500,color:active?'var(--espresso)':'var(--text-muted)'}}>{role}</div>
                </div>
                {count > 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text-muted)',background:'var(--surface)',padding:'1px 6px',borderRadius:6}}>{count}</div>}
              </div>
            )
          })}
        </div>

        {/* TASK PANEL */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:ROLE_COLORS[selectedRole]}}></div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:'var(--espresso)'}}>{selectedRole}</div>
          </div>

          {/* Shift tabs */}
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            {SHIFTS.map(sh => (
              <button key={sh.id} onClick={() => setSelectedShift(sh.id)}
                style={{padding:'8px 16px',borderRadius:9,border:`1.5px solid ${selectedShift===sh.id?sh.border:'var(--border)'}`,background:selectedShift===sh.id?sh.bg:'var(--white)',color:selectedShift===sh.id?sh.color:'var(--text-muted)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                {sh.label}
                <span style={{fontSize:10,marginLeft:6,opacity:.7}}>{tasks.filter(t=>t.role===selectedRole&&t.shift_type===sh.id&&t.is_active).length}</span>
              </button>
            ))}
          </div>

          {/* Copy from another shift */}
          {currentTasks.length === 0 && (
            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:13}}>💡</span>
              <span style={{fontSize:12,color:'#a06000'}}>No tasks yet for this shift. Copy from another shift?</span>
              <div style={{marginLeft:'auto',display:'flex',gap:7}}>
                {SHIFTS.filter(s=>s.id!==selectedShift).map(s=>(
                  <button key={s.id} onClick={()=>copyFromShift(s.id)}
                    style={{background:s.bg,border:`1px solid ${s.border}`,color:s.color,borderRadius:7,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                    Copy {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Task list grouped by category */}
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',marginBottom:14}}>
            <div style={{background:shift.bg,padding:'12px 16px',borderBottom:`1px solid ${shift.border}33`,display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:700,color:shift.color}}>{shift.label} Tasks</span>
              <span style={{fontSize:11,color:shift.color,opacity:.7}}>· {shift.time}</span>
              <span style={{marginLeft:'auto',fontSize:10,color:shift.color,opacity:.7,fontFamily:"'DM Mono',monospace"}}>{currentTasks.length} task{currentTasks.length!==1?'s':''}</span>
            </div>

            {loading ? (
              <div style={{padding:'30px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
            ) : currentTasks.length === 0 ? (
              <div style={{padding:'30px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>No tasks yet — add one below</div>
            ) : (
              <div>
                {categories.map(cat => {
                  const catTasks = currentTasks.filter(t => (t.category || 'General') === cat)
                  return (
                    <div key={cat}>
                      {/* Category header */}
                      <div style={{padding:'8px 16px',background:'var(--surface)',borderBottom:'1px solid var(--cream-dark)',display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:3,height:14,borderRadius:2,background:shift.border}}></div>
                        <span style={{fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:shift.color}}>{cat}</span>
                        <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:4}}>{catTasks.length} task{catTasks.length!==1?'s':''}</span>
                      </div>
                      {catTasks.map((task, idx) => (
                        <div key={task.id}
                          draggable
                          onDragStart={() => setDragItem(task.id)}
                          onDragOver={e => { e.preventDefault(); setDragOver(task.id) }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={() => { reorderTasks(dragItem, task.id); setDragOver(null); setDragItem(null) }}
                          style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:'1px solid var(--cream-dark)',background:dragOver===task.id?shift.bg:'var(--white)',cursor:'grab',transition:'background .1s'}}>
                          <span style={{color:'var(--border)',fontSize:14,cursor:'grab'}}>⠿</span>
                          <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${shift.border}`,background:shift.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:shift.color,flexShrink:0}}>{idx+1}</div>
                          {editingId === task.id ? (
                            <div style={{flex:1,display:'flex',gap:8,flexDirection:'column'}}>
                              <input autoFocus value={editText} onChange={e=>setEditText(e.target.value)}
                                onKeyDown={e=>{ if(e.key==='Enter') saveEdit(task.id); if(e.key==='Escape') setEditingId(null) }}
                                style={{...iStyle,padding:'5px 9px'}} placeholder="Task name"/>
                              <input value={editCategory} onChange={e=>setEditCategory(e.target.value)}
                                style={{...iStyle,padding:'5px 9px'}} placeholder="Category (e.g. Opening, Cleaning)"/>
                            </div>
                          ) : (
                            <span style={{flex:1,fontSize:12,color:'var(--espresso)',fontWeight:500}}>{task.task_name}</span>
                          )}
                          <div style={{display:'flex',gap:6,flexShrink:0}}>
                            {editingId===task.id ? (
                              <>
                                <button onClick={()=>saveEdit(task.id)} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Save</button>
                                <button onClick={()=>setEditingId(null)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={()=>{setEditingId(task.id);setEditText(task.task_name);setEditCategory(task.category||'General')}} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>✏️</button>
                                <button onClick={()=>deleteTask(task.id)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>🗑</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add task input */}
            <div style={{padding:'12px 16px',background:'var(--surface)',display:'flex',gap:9,alignItems:'center'}}>
              <div style={{flex:1,display:'flex',gap:8}}>
                <input
                  style={{...iStyle,flex:'0 0 160px'}}
                  placeholder="Category (e.g. Opening)"
                  value={newCategory}
                  onChange={e=>setNewCategory(e.target.value)}
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {categories.map(c=><option key={c} value={c}/>)}
                </datalist>
                <input
                  style={{...iStyle,flex:1}}
                  placeholder={`Task name…`}
                  value={newTask}
                  onChange={e=>setNewTask(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addTask()}
                />
              </div>
              <button onClick={addTask} disabled={adding||!newTask.trim()}
                style={{background:newTask.trim()?'var(--matcha)':'var(--border)',color:'white',border:'none',borderRadius:8,padding:'9px 16px',fontSize:12,fontWeight:700,cursor:newTask.trim()?'pointer':'default',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',transition:'all .15s'}}>
                {adding?'Adding…':'+ Add Task'}
              </button>
            </div>
          </div>

          {/* Quick overview across all shifts */}
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 18px'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12,color:'var(--espresso)'}}>
              All Shifts Overview — {selectedRole}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {SHIFTS.map(sh => {
                const shiftTasks = tasks.filter(t=>t.role===selectedRole&&t.shift_type===sh.id&&t.is_active)
                const shiftCats = [...new Set(shiftTasks.map(t=>t.category||'General'))]
                return (
                  <div key={sh.id} style={{background:sh.bg,border:`1px solid ${sh.border}44`,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:sh.color,marginBottom:8}}>{sh.label} <span style={{opacity:.7}}>· {sh.time}</span></div>
                    {shiftTasks.length===0 ? (
                      <div style={{fontSize:11,color:sh.color,opacity:.5,fontStyle:'italic'}}>No tasks yet</div>
                    ) : shiftCats.map(cat => (
                      <div key={cat} style={{marginBottom:8}}>
                        <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:sh.color,opacity:.7,marginBottom:3}}>{cat}</div>
                        {shiftTasks.filter(t=>(t.category||'General')===cat).map((t,i)=>(
                          <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:6,padding:'2px 0',fontSize:11,color:'var(--espresso)'}}>
                            <span style={{color:sh.color,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                            <span>{t.task_name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
