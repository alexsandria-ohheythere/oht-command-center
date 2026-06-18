'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { getUserRole } from '../../lib/auth'
import { notifyOne } from '../../lib/notify'

const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '—'
const fmtTime = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

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

export default function JobOrderPage() {
  const supabase = createClient()
  const [tasks, setTasks]         = useState([])
  const [staff, setStaff]         = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [dragTask, setDragTask]   = useState(null)
  const [dragOver, setDragOver]   = useState(null)
  const [filterStaff, setFilterStaff]       = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState(null)

  // Drawer state
  const [drawerTask, setDrawerTask]       = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [checklist, setChecklist]         = useState([])
  const [comments, setComments]           = useState([])
  const [activity, setActivity]           = useState([])
  const [newItem, setNewItem]             = useState('')
  const [newComment, setNewComment]       = useState('')
  const [drawerForm, setDrawerForm]       = useState(null)
  const [savingDrawer, setSavingDrawer]   = useState(false)
  const commentsEndRef = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: t }, { data: s }, userRole] = await Promise.all([
      supabase.from('tasks').select('*, staff(first_name,last_name,nickname,role)').order('created_at',{ascending:false}),
      supabase.from('staff').select('id,first_name,last_name,nickname,role').order('last_name'),
      getUserRole(supabase),
    ])
    // Attach checklist counts
    const taskIds = (t||[]).map(x=>x.id)
    let checkCounts = {}, commentCounts = {}
    if (taskIds.length) {
      const { data: cl } = await supabase.from('task_checklist').select('task_id, done').in('task_id', taskIds)
      const { data: cm } = await supabase.from('task_comments').select('task_id').in('task_id', taskIds)
      ;(cl||[]).forEach(r => {
        if (!checkCounts[r.task_id]) checkCounts[r.task_id] = { total:0, done:0 }
        checkCounts[r.task_id].total++
        if (r.done) checkCounts[r.task_id].done++
      })
      ;(cm||[]).forEach(r => { commentCounts[r.task_id] = (commentCounts[r.task_id]||0)+1 })
    }
    const enriched = (t||[]).map(task => ({
      ...task,
      _checkTotal: checkCounts[task.id]?.total || 0,
      _checkDone:  checkCounts[task.id]?.done  || 0,
      _commentCount: commentCounts[task.id] || 0,
    }))
    setTasks(enriched)
    setStaff(s||[])
    if (userRole?.staff_id) {
      const { data: me } = await supabase.from('staff').select('id,first_name,last_name,nickname,role').eq('id', userRole.staff_id).single()
      setCurrentUser(me)
    }
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  // ── New task form ──────────────────────────────────────────
  async function saveTask() {
    if (!form.title.trim()) { showToast('⚠️','Title is required'); return }
    setSaving(true)
    const payload = { title:form.title, description:form.description, priority:form.priority, assigned_to:form.assigned_to||null, due_date:form.due_date||null, status:form.status }
    const { data: inserted, error } = await supabase.from('tasks').insert([payload]).select().single()
    if (error) { showToast('❌',error.message); setSaving(false); return }
    if (payload.assigned_to && inserted) {
      await notifyOne(payload.assigned_to, { type:'general', title:'📋 New Job Order: '+(inserted.ticket_no||''), message:`"${inserted.title}" has been assigned to you.` })
    }
    if (inserted) {
      await supabase.from('task_activity').insert([{ task_id:inserted.id, actor_id:currentUser?.id||null, action:'Created this job order' }])
    }
    await fetchAll()
    setShowForm(false); setForm(EMPTY_FORM); setSaving(false)
    showToast('✅','Job order created')
  }

  async function deleteTask(id) {
    if (!confirm('Delete this job order?')) return
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev=>prev.filter(t=>t.id!==id))
    if (drawerTask?.id === id) setDrawerTask(null)
    showToast('🗑️','Deleted')
  }

  async function moveTask(taskId, newStatus) {
    const col = COLUMNS.find(c=>c.id===newStatus)
    await supabase.from('tasks').update({ status:newStatus }).eq('id', taskId)
    await supabase.from('task_activity').insert([{ task_id:taskId, actor_id:currentUser?.id||null, action:`Moved to ${col?.label||newStatus}` }])
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status:newStatus}:t))
    if (drawerTask?.id===taskId) {
      setDrawerTask(prev=>({...prev,status:newStatus}))
      setDrawerForm(prev=>({...prev,status:newStatus}))
      setActivity(prev=>[...prev,{id:'tmp'+Date.now(),action:`Moved to ${col?.label||newStatus}`,created_at:new Date().toISOString(),staff:currentUser}])
    }
  }

  // ── Drawer ─────────────────────────────────────────────────
  async function openDrawer(task) {
    setDrawerTask(task)
    setDrawerForm({ title:task.title, description:task.description||'', priority:task.priority||'normal', assigned_to:task.assigned_to||'', due_date:task.due_date||'', status:task.status||'todo' })
    setDrawerLoading(true)
    const [{ data: cl }, { data: cm }, { data: ac }] = await Promise.all([
      supabase.from('task_checklist').select('*').eq('task_id', task.id).order('created_at'),
      supabase.from('task_comments').select('*, staff(first_name,last_name,nickname,role)').eq('task_id', task.id).order('created_at'),
      supabase.from('task_activity').select('*, staff(first_name,last_name,nickname)').eq('task_id', task.id).order('created_at'),
    ])
    setChecklist(cl||[])
    setComments(cm||[])
    setActivity(ac||[])
    setDrawerLoading(false)
  }

  function closeDrawer() { setDrawerTask(null); setDrawerForm(null); setChecklist([]); setComments([]); setActivity([]) }

  async function saveDrawerTask() {
    if (!drawerForm.title.trim()) { showToast('⚠️','Title is required'); return }
    setSavingDrawer(true)
    const payload = { title:drawerForm.title, description:drawerForm.description, priority:drawerForm.priority, assigned_to:drawerForm.assigned_to||null, due_date:drawerForm.due_date||null, status:drawerForm.status }
    const { error } = await supabase.from('tasks').update(payload).eq('id', drawerTask.id)
    if (error) { showToast('❌',error.message); setSavingDrawer(false); return }
    // Notify if assignee changed
    if (payload.assigned_to && payload.assigned_to !== drawerTask.assigned_to) {
      await notifyOne(payload.assigned_to, { type:'general', title:'📋 Job Order Assigned', message:`You have been assigned to ${drawerTask.ticket_no||'a job order'}: "${drawerForm.title}"` })
      await supabase.from('task_activity').insert([{ task_id:drawerTask.id, actor_id:currentUser?.id||null, action:'Updated assignee' }])
    }
    await supabase.from('task_activity').insert([{ task_id:drawerTask.id, actor_id:currentUser?.id||null, action:'Updated job order details' }])
    const newAssigneeStaff = staff.find(s=>s.id===payload.assigned_to)
    setDrawerTask(prev=>({...prev,...payload,staff:newAssigneeStaff||prev.staff}))
    setTasks(prev=>prev.map(t=>t.id===drawerTask.id?{...t,...payload,staff:newAssigneeStaff||t.staff}:t))
    setSavingDrawer(false)
    showToast('✅','Updated')
    // Refresh activity
    const { data: ac } = await supabase.from('task_activity').select('*, staff(first_name,last_name,nickname)').eq('task_id', drawerTask.id).order('created_at')
    setActivity(ac||[])
  }

  // ── Checklist ──────────────────────────────────────────────
  async function addCheckItem() {
    if (!newItem.trim()) return
    const { data, error } = await supabase.from('task_checklist').insert([{ task_id:drawerTask.id, label:newItem.trim(), done:false }]).select().single()
    if (error) { showToast('❌',error.message); return }
    setChecklist(prev=>[...prev, data])
    setNewItem('')
    setTasks(prev=>prev.map(t=>t.id===drawerTask.id?{...t,_checkTotal:t._checkTotal+1}:t))
  }

  async function toggleCheckItem(item) {
    const { error } = await supabase.from('task_checklist').update({ done:!item.done }).eq('id', item.id)
    if (error) return
    setChecklist(prev=>prev.map(c=>c.id===item.id?{...c,done:!c.done}:c))
    setTasks(prev=>prev.map(t=>t.id===drawerTask.id?{...t,_checkDone:t._checkDone+(!item.done?1:-1)}:t))
  }

  async function deleteCheckItem(id) {
    const item = checklist.find(c=>c.id===id)
    await supabase.from('task_checklist').delete().eq('id', id)
    setChecklist(prev=>prev.filter(c=>c.id!==id))
    setTasks(prev=>prev.map(t=>t.id===drawerTask.id?{...t,_checkTotal:t._checkTotal-1,_checkDone:t._checkDone-(item?.done?1:0)}:t))
  }

  // ── Comments ───────────────────────────────────────────────
  async function addComment() {
    if (!newComment.trim()) return
    const { data, error } = await supabase.from('task_comments').insert([{ task_id:drawerTask.id, author_id:currentUser?.id||null, body:newComment.trim() }]).select('*, staff(first_name,last_name,nickname,role)').single()
    if (error) { showToast('❌',error.message); return }
    // staff join comes from author_id FK — alias may differ; attach manually
    const withAuthor = { ...data, staff: currentUser }
    setComments(prev=>[...prev, withAuthor])
    setNewComment('')
    setTasks(prev=>prev.map(t=>t.id===drawerTask.id?{...t,_commentCount:t._commentCount+1}:t))
    setTimeout(()=>commentsEndRef.current?.scrollIntoView({behavior:'smooth'}),100)
  }

  const filtered = tasks.filter(t => {
    if (filterStaff && t.assigned_to !== filterStaff) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (search && !`${t.ticket_no} ${t.title} ${t.description||''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const getColTasks = colId => filtered.filter(t=>(t.status||'todo')===colId)
  const pri = id => PRIORITIES.find(p=>p.id===id)||PRIORITIES[2]

  // ── Checklist progress ─────────────────────────────────────
  const checkPct = (done, total) => total ? Math.round((done/total)*100) : 0

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Job Orders</div>
          <div className="topbar-sub">{tasks.length} orders · {tasks.filter(t=>t.status==='done').length} completed</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ticket or title…"
            style={{...iStyle,width:220,padding:'6px 12px'}}/>
          <select style={{...iStyle,width:'auto',padding:'6px 10px'}} value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}>
            <option value="">All Staff</option>
            {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <select style={{...iStyle,width:'auto',padding:'6px 10px'}} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={()=>{setShowForm(true);setForm(EMPTY_FORM)}}>+ New Job Order</button>
        </div>
      </div>

      <div className="page-content">

        {/* ── New Job Order Modal ── */}
        {showForm && (
          <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)}
            style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:20}}>+ New Job Order</div>
              <div style={{marginBottom:12}}>
                <label style={lStyle}>Title *</label>
                <input style={iStyle} placeholder="What needs to be done?" value={form.title} onChange={fv('title')}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lStyle}>Description</label>
                <textarea style={{...iStyle,resize:'vertical',minHeight:70,lineHeight:1.5}} placeholder="Additional details…" value={form.description} onChange={fv('description')}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <label style={lStyle}>Assigned To</label>
                  <select style={iStyle} value={form.assigned_to} onChange={fv('assigned_to')}>
                    <option value="">Unassigned</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.nickname?' "'+s.nickname+'"':''}</option>)}
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
                <button onClick={()=>setShowForm(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 16px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                <button onClick={saveTask} disabled={saving} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:10,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {saving?'Saving…':'✓ Create Job Order'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Kanban Board ── */}
        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading…</div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,height:'calc(100vh - 130px)'}}>
            {COLUMNS.map(col=>{
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
                    {colTasks.length===0&&<div style={{textAlign:'center',padding:'30px 10px',color:'var(--border)',fontSize:12}}>Drop here</div>}
                    {colTasks.map(task=>{
                      const p = pri(task.priority)
                      const assignee = task.staff
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                      const pct = checkPct(task._checkDone, task._checkTotal)
                      return (
                        <div key={task.id} draggable
                          onDragStart={()=>setDragTask(task)}
                          onDragEnd={()=>setDragTask(null)}
                          onClick={()=>openDrawer(task)}
                          style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:10,marginBottom:8,cursor:'pointer',borderLeft:`5px solid ${p.color}`,opacity:dragTask?.id===task.id?0.4:1,transition:'all .15s',overflow:'hidden'}}
                          onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.10)';e.currentTarget.style.transform='translateY(-1px)'}}
                          onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform=''}}>

                          <div style={{padding:'12px 13px 10px 14px'}}>
                            {/* Ticket + priority + actions */}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                {task.ticket_no && (
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:'var(--espresso)',background:'var(--cream-dark)',padding:'2px 7px',borderRadius:6}}>
                                    {task.ticket_no}
                                  </span>
                                )}
                                <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,background:p.bg,color:p.color}}>{p.label}</span>
                              </div>
                              <button
                                onClick={e=>{e.stopPropagation();deleteTask(task.id)}}
                                style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:11,padding:'2px 4px'}}>🗑</button>
                            </div>

                            <div style={{fontSize:13,fontWeight:600,color:'var(--espresso)',marginBottom:4,lineHeight:1.4}}>{task.title}</div>
                            {task.description&&<div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',wordBreak:'break-all',overflowWrap:'anywhere'}}>{task.description}</div>}

                            {/* Checklist progress bar */}
                            {task._checkTotal > 0 && (
                              <div style={{marginBottom:8}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                                  <span style={{fontSize:9,color:'var(--text-muted)',fontWeight:600}}>☑ {task._checkDone}/{task._checkTotal}</span>
                                  <span style={{fontSize:9,color:'var(--text-muted)'}}>{pct}%</span>
                                </div>
                                <div style={{height:4,borderRadius:4,background:'var(--border)',overflow:'hidden'}}>
                                  <div style={{height:'100%',width:`${pct}%`,background:pct===100?'#4a7a1e':'var(--matcha)',borderRadius:4,transition:'width .3s'}}/>
                                </div>
                              </div>
                            )}

                            {/* Assignee + meta chips */}
                            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              {assignee?(
                                <div style={{display:'flex',alignItems:'center',gap:5,flex:1}}>
                                  <div style={{width:20,height:20,borderRadius:'50%',background:getRoleColor(assignee.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>{initials(assignee.first_name,assignee.last_name)}</div>
                                  <span style={{fontSize:10,color:'var(--text-muted)',fontWeight:500}}>{assignee.nickname||assignee.first_name}</span>
                                </div>
                              ):<span style={{fontSize:10,color:'var(--border)',flex:1}}>Unassigned</span>}
                              <div style={{display:'flex',alignItems:'center',gap:5}}>
                                {task._commentCount>0&&<span style={{fontSize:9,color:'var(--text-muted)',background:'var(--surface)',border:'1px solid var(--border)',padding:'1px 6px',borderRadius:20}}>💬 {task._commentCount}</span>}
                                {task.due_date&&<span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:isOverdue?'#c0392b':'var(--text-muted)'}}>📅 {fmtDate(task.due_date)}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Move buttons */}
                          <div style={{display:'flex',borderTop:'1px solid var(--border)',background:'var(--surface)'}}>
                            {COLUMNS.filter(c=>c.id!==col.id).map(c=>(
                              <button key={c.id}
                                onClick={e=>{e.stopPropagation();moveTask(task.id,c.id)}}
                                style={{flex:1,background:'transparent',border:'none',borderRight:`1px solid var(--border)`,color:c.color,padding:'5px 4px',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>
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

      {/* ── Card Detail Drawer ── */}
      {drawerTask && (
        <div onClick={e=>e.target===e.currentTarget&&closeDrawer()}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.45)',backdropFilter:'blur(3px)',zIndex:600,display:'flex',justifyContent:'flex-end'}}>
          <div style={{width:'100%',maxWidth:560,background:'var(--white)',boxShadow:'-8px 0 40px rgba(0,0,0,.15)',display:'flex',flexDirection:'column',height:'100%',overflowY:'auto'}}>

            {/* Drawer header */}
            <div style={{padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexShrink:0,background:'var(--white)',position:'sticky',top:0,zIndex:10}}>
              <div style={{flex:1,marginRight:12}}>
                {drawerTask.ticket_no&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color:'var(--espresso)',background:'var(--cream-dark)',padding:'2px 8px',borderRadius:6,display:'inline-block',marginBottom:8}}>{drawerTask.ticket_no}</div>}
                <input
                  value={drawerForm?.title||''}
                  onChange={e=>setDrawerForm(p=>({...p,title:e.target.value}))}
                  style={{width:'100%',border:'none',outline:'none',fontSize:18,fontWeight:700,fontFamily:"'Montserrat',sans-serif",color:'var(--espresso)',background:'transparent',padding:0}}
                />
              </div>
              <button onClick={closeDrawer} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,color:'var(--text-muted)',flexShrink:0}}>×</button>
            </div>

            {drawerLoading ? (
              <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Loading…</div>
            ) : (
              <div style={{flex:1,overflowY:'auto',padding:'20px 24px 32px'}}>

                {/* Meta fields */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
                  <div>
                    <label style={lStyle}>Assigned To</label>
                    <select style={iStyle} value={drawerForm?.assigned_to||''} onChange={e=>setDrawerForm(p=>({...p,assigned_to:e.target.value}))}>
                      <option value="">Unassigned</option>
                      {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.nickname?' "'+s.nickname+'"':''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Due Date</label>
                    <input style={iStyle} type="date" value={drawerForm?.due_date||''} onChange={e=>setDrawerForm(p=>({...p,due_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lStyle}>Priority</label>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                      {PRIORITIES.map(p=>(
                        <div key={p.id} onClick={()=>setDrawerForm(prev=>({...prev,priority:p.id}))}
                          style={{padding:'5px 6px',borderRadius:7,border:`1.5px solid ${drawerForm?.priority===p.id?p.color:'var(--border)'}`,background:drawerForm?.priority===p.id?p.bg:'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:600,color:drawerForm?.priority===p.id?p.color:'var(--text-muted)',transition:'all .15s'}}>
                          {p.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lStyle}>Status</label>
                    <select style={iStyle} value={drawerForm?.status||'todo'} onChange={e=>setDrawerForm(p=>({...p,status:e.target.value}))}>
                      {COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div style={{marginBottom:24}}>
                  <label style={lStyle}>Description</label>
                  <textarea
                    value={drawerForm?.description||''}
                    onChange={e=>setDrawerForm(p=>({...p,description:e.target.value}))}
                    placeholder="Add a description…"
                    style={{...iStyle,resize:'vertical',minHeight:80,lineHeight:1.6}}
                  />
                </div>

                {/* Save button */}
                <button onClick={saveDrawerTask} disabled={savingDrawer}
                  style={{width:'100%',background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginBottom:28}}>
                  {savingDrawer?'Saving…':'✓ Save Changes'}
                </button>

                {/* ── Checklist ── */}
                <div style={{marginBottom:28}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:'var(--espresso)'}}>☑ Checklist</span>
                    {checklist.length>0&&<span style={{fontSize:11,color:'var(--text-muted)'}}>{checklist.filter(c=>c.done).length}/{checklist.length}</span>}
                  </div>

                  {checklist.length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{height:6,borderRadius:6,background:'var(--border)',overflow:'hidden',marginBottom:12}}>
                        <div style={{height:'100%',width:`${checkPct(checklist.filter(c=>c.done).length,checklist.length)}%`,background:checklist.every(c=>c.done)?'#4a7a1e':'var(--matcha)',borderRadius:6,transition:'width .3s'}}/>
                      </div>
                      {checklist.map(item=>(
                        <div key={item.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                          <input type="checkbox" checked={item.done} onChange={()=>toggleCheckItem(item)}
                            style={{width:15,height:15,cursor:'pointer',accentColor:'var(--matcha)',flexShrink:0}}/>
                          <span style={{flex:1,fontSize:12,color:'var(--text-primary)',textDecoration:item.done?'line-through':'none',opacity:item.done?0.5:1}}>{item.label}</span>
                          <button onClick={()=>deleteCheckItem(item.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:11,padding:'0 4px',opacity:0.6}}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <input
                      value={newItem}
                      onChange={e=>setNewItem(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addCheckItem()}
                      placeholder="Add a checklist item…"
                      style={{...iStyle,flex:1,padding:'7px 10px'}}
                    />
                    <button onClick={addCheckItem} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>Add</button>
                  </div>
                </div>

                {/* ── Comments ── */}
                <div style={{marginBottom:28}}>
                  <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:'var(--espresso)',display:'block',marginBottom:12}}>💬 Comments</span>
                  {comments.length===0&&<div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>No comments yet.</div>}
                  {comments.map(c=>{
                    const author = c.staff || currentUser
                    return (
                      <div key={c.id} style={{display:'flex',gap:10,marginBottom:14}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(author?.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                          {initials(author?.first_name,author?.last_name)}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{fontSize:11,fontWeight:700,color:'var(--espresso)'}}>{author?.nickname||author?.first_name} {author?.last_name}</span>
                            <span style={{fontSize:9,color:'var(--text-muted)'}}>{fmtTime(c.created_at)}</span>
                          </div>
                          <div style={{fontSize:12,color:'var(--text-primary)',lineHeight:1.6,background:'var(--surface)',borderRadius:8,padding:'8px 12px',border:'1px solid var(--border)'}}>{c.body}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={commentsEndRef}/>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <textarea
                      value={newComment}
                      onChange={e=>setNewComment(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),addComment())}
                      placeholder="Write a comment… (Enter to send)"
                      style={{...iStyle,flex:1,resize:'none',minHeight:60,lineHeight:1.5}}
                    />
                    <button onClick={addComment} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0,alignSelf:'flex-end'}}>Send</button>
                  </div>
                </div>

                {/* ── Activity Log ── */}
                <div>
                  <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:'var(--espresso)',display:'block',marginBottom:12}}>📋 Activity</span>
                  {activity.length===0&&<div style={{fontSize:12,color:'var(--text-muted)'}}>No activity yet.</div>}
                  {[...activity].reverse().map((a,i)=>(
                    <div key={a.id||i} style={{display:'flex',gap:10,marginBottom:10,alignItems:'flex-start'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'var(--matcha)',marginTop:5,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <span style={{fontSize:11,color:'var(--text-primary)'}}>{a.staff?.nickname||a.staff?.first_name||'Someone'} </span>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{a.action}</span>
                        <div style={{fontSize:9,color:'var(--border)',marginTop:2}}>{fmtTime(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
