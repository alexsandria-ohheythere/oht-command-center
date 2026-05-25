'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM',  color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'mid', label:'MID', time:'11:00AM–8:00PM', color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM',  time:'3:00PM–11:00PM', color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : ''
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

export default function CheckinPage() {
  const supabase = createClient()
  const today = toISO(new Date())
  const [staff, setStaff]           = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [selectedShift, setSelectedShift] = useState('am')
  const [assignments, setAssignments] = useState([]) // today's scheduled staff
  const [tasks, setTasks]           = useState([])   // role_tasks
  const [checkIns, setCheckIns]     = useState([])   // shift_task_assignments for today
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(null)
  const [view, setView]             = useState('select') // select | checkin | summary
  const [toast, setToast]           = useState(null)
  const [taskPool, setTaskPool]     = useState([])   // available tasks to assign
  const [showAddTask, setShowAddTask] = useState(false)
  const [selectedToAdd, setSelectedToAdd] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: sch }, { data: t }, { data: ci }] = await Promise.all([
      supabase.from('staff').select('*').order('last_name'),
      supabase.from('schedules').select('*').eq('shift_date', today),
      supabase.from('role_tasks').select('*').eq('is_active', true).order('task_order'),
      supabase.from('shift_task_assignments').select('*').eq('shift_date', today),
    ])
    setStaff(s||[])
    setAssignments(sch||[])
    setTasks(t||[])
    setCheckIns(ci||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}

  // Get staff scheduled for a shift today
  function getScheduledStaff(shiftId) {
    return assignments.filter(a=>a.shift_type===shiftId).map(a=>staff.find(s=>s.id===a.staff_id)).filter(Boolean)
  }

  // Get check-in tasks for selected staff + shift
  function getStaffTasks() {
    return checkIns.filter(ci => ci.staff_id===selectedStaff?.id && ci.shift_type===selectedShift)
  }

  // Get role tasks available for this staff+shift (not yet assigned)
  function getAvailableRoleTasks() {
    if (!selectedStaff) return []
    const assigned = getStaffTasks().map(ci=>ci.task_id)
    return tasks.filter(t=>t.role===selectedStaff.role && t.shift_type===selectedShift && !assigned.includes(t.id))
  }

  async function openCheckin(staffMember, shiftId) {
    setSelectedStaff(staffMember)
    setSelectedShift(shiftId)
    setView('checkin')
    // Auto-assign default role tasks if none assigned yet
    const existing = checkIns.filter(ci=>ci.staff_id===staffMember.id&&ci.shift_type===shiftId&&ci.shift_date===today)
    if (existing.length === 0) {
      const roleTasks = tasks.filter(t=>t.role===staffMember.role&&t.shift_type===shiftId)
      if (roleTasks.length > 0) {
        const schedEntry = assignments.find(a=>a.staff_id===staffMember.id&&a.shift_type===shiftId)
        const inserts = roleTasks.map(t=>({
          schedule_id: schedEntry?.id || null,
          task_id: t.id,
          staff_id: staffMember.id,
          shift_date: today,
          shift_type: shiftId,
          completed: false,
          completed_at: null,
        }))
        const { data } = await supabase.from('shift_task_assignments').insert(inserts).select()
        if (data) setCheckIns(prev=>[...prev,...data])
      }
    }
  }

  async function toggleTask(ciId, completed) {
    setSaving(ciId)
    const completed_at = completed ? new Date().toISOString() : null
    const { data } = await supabase.from('shift_task_assignments')
      .update({ completed, completed_at })
      .eq('id', ciId).select().single()
    if (data) setCheckIns(prev=>prev.map(ci=>ci.id===ciId?data:ci))
    setSaving(null)
  }

  async function addTasksToCheckin() {
    if (!selectedToAdd.length) return
    const schedEntry = assignments.find(a=>a.staff_id===selectedStaff.id&&a.shift_type===selectedShift)
    const inserts = selectedToAdd.map(tid=>({
      schedule_id: schedEntry?.id||null,
      task_id: tid,
      staff_id: selectedStaff.id,
      shift_date: today,
      shift_type: selectedShift,
      completed: false,
      completed_at: null,
    }))
    const { data } = await supabase.from('shift_task_assignments').insert(inserts).select()
    if (data) setCheckIns(prev=>[...prev,...data])
    setSelectedToAdd([])
    setShowAddTask(false)
    showToast('✅',`${inserts.length} task${inserts.length!==1?'s':''} added`)
  }

  async function removeTaskFromCheckin(ciId) {
    await supabase.from('shift_task_assignments').delete().eq('id', ciId)
    setCheckIns(prev=>prev.filter(ci=>ci.id!==ciId))
  }

  // Progress
  function getProgress(staffId, shiftId) {
    const all = checkIns.filter(ci=>ci.staff_id===staffId&&ci.shift_type===shiftId&&ci.shift_date===today)
    const done = all.filter(ci=>ci.completed).length
    return { total: all.length, done }
  }

  const staffTasks = getStaffTasks()
  const completed  = staffTasks.filter(ci=>ci.completed).length
  const shift      = SHIFTS.find(s=>s.id===selectedShift)

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Daily Check-In</div>
          <div className="topbar-sub">{new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
        </div>
        {view!=='select'&&<button className="btn btn-secondary" onClick={()=>setView('select')}>← Back</button>}
      </div>

      <div className="page-content">

        {/* SELECT VIEW */}
        {view==='select'&&(
          <div>
            {/* Shift tabs */}
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              {SHIFTS.map(sh=>(
                <button key={sh.id} onClick={()=>setSelectedShift(sh.id)}
                  style={{padding:'8px 18px',borderRadius:9,border:`1.5px solid ${selectedShift===sh.id?sh.border:'var(--border)'}`,background:selectedShift===sh.id?sh.bg:'var(--white)',color:selectedShift===sh.id?sh.color:'var(--text-muted)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                  {sh.label} Shift
                  <span style={{marginLeft:6,fontSize:10,opacity:.7}}>({getScheduledStaff(sh.id).length})</span>
                </button>
              ))}
            </div>

            {loading?(
              <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>
            ):getScheduledStaff(selectedShift).length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                <div style={{fontSize:36,marginBottom:12}}>📅</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No staff scheduled for {SHIFTS.find(s=>s.id===selectedShift)?.label} today</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>Add staff to today's schedule first</div>
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {getScheduledStaff(selectedShift).map(s=>{
                  const {total,done} = getProgress(s.id, selectedShift)
                  const pct = total>0?Math.round((done/total)*100):0
                  const sh = SHIFTS.find(x=>x.id===selectedShift)
                  return (
                    <div key={s.id} onClick={()=>openCheckin(s,selectedShift)}
                      style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px',cursor:'pointer',transition:'all .2s',borderTop:`3px solid ${ROLE_COLORS[s.role]||'#7a6a50'}`}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                      <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:12}}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:ROLE_COLORS[s.role]||'#7a6a50',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>
                          {initials(s.first_name,s.last_name)}
                        </div>
                        <div>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                        </div>
                      </div>
                      {total>0?(
                        <>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:5}}>
                            <span style={{color:'var(--text-muted)'}}>Tasks completed</span>
                            <span style={{fontWeight:700,color:pct===100?'var(--matcha-dark)':sh.color}}>{done}/{total}</span>
                          </div>
                          <div style={{height:5,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct}%`,background:pct===100?'var(--matcha)':sh.border,borderRadius:4,transition:'width .3s'}}/>
                          </div>
                          {pct===100&&<div style={{fontSize:10,color:'var(--matcha-dark)',fontWeight:700,marginTop:6,textAlign:'center'}}>✅ All tasks complete!</div>}
                        </>
                      ):(
                        <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'6px 0'}}>Tap to assign & start check-in</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CHECK-IN VIEW */}
        {view==='checkin'&&selectedStaff&&(
          <div style={{maxWidth:580,margin:'0 auto'}}>
            {/* Header */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 22px',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:ROLE_COLORS[selectedStaff.role]||'#7a6a50',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(selectedStaff.first_name,selectedStaff.last_name)}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700}}>{selectedStaff.first_name} {selectedStaff.last_name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{selectedStaff.role} · <span style={{color:shift.color,fontWeight:600}}>{shift.label} Shift ({shift.time})</span></div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:completed===staffTasks.length&&staffTasks.length>0?'var(--matcha-dark)':shift.color}}>{completed}/{staffTasks.length}</div>
                <div style={{fontSize:9,color:'var(--text-muted)',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>Tasks Done</div>
              </div>
            </div>

            {/* Progress bar */}
            {staffTasks.length>0&&(
              <div style={{height:6,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden',marginBottom:16}}>
                <div style={{height:'100%',width:`${Math.round((completed/staffTasks.length)*100)}%`,background:completed===staffTasks.length?'var(--matcha)':shift.border,borderRadius:4,transition:'width .4s'}}/>
              </div>
            )}

            {/* Task checklist */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',marginBottom:12}}>
              <div style={{background:shift.bg,padding:'11px 16px',borderBottom:`1px solid ${shift.border}33`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:11,fontWeight:700,color:shift.color}}>Today's Checklist</span>
                <button onClick={()=>setShowAddTask(!showAddTask)}
                  style={{background:shift.border,color:'white',border:'none',borderRadius:6,padding:'4px 10px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  + Add Task
                </button>
              </div>

              {staffTasks.length===0?(
                <div style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>
                  No tasks assigned yet.<br/>Click + Add Task to pick from {selectedStaff.role} task templates.
                </div>
              ):(
                staffTasks.map(ci=>{
                  const task = tasks.find(t=>t.id===ci.task_id)
                  return (
                    <div key={ci.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:'1px solid var(--cream-dark)',background:ci.completed?'#f8fdf5':'var(--white)',transition:'background .2s'}}>
                      <button
                        onClick={()=>toggleTask(ci.id,!ci.completed)}
                        disabled={saving===ci.id}
                        style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${ci.completed?'var(--matcha)':shift.border}`,background:ci.completed?'var(--matcha)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',flexShrink:0}}>
                        {ci.completed&&<span style={{color:'white',fontSize:12,fontWeight:700}}>✓</span>}
                      </button>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,color:ci.completed?'var(--text-muted)':'var(--espresso)',textDecoration:ci.completed?'line-through':'none'}}>
                          {task?.task_name||'Unknown task'}
                        </div>
                        {ci.completed&&ci.completed_at&&(
                          <div style={{fontSize:10,color:'var(--matcha-dark)',marginTop:2,fontFamily:"'DM Mono',monospace"}}>
                            ✓ Completed at {fmtTime(ci.completed_at)}
                          </div>
                        )}
                      </div>
                      <button onClick={()=>removeTaskFromCheckin(ci.id)}
                        style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14,padding:'2px 4px',transition:'color .15s'}}
                        onMouseEnter={e=>e.target.style.color='#c0392b'}
                        onMouseLeave={e=>e.target.style.color='var(--border)'}>
                        ×
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add task panel */}
            {showAddTask&&(
              <div style={{background:'var(--white)',border:`1px solid ${shift.border}`,borderRadius:13,padding:'16px',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:shift.color,marginBottom:10}}>Add Tasks from {selectedStaff.role} · {shift.label} Templates</div>
                {getAvailableRoleTasks().length===0?(
                  <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:'12px'}}>All template tasks are already assigned.</div>
                ):(
                  <>
                    {getAvailableRoleTasks().map(t=>(
                      <div key={t.id} onClick={()=>setSelectedToAdd(prev=>prev.includes(t.id)?prev.filter(x=>x!==t.id):[...prev,t.id])}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,cursor:'pointer',marginBottom:5,background:selectedToAdd.includes(t.id)?shift.bg:'var(--surface)',border:`1px solid ${selectedToAdd.includes(t.id)?shift.border:'var(--border)'}`,transition:'all .15s'}}>
                        <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${selectedToAdd.includes(t.id)?shift.color:'var(--border)'}`,background:selectedToAdd.includes(t.id)?shift.color:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          {selectedToAdd.includes(t.id)&&<span style={{color:'white',fontSize:10,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:12,color:'var(--espresso)'}}>{t.task_name}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',gap:8,marginTop:10}}>
                      <button onClick={()=>{setShowAddTask(false);setSelectedToAdd([])}} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 14px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                      <button onClick={addTasksToCheckin} disabled={!selectedToAdd.length}
                        style={{flex:1,background:selectedToAdd.length?shift.border:'var(--border)',color:'white',border:'none',borderRadius:8,padding:'8px',fontSize:11,fontWeight:700,cursor:selectedToAdd.length?'pointer':'default',fontFamily:"'DM Sans',sans-serif"}}>
                        Add {selectedToAdd.length>0?selectedToAdd.length:''} Task{selectedToAdd.length!==1?'s':''}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Complete all button */}
            {staffTasks.length>0&&completed<staffTasks.length&&(
              <button onClick={async()=>{
                for(const ci of staffTasks.filter(ci=>!ci.completed)) await toggleTask(ci.id,true)
              }} style={{width:'100%',background:'var(--matcha)',color:'white',border:'none',borderRadius:10,padding:'12px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>
                ✓ Mark All Complete
              </button>
            )}

            {completed===staffTasks.length&&staffTasks.length>0&&(
              <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:12,padding:'16px',textAlign:'center'}}>
                <div style={{fontSize:28,marginBottom:6}}>🎉</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,color:'var(--matcha-dark)'}}>All tasks complete!</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{selectedStaff.first_name} has finished all {shift.label} shift tasks</div>
              </div>
            )}
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
