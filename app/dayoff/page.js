'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const SHIFTS = [
  { id:'am',  label:'AM',  color:'#4a7a1e' },
  { id:'ops', label:'OPS', color:'#7a3a8a' },
  { id:'mid', label:'MID', color:'#a06000' },
  { id:'pm',  label:'PM',  color:'#2d5a8a' },
]

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5',
  'Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648',
  'Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a',
  'Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a',
  'Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => {
  if (!r) return '#7a6a50'
  if (r.startsWith('Junior Barista')) return '#e8845a'
  return ROLE_COLORS[r] || '#7a6a50'
}

const toISO = d => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
}
const fmtShort  = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '—'
const fmtFull   = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '—'
const initials  = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

export default function DayOffPage() {
  const supabase = createClient()
  const today    = new Date()
  const todayISO = toISO(today)

  const [staff,         setStaff]         = useState([])
  const [dayOffs,       setDayOffs]       = useState([])
  const [schedules,     setSchedules]     = useState([])   // all schedules (for conflict check)
  const [leaves,        setLeaves]        = useState([])   // approved leave_requests
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(null)
  const [confirmBox,    setConfirmBox]    = useState(null) // { staff, iso, hasShift, hasLeave }

  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [search,   setSearch]   = useState('')

  // Drag state
  const [dragging,  setDragging]  = useState(null)  // { staff_id, name, fullName, role }
  const [dragOver,  setDragOver]  = useState(null)   // ISO string
  const touchStaff = useRef(null)
  const ghostRef   = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:s }, { data:d }, { data:sc }, { data:lv }] = await Promise.all([
      supabase.from('staff').select('id,first_name,last_name,nickname,role,employment_status').order('last_name'),
      supabase.from('day_offs').select('*, staff(first_name,last_name,nickname,role)').order('date_from',{ascending:false}),
      supabase.from('schedules').select('staff_id,shift_date,shift_type,published'),
      supabase.from('leave_requests').select('staff_id,date_from,date_to,leave_type,shifts').eq('status','approved'),
    ])
    setStaff(s||[])
    setDayOffs(d||[])
    setSchedules(sc||[])
    setLeaves(lv||[])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3200) }

  // ── Lookup helpers ─────────────────────────────────────────────
  // All day-off ISOs for a given staff_id
  function getDayOffDates(staffId) {
    const set = new Set()
    dayOffs.filter(d=>d.staff_id===staffId).forEach(d=>{
      const from = new Date(d.date_from+'T00:00:00')
      const to   = new Date(d.date_to+'T00:00:00')
      const cur  = new Date(from)
      while (cur <= to) { set.add(toISO(cur)); cur.setDate(cur.getDate()+1) }
    })
    return set
  }

  function getScheduledDates(staffId) {
    return new Set(schedules.filter(s=>s.staff_id===staffId).map(s=>s.shift_date))
  }

  function getLeaveDates(staffId) {
    const set = new Set()
    leaves.filter(l=>l.staff_id===staffId).forEach(l=>{
      const from = new Date(l.date_from+'T00:00:00')
      const to   = new Date(l.date_to+'T00:00:00')
      const cur  = new Date(from)
      while (cur <= to) { set.add(toISO(cur)); cur.setDate(cur.getDate()+1) }
    })
    return set
  }

  // Is this staff member scheduled on a given ISO date?
  function isScheduledOn(staffId, iso) {
    return schedules.some(s=>s.staff_id===staffId && s.shift_date===iso)
  }

  // Is this staff on approved leave on a given ISO date?
  function isOnLeaveOn(staffId, iso) {
    return leaves.some(l=>l.staff_id===staffId && iso>=l.date_from && iso<=l.date_to)
  }

  // ── Calendar day-off map ───────────────────────────────────────
  const calDayOffMap = (() => {
    const map = {}
    dayOffs.forEach(d => {
      const from = new Date(d.date_from+'T00:00:00')
      const to   = new Date(d.date_to+'T00:00:00')
      const cur  = new Date(from)
      while (cur <= to) {
        const iso = toISO(cur)
        if (!map[iso]) map[iso] = []
        map[iso].push({ name:d.staff?.nickname||d.staff?.first_name||'?', role:d.staff?.role, staff_id:d.staff_id, id:d.id })
        cur.setDate(cur.getDate()+1)
      }
    })
    return map
  })()

  // ── Drag handlers ──────────────────────────────────────────────
  function onDragStart(e, member) {
    setDragging({ staff_id:member.id, name:member.nickname||member.first_name, fullName:`${member.first_name} ${member.last_name}`, role:member.role })
    e.dataTransfer.effectAllowed = 'copy'
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }
  function onCellDragOver(e, iso) { e.preventDefault(); e.dataTransfer.dropEffect='copy'; setDragOver(iso) }
  function onCellDragLeave()      { setDragOver(null) }
  function onCellDrop(e, iso) {
    e.preventDefault(); setDragOver(null)
    if (!dragging) return
    tryAssign(dragging, iso)
    setDragging(null)
  }

  function tryAssign(staffObj, iso) {
    const already    = calDayOffMap[iso]?.some(x=>x.staff_id===staffObj.staff_id)
    if (already) { showToast('⚠️',`${staffObj.name} already has a day-off on ${fmtShort(iso)}`); return }
    const hasShift   = isScheduledOn(staffObj.staff_id, iso)
    const hasLeave   = isOnLeaveOn(staffObj.staff_id, iso)
    setConfirmBox({ staff:staffObj, iso, hasShift, hasLeave })
  }

  // Touch drag
  function onTouchStart(e, member) {
    touchStaff.current = { staff_id:member.id, name:member.nickname||member.first_name, fullName:`${member.first_name} ${member.last_name}`, role:member.role }
    const ghost = document.createElement('div')
    ghost.textContent = touchStaff.current.name
    Object.assign(ghost.style, {
      position:'fixed',pointerEvents:'none',zIndex:9999,
      background:getRoleColor(member.role),color:'white',
      padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:700,
      boxShadow:'0 4px 16px rgba(0,0,0,.25)',opacity:0.9,
    })
    document.body.appendChild(ghost)
    ghostRef.current = ghost
  }
  function onTouchMove(e) {
    if (!touchStaff.current) return
    const t = e.touches[0]
    if (ghostRef.current) { ghostRef.current.style.left=(t.clientX-40)+'px'; ghostRef.current.style.top=(t.clientY-20)+'px' }
    const el   = document.elementFromPoint(t.clientX, t.clientY)
    const cell = el?.closest('[data-iso]')
    setDragOver(cell ? cell.dataset.iso : null)
  }
  function onTouchEnd(e) {
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current=null }
    const t    = e.changedTouches[0]
    const el   = document.elementFromPoint(t.clientX, t.clientY)
    const cell = el?.closest('[data-iso]')
    if (cell && touchStaff.current) tryAssign(touchStaff.current, cell.dataset.iso)
    touchStaff.current = null; setDragOver(null)
  }

  // ── Save ───────────────────────────────────────────────────────
  async function confirmAssign() {
    if (!confirmBox) return
    setSaving(true)
    const { staff:s, iso } = confirmBox
    const { error } = await supabase.from('day_offs').insert([{ staff_id:s.staff_id, date_from:iso, date_to:iso, reason:null }])
    if (error) { showToast('❌',error.message); setSaving(false); setConfirmBox(null); return }
    await notifyOne(s.staff_id, {
      type:'general',
      title:'📆 Day-Off Assigned',
      message:`You have been assigned a day-off on ${fmtFull(iso)}. You won't be scheduled for any shift on this date.`,
    })
    await fetchAll()
    setConfirmBox(null)
    showToast('✅',`Day-off saved · ${s.name} · ${fmtShort(iso)}`)
    setSaving(false)
  }

  async function deleteDayOff(id) {
    setDeleting(id)
    const { error } = await supabase.from('day_offs').delete().eq('id',id)
    if (error) { showToast('❌',error.message); setDeleting(null); return }
    await fetchAll()
    showToast('🗑️','Day-off removed')
    setDeleting(null)
  }

  // ── Calendar helpers ───────────────────────────────────────────
  function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate() }
  function getFirstDay(y,m)    { return new Date(y,m,1).getDay() }

  const filteredStaff = (
    search
      ? (staff||[]).filter(s=>(s.first_name+' '+s.last_name+' '+(s.nickname||'')).toLowerCase().includes(search.toLowerCase()))
      : (staff||[])
  )

  // Stats
  const totalThisMonth = dayOffs.filter(d=>{
    const f=new Date(d.date_from+'T00:00:00')
    return f.getMonth()===calMonth&&f.getFullYear()===calYear
  }).length
  const upcomingCount = Object.keys(calDayOffMap).filter(iso=>iso>=todayISO).length

  // ── Render ─────────────────────────────────────────────────────
  return (
    <AuthShell requiredPermission='schedule'>
      <div
        style={{padding:'22px 26px',fontFamily:"'DM Sans',sans-serif",height:'100vh',boxSizing:'border-box',display:'flex',flexDirection:'column',overflow:'hidden'}}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div style={{marginBottom:14,flexShrink:0}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:800,color:'var(--text-primary)'}}>📆 Day-Off Manager</h1>
          <p style={{margin:'3px 0 0',fontSize:11,color:'var(--text-muted)'}}>Drag a staff name onto any date · Synced with Scheduling, Leave & Unavailability, and Staff</p>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14,flexShrink:0}}>
          {[
            { label:'Total Day-Offs',  value:dayOffs.length,  icon:'📅', color:'#4a90c4', bg:'#e8f0fb' },
            { label:'This Month',      value:totalThisMonth,   icon:'🗓️', color:'#a06000', bg:'#fef3e2' },
            { label:'Upcoming',        value:upcomingCount,    icon:'🔜', color:'#4a7a1e', bg:'#eef7e4' },
          ].map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${s.color}33`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:9,fontWeight:700,color:s.color,opacity:.75,textTransform:'uppercase',letterSpacing:1}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main: Staff | Calendar */}
        <div style={{display:'grid',gridTemplateColumns:'210px 1fr',gap:14,flex:1,minHeight:0}}>

          {/* ── Staff Roster ── */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 12px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:8}}>Staff — Drag to assign</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search…'
              style={{width:'100%',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',marginBottom:10,boxSizing:'border-box'}} />

            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
              {loading
                ? <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',paddingTop:20}}>Loading…</div>
                : filteredStaff.map(member=>{
                    const color      = getRoleColor(member.role)
                    const dayOffSet  = getDayOffDates(member.id)
                    const leaveDates = getLeaveDates(member.id)
                    const schDates   = getScheduledDates(member.id)

                    // Count upcoming day-offs this person has
                    const upDayOffs  = [...dayOffSet].filter(iso=>iso>=todayISO).length
                    // Count upcoming scheduled shifts
                    const upShifts   = [...schDates].filter(iso=>iso>=todayISO).length
                    // Count upcoming leaves
                    const upLeaves   = [...leaveDates].filter(iso=>iso>=todayISO).length

                    return (
                      <div key={member.id} draggable
                        onDragStart={e=>onDragStart(e,member)}
                        onDragEnd={onDragEnd}
                        onTouchStart={e=>onTouchStart(e,member)}
                        style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,background:`${color}14`,border:`1px solid ${color}33`,cursor:'grab',userSelect:'none'}}
                        onMouseDown={e=>e.currentTarget.style.cursor='grabbing'}
                        onMouseUp={e=>e.currentTarget.style.cursor='grab'}
                      >
                        {/* Avatar */}
                        <div style={{width:28,height:28,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                          {initials(member.first_name,member.last_name)}
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                            {member.nickname||member.first_name} {member.last_name.split(' ')[0]}
                          </div>
                          <div style={{fontSize:9,color:color,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{member.role}</div>
                          {/* Status badges */}
                          <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                            {upShifts>0  && <span style={{fontSize:8,fontWeight:700,background:'#eef7e4',color:'#4a7a1e',borderRadius:4,padding:'1px 5px'}}>📅 {upShifts}s</span>}
                            {upLeaves>0  && <span style={{fontSize:8,fontWeight:700,background:'#fef3e2',color:'#a06000',borderRadius:4,padding:'1px 5px'}}>🗓️ {upLeaves}l</span>}
                            {upDayOffs>0 && <span style={{fontSize:8,fontWeight:700,background:'#fdeaea',color:'#c0392b',borderRadius:4,padding:'1px 5px'}}>📆 {upDayOffs}d</span>}
                          </div>
                        </div>
                        <div style={{fontSize:12,opacity:.3,flexShrink:0}}>⠿</div>
                      </div>
                    )
                  })
              }
            </div>

            {/* Legend */}
            <div style={{marginTop:10,padding:'8px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,fontSize:9,color:'var(--text-muted)',lineHeight:1.7,flexShrink:0}}>
              <div><span style={{fontWeight:700,color:'#4a7a1e'}}>📅 s</span> = upcoming shifts</div>
              <div><span style={{fontWeight:700,color:'#a06000'}}>🗓️ l</span> = approved leaves</div>
              <div><span style={{fontWeight:700,color:'#c0392b'}}>📆 d</span> = day-offs assigned</div>
            </div>
          </div>

          {/* ── Calendar ── */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Month nav */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexShrink:0}}>
              <button onClick={()=>{ let m=calMonth-1,y=calYear; if(m<0){m=11;y--}; setCalMonth(m);setCalYear(y) }}
                style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 14px',cursor:'pointer',fontSize:14,fontWeight:700}}>‹</button>
              <div style={{fontWeight:800,fontSize:15,color:'var(--text-primary)'}}>{MONTHS[calMonth]} {calYear}</div>
              <button onClick={()=>{ let m=calMonth+1,y=calYear; if(m>11){m=0;y++}; setCalMonth(m);setCalYear(y) }}
                style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 14px',cursor:'pointer',fontSize:14,fontWeight:700}}>›</button>
            </div>

            {/* Day headers */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3,flexShrink:0}}>
              {DAYS_SHORT.map(d=>(
                <div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',padding:'3px 0'}}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,flex:1,gridAutoRows:'1fr'}}>
              {(() => {
                const daysInMonth = getDaysInMonth(calYear,calMonth)
                const firstDay    = getFirstDay(calYear,calMonth)
                const cells       = []

                for (let i=0;i<firstDay;i++) cells.push(<div key={`e${i}`}/>)

                for (let day=1;day<=daysInMonth;day++) {
                  const iso      = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const dayOffsHere  = calDayOffMap[iso] || []
                  const isToday  = iso === todayISO
                  const isOver   = dragOver === iso
                  const isPast   = iso < todayISO

                  // Leaves on this date (for any staff)
                  const leavesHere = leaves.filter(l=>iso>=l.date_from&&iso<=l.date_to)
                  // Scheduled on this date
                  const shiftsHere = schedules.filter(s=>s.shift_date===iso)

                  cells.push(
                    <div key={iso} data-iso={iso}
                      onDragOver={e=>onCellDragOver(e,iso)}
                      onDragLeave={onCellDragLeave}
                      onDrop={e=>onCellDrop(e,iso)}
                      style={{
                        borderRadius:8,padding:'5px 5px 4px',
                        border: isOver   ? '2px dashed #EF4576'
                               : isToday ? '2px solid #EF4576'
                               : dayOffsHere.length ? '1px solid #d4a84355'
                               : '1px solid var(--border)',
                        background: isOver       ? '#EF457612'
                                  : dayOffsHere.length ? '#fef3e2'
                                  : isPast      ? 'var(--bg)'
                                  : 'var(--surface)',
                        opacity: isPast&&!dayOffsHere.length ? 0.5 : 1,
                        transition:'border .1s,background .1s',
                        overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0,
                      }}
                    >
                      {/* Day number */}
                      <div style={{fontSize:10,fontWeight:isToday?800:500,color:isToday?'#EF4576':isOver?'#EF4576':'var(--text-secondary)',marginBottom:2,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span>{day}</span>
                        {/* Shift count dot */}
                        {shiftsHere.length>0 && !isOver && (
                          <span style={{fontSize:7,fontWeight:700,background:'#4a7a1e22',color:'#4a7a1e',borderRadius:3,padding:'1px 3px'}}>{shiftsHere.length}s</span>
                        )}
                      </div>

                      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',gap:2}}>
                        {/* Day-off chips */}
                        {dayOffsHere.slice(0,3).map((e,ei)=>(
                          <div key={ei} style={{display:'flex',alignItems:'center',gap:3,background:'white',border:`1px solid ${getRoleColor(e.role)}44`,borderRadius:4,padding:'2px 4px'}}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:getRoleColor(e.role),flexShrink:0}}/>
                            <span style={{fontSize:8,fontWeight:700,color:getRoleColor(e.role),flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</span>
                            <button onClick={()=>deleteDayOff(e.id)} disabled={deleting===e.id}
                              style={{background:'none',border:'none',cursor:'pointer',fontSize:8,lineHeight:1,padding:0,color:'#c0392b',opacity:deleting===e.id?0.3:0.6,flexShrink:0}}>✕</button>
                          </div>
                        ))}
                        {dayOffsHere.length>3 && <div style={{fontSize:7.5,color:'var(--text-muted)',fontWeight:700,paddingLeft:2}}>+{dayOffsHere.length-3} more</div>}

                        {/* Leave indicator (no day-offs yet on this date) */}
                        {dayOffsHere.length===0 && leavesHere.length>0 && (
                          <div style={{fontSize:7.5,fontWeight:700,color:'#a06000',background:'#fef3e222',borderRadius:3,padding:'1px 4px'}}>🗓️ {leavesHere.length} leave</div>
                        )}
                      </div>

                      {isOver && (
                        <div style={{fontSize:7.5,fontWeight:700,color:'#EF4576',textAlign:'center',marginTop:2}}>drop here</div>
                      )}
                    </div>
                  )
                }
                return cells
              })()}
            </div>
          </div>
        </div>

        {/* ── Confirm modal ── */}
        {confirmBox && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:'var(--surface)',borderRadius:16,padding:'28px 32px',width:360,boxShadow:'0 8px 40px rgba(0,0,0,.2)',fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:8,textAlign:'center'}}>📆</div>
              <div style={{fontWeight:800,fontSize:16,textAlign:'center',color:'var(--text-primary)',marginBottom:8}}>Assign Day-Off?</div>
              <div style={{fontSize:13,color:'var(--text-secondary)',textAlign:'center',marginBottom:16,lineHeight:1.6}}>
                <strong style={{color:getRoleColor(confirmBox.staff.role)}}>{confirmBox.staff.fullName}</strong>
                <br/>on <strong style={{color:'var(--text-primary)'}}>{fmtFull(confirmBox.iso)}</strong>
              </div>

              {/* Conflict warnings */}
              {(confirmBox.hasShift||confirmBox.hasLeave) && (
                <div style={{marginBottom:16,display:'flex',flexDirection:'column',gap:6}}>
                  {confirmBox.hasShift && (
                    <div style={{padding:'8px 12px',background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:8,fontSize:11,color:'#a06000',fontWeight:600}}>
                      ⚠️ This staff is <strong>already scheduled for a shift</strong> on this date. Assigning a day-off will block them from future scheduling but won't remove existing shifts — remove those manually in Scheduling.
                    </div>
                  )}
                  {confirmBox.hasLeave && (
                    <div style={{padding:'8px 12px',background:'#e8f0fb',border:'1px solid #4a90c444',borderRadius:8,fontSize:11,color:'#2d5a8a',fontWeight:600}}>
                      ℹ️ This staff already has an <strong>approved leave</strong> on this date.
                    </div>
                  )}
                </div>
              )}

              <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',marginBottom:20}}>
                They won't be scheduled for any shift on this date and will be notified.
              </div>

              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setConfirmBox(null)}
                  style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text-primary)',borderRadius:9,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  Cancel
                </button>
                <button onClick={confirmAssign} disabled={saving}
                  style={{flex:2,background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?.65:1,fontFamily:"'DM Sans',sans-serif"}}>
                  {saving?'Saving…':'✅ Confirm Day-Off'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{position:'fixed',bottom:24,right:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'11px 18px',boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,fontSize:13,fontWeight:600,zIndex:9999}}>
            <span style={{fontSize:16}}>{toast.icon}</span>
            <span style={{color:'var(--text-primary)'}}>{toast.msg}</span>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
