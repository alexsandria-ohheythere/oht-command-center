'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '—'

const PRIORITIES = [
  { id:'urgent', label:'Urgent', color:'#c0392b', bg:'#fdeaea' },
  { id:'high',   label:'High',   color:'#e8845a', bg:'#fef3ee' },
  { id:'normal', label:'Normal', color:'#4a90c4', bg:'#e8f0fb' },
  { id:'low',    label:'Low',    color:'#7a6a50', bg:'#f0ede8' },
]

const COLUMNS = [
  { id:'todo',       label:'To Do',       color:'#7a6a50', bg:'#f5f0e8' },
  { id:'inprogress', label:'In Progress', color:'#a06000', bg:'#fef3e2' },
  { id:'done',       label:'Done',        color:'#4a7a1e', bg:'#eef7e4' },
]

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}
const EMPTY_FORM = { title:'', description:'', priority:'normal', assigned_to:'', due_date:'', status:'todo' }

export default function TasksPage() {
  const supabase = createClient()
  const [tasks, setTasks]       = useState([])
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [dragTask, setDragTask] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [filterStaff, setFilterStaff]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [toast, setToast]       = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('tasks').select('*, staff(first_name,last_name,nickname,role)').order('created_at',{ascending:false}),
      supabase.from('staff').select('id,first_name,last_name,nickname,role').order('last_name'),
    ])
    setTasks(t || [])
    setStaff(s || [])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  async function saveTask() {
    if (!form.title.trim()) { showToast('⚠️','Title is required'); return }
    setSaving(true)
    const payload = { title:form.title, description:form.description, priority:form.priority, assigned_to:form.assigned_to||null, due_date:form.due_date||null, status:form.status }
    if (editTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editTask.id)
      if (error) { showToast('❌',error.message); setSaving(false); return }
      showToast('✅','Task updated')
    } else {
      const { error } = await supabase.from('tasks').insert([payload])
      if (error) { showToast('❌',error.message); setSaving(false); return }
      showToast('✅','Task created')
    }
    await fetchAll()
    setShowForm(false); setEditTask(null); setForm(EMPTY_FORM); setSaving(false)
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    showToast('🗑️','Task deleted')
  }

  async function moveTask(taskId, newStatus) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id===taskId ? {...t, status:newStatus} : t))
  }

  function openEdit(task) {
    setEditTask(task)
    setForm({ title:task.title, description:task.description||'', priority:task.priority||'normal', assigned_to:task.assigned_to||'', due_date:task.due_date||'', status:task.status||'todo' })
    setShowForm(true)
  }

  const filtered = tasks.filter(t => {
    if (filterStaff && t.assigned_to !== filterStaff) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const getColTasks = colId => filtered.filter(t => (t.status||'todo') === colId)
  const pri = id => PRIORITIES.find(p => p.id===id) || PRIORITIES[2]

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Task Board</div>
          <div className="topbar-sub">{tasks.length} tasks · {tasks.filter(t=>t.status==='done').length} done</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <select style={{...iStyle,width:'auto',padding:'6px 10px'}} value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}>
            <option value="">All Staff</option>
            {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <select style={{...iStyle,width:'auto',padding:'6px 10px'}} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditTask(null);setForm(EMPTY_FORM)}}>+ Add Task</button>
        </div>
      </div>

      <div className="page-content">
        {/* Modal */}
        {showForm && (
          <div onClick={e=>e.target===e.currentTarget&&(setShowForm(false),setEditTask(null))}
            style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:20}}>{editTask?'Edit Task':'+ New Task'}</div>
              <div style={{marginBottom:12}}>
                <label style={lStyle}>Title *</label>
                <input style={iStyle} placeholder="What needs to be done?" value={form.title} onChange={fv('title')}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lStyle}>Description</label>
                <textarea style={{...iStyle,resize:'vertical',minHeight:70,lineHeight:1.5}} placeholder="Additional details…" value={form.description} onChange={fv('description')}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={lStyle}>Assigned To</label>
                  <select style={iStyle} value={form.assigned_to} onChange={fv('assigned_to')}>
                    <option value="">Unassigned</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.nickname?` "${s.nickname}"`:''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Due Date</label>
                  <input style={iStyle} type="date" value={form.due_date} onChange={fv('due_date')}/>
                </div>
                <div>
                  <label style={lStyle}>Priority</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {PRIORITIES.map(p=>(
                      <div key={p.id} onClick={()=>setForm(prev=>({...prev,priority:p.id}))}
                        style={{padding:'6px 8px',borderRadius:7,border:`1.5px solid ${form.priority===p.id?p.color:'var(--border)'}`,background:form.priority===p.id?p.bg:'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:form.priority===p.id?p.color:'var(--text-muted)',transition:'all .15s'}}>
                        {p.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lStyle}>Status</label>
                  <select style={iStyle} value={form.status} onChange={fv('status')}>
                    {COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:9}}>
                <button onClick={()=>{setShowForm(false);setEditTask(null)}} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                <button onClick={saveTask} disabled={saving} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:10,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {saving?'Saving…':editTask?'✓ Update Task':'✓ Create Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban */}
        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading tasks…</div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,height:'calc(100vh - 130px)'}}>
            {COLUMNS.map(col => {
              const colTasks = getColTasks(col.id)
              return (
                <div key={col.id}
                  onDragOver={e=>{e.preventDefault();setDragOver(col.id)}}
                  onDragLeave={()=>setDragOver(null)}
                  onDrop={e=>{e.preventDefault();if(dragTask&&dragTask.status!==col.id)moveTask(dragTask.id,col.id);setDragTask(null);setDragOver(null)}}
                  style={{background:dragOver===col.id?col.bg:'var(--surface)',border:`2px dashed ${dragOver===col.id?col.color:'transparent'}`,borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden',transition:'all .2s'}}>
                  <div style={{padding:'14px 16px',background:col.bg,borderBottom:`1px solid ${col.color}22`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:col.color}}/>
                      <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:col.color}}>{col.label}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:col.color,background:'white',padding:'2px 8px',borderRadius:20}}>{colTasks.length}</span>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:'10px 10px 16px'}}>
                    {colTasks.length===0&&(
                      <div style={{textAlign:'center',padding:'30px 10px',color:'var(--border)',fontSize:12}}>Drop tasks here</div>
                    )}
                    {colTasks.map(task=>{
                      const p = pri(task.priority)
                      const assignee = task.staff
                      return (
                        <div key={task.id}
                          draggable
                          onDragStart={()=>setDragTask(task)}
                          onDragEnd={()=>setDragTask(null)}
                          style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 13px',marginBottom:8,cursor:'grab',transition:'all .15s',borderLeft:`3px solid ${p.color}`,opacity:dragTask?.id===task.id?.4:1}}
                          onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.08)';e.currentTarget.style.transform='translateY(-1px)'}}
                          onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform=''}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                            <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,background:p.bg,color:p.color}}>{p.label}</span>
                            <div style={{display:'flex',gap:5}}>
                              <button onClick={()=>openEdit(task)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12,padding:'2px 4px'}}>✏️</button>
                              <button onClick={()=>deleteTask(task.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12,padding:'2px 4px'}}>🗑</button>
                            </div>
                          </div>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--espresso)',marginBottom:4,lineHeight:1.4}}>{task.title}</div>
                          {task.description&&<div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{task.description}</div>}
                          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                            {assignee ? (
                              <div style={{display:'flex',alignItems:'center',gap:5,flex:1}}>
                                <div style={{width:20,height:20,borderRadius:'50%',background:getRoleColor(assignee.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>
                                  {initials(assignee.first_name,assignee.last_name)}
                                </div>
                                <span style={{fontSize:10,color:'var(--text-muted)',fontWeight:500}}>{assignee.nickname||assignee.first_name}</span>
                              </div>
                            ) : (
                              <span style={{fontSize:10,color:'var(--border)',flex:1}}>Unassigned</span>
                            )}
                            {task.due_date&&(
                              <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:new Date(task.due_date)<new Date()?'#c0392b':'var(--text-muted)',fontWeight:500}}>
                                📅 {fmtDate(task.due_date)}
                              </span>
                            )}
                          </div>
                          <div style={{display:'flex',gap:5,marginTop:8}}>
                            {COLUMNS.filter(c=>c.id!==col.id).map(c=>(
                              <button key={c.id} onClick={()=>moveTask(task.id,c.id)}
                                style={{flex:1,background:c.bg,border:`1px solid ${c.color}44`,color:c.color,borderRadius:6,padding:'4px 6px',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>
                                → {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
