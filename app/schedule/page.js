'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { useRoles } from '../../lib/roles'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM',  paid:8, color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'ops', label:'OPS', time:'8:00AM–5:00PM',  paid:8, color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5' },
  { id:'mid', label:'MID', time:'11AM–8PM',        paid:8, color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM',  time:'3PM–11PM',        paid:7, color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]

// Leadership roles excluded from staff scheduling
const LEADERSHIP_ROLES = ['Managing Director','CEO']

// Role rows per shift — grouped with dividers
// Sous Chef, Kitchen Staff, and Junior Barista are kept as SEPARATE rows (so it's clear
// which slot someone is filling) but are flexible: any employee holding one of these three
// role types can be dropped into any of the three rows — placement is tracked per-assignment
// via the schedules.assigned_role column, not inferred from the staff member's own title.
const KITCHEN_FLEX_ROWS = ['Sous Chef','Kitchen Staff','Junior Barista']
const isKitchenFlexRole = r => r==='Sous Chef' || r==='Kitchen Staff' || (r||'').startsWith('Junior Barista')

const ROLE_ROWS = [
  // AM
  { shiftId:'am', role:'Cafe Supervisor',          label:'Cafe Supervisor',    group:'front' },
  { shiftId:'am', role:'Cafe Operations Support',  label:'Cafe Support',       group:'front' },
  { shiftId:'am', role:'Senior Barista',            label:'Senior Barista',     group:'bar', divider:true, dividerLabel:'🧋 Bar' },
  { shiftId:'am', role:'Junior Barista',            label:'Junior Barista',     group:'bar' },
  { shiftId:'am', role:'Executive Chef',            label:'Executive Chef / R&D Specialist', group:'kitchen', divider:true, dividerLabel:'🍳 Kitchen' },
  { shiftId:'am', role:'Sous Chef',                 label:'Sous Chef',          group:'kitchen' },
  { shiftId:'am', role:'Kitchen Staff',             label:'Kitchen Staff',      group:'kitchen' },
  // OPS
  { shiftId:'ops', role:'Cafe Supervisor',         label:'Cafe Supervisor',   group:'front', shiftBreak:true },
  { shiftId:'ops', role:'Cafe Operations Support', label:'Cafe Support',      group:'front' },
  // MID
  { shiftId:'mid', role:'Cafe Supervisor',          label:'Cafe Supervisor',   group:'front', shiftBreak:true },
  { shiftId:'mid', role:'Cafe Operations Support',  label:'Cafe Support',      group:'front' },
  { shiftId:'mid', role:'Junior Barista',           label:'Junior Barista',    group:'bar', divider:true, dividerLabel:'🧋 Bar' },
  { shiftId:'mid', role:'Sous Chef',                label:'Sous Chef',         group:'kitchen', divider:true, dividerLabel:'🍳 Kitchen' },
  { shiftId:'mid', role:'Kitchen Staff',            label:'Kitchen Staff',     group:'kitchen' },
  // PM
  { shiftId:'pm', role:'Cafe Supervisor',           label:'Cafe Supervisor',   group:'front', shiftBreak:true },
  { shiftId:'pm', role:'Cafe Operations Support',   label:'Cafe Support',      group:'front' },
  { shiftId:'pm', role:'Senior Barista',            label:'Senior Barista',    group:'bar', divider:true, dividerLabel:'🧋 Bar' },
  { shiftId:'pm', role:'Junior Barista',            label:'Junior Barista',    group:'bar' },
  { shiftId:'pm', role:'Executive Chef',            label:'Executive Chef / R&D Specialist', group:'kitchen', divider:true, dividerLabel:'🍳 Kitchen' },
  { shiftId:'pm', role:'Sous Chef',                 label:'Sous Chef',         group:'kitchen' },
  { shiftId:'pm', role:'Kitchen Staff',             label:'Kitchen Staff',     group:'kitchen' },
]

const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

function getWeekDates(offset=0) {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate()-(day===0?6:day-1)+offset*7)
  mon.setHours(0,0,0,0)
  return DAYS.map((_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d })
}
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d.toLocaleDateString('en-PH',{month:'short',day:'numeric'})

// Does a staff member's role match a row's role pattern?
// For the flexible kitchen-team rows (Sous Chef / Kitchen Staff / Junior Barista), placement
// is determined by the assignment's stored `assigned_role`, not the staff member's own title —
// that lookup happens in getCellAssignments. This roleMatches() is only used as a legacy
// fallback for older schedule rows saved before assigned_role existed.
function roleMatches(staffRole, rowRole) {
  if (!staffRole) return false
  if (staffRole === rowRole) return true
  if (rowRole === 'Junior Barista' && staffRole.startsWith('Junior Barista')) return true
  // Executive Chef row also covers R&D Specialist — they share the same kitchen slot.
  if (rowRole === 'Executive Chef' && staffRole === 'R&D Specialist') return true
  return false
}

export default function SchedulePage() {
  const { getRoleColor: baseRoleColor } = useRoles()
  const getRoleColor = r => {
    if (!r) return '#7a6a50'
    const c = baseRoleColor(r)
    if (c !== '#7a6a50') return c
    if (r.startsWith('Junior Barista')) return '#e8845a'
    return '#7a6a50'
  }
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [schedules, setSchedules]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [toast, setToast]           = useState(null)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [approvedLeaves, setApprovedLeaves]     = useState([])
  const [dayOffsData, setDayOffsData]           = useState([])
  const [dragStaffId, setDragStaffId]   = useState(null)
  const [dragSource, setDragSource]     = useState(null)
  const [sidebarSearch, setSidebarSearch] = useState('')

  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])

  useEffect(()=>{ fetchStaff() },[])
  useEffect(()=>{ if(staff.length){ fetchSchedules(); fetchLeaves() } },[weekOffset,staff])

  async function fetchStaff() {
    const {data}=await supabase.from('staff').select('*').order('last_name')
    setStaff(data||[])
  }
  async function fetchSchedules() {
    fetchDayOffs()
    setLoading(true)
    const {data}=await supabase.from('schedules').select('*').eq('week_start',weekStart)
    setSchedules(data||[])
    setLoading(false)
  }
  async function fetchDayOffs() {
    const {data}=await supabase.from('day_offs').select('staff_id,date_from,date_to')
    setDayOffsData(data||[])
  }
  async function fetchLeaves() {
    const {data}=await supabase.from('leave_requests').select('staff_id,date_from,date_to,leave_type').eq('status','approved')
    setApprovedLeaves(data||[])
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}

  function isOnLeave(staffId,dayIdx,shiftId){
    const date=toISO(weekDates[dayIdx])
    return approvedLeaves.some(l=>{
      if(l.staff_id!==staffId)return false
      if(date<l.date_from||date>l.date_to)return false
      if(!l.shifts||l.shifts.length===0)return true
      return l.shifts.includes(shiftId)||l.shifts.includes('all')
    })
  }

  function isOnDayOff(staffId,dayIdx){
    const date=toISO(weekDates[dayIdx])
    return dayOffsData.some(d=>{
      if(d.staff_id!==staffId)return false
      return date>=d.date_from&&date<=d.date_to
    })
  }

  // Get assignments for a specific date + shift + role row
  function getCellAssignments(dayIdx, shiftId, rowRole) {
    const date = toISO(weekDates[dayIdx])
    return schedules.filter(s => {
      if (s.shift_date !== date || s.shift_type !== shiftId) return false
      const member = staff.find(x => x.id === s.staff_id)
      if (!member) return false
      if (KITCHEN_FLEX_ROWS.includes(rowRole)) {
        // Placement is explicit for rows saved after assigned_role existed.
        if (s.assigned_role) return s.assigned_role === rowRole
        // Legacy fallback for schedule rows saved before this column existed.
        if (rowRole === 'Junior Barista') return member.role.startsWith('Junior Barista')
        return member.role === rowRole
      }
      return roleMatches(member.role, rowRole)
    })
  }

  async function addAssignment(dayIdx, shiftType, staffId, rowRole) {
    const date = toISO(weekDates[dayIdx])
    const member = staff.find(x=>x.id===staffId)
    if (rowRole && KITCHEN_FLEX_ROWS.includes(rowRole) && !isKitchenFlexRole(member?.role)) {
      showToast('❌',`${member?.first_name} (${member?.role}) can't be assigned to a kitchen-team slot`)
      return
    }
    if (schedules.some(s=>s.shift_date===date&&s.shift_type===shiftType&&s.staff_id===staffId)) return
    const conflict = schedules.find(s=>s.shift_date===date&&s.staff_id===staffId)
    if (conflict) {
      const m=staff.find(x=>x.id===staffId)
      const sh=SHIFTS.find(x=>x.id===conflict.shift_type)
      showToast('❌',`${m?.first_name} ${m?.last_name} is already assigned to ${sh?.label} on ${DAYS[dayIdx]} — remove that shift first`)
      return
    }
    const newRow = { staff_id:staffId, shift_date:date, shift_type:shiftType, week_start:weekStart, published:false, assigned_role: KITCHEN_FLEX_ROWS.includes(rowRole) ? rowRole : null }
    const temp = { ...newRow, id:'temp_'+Date.now() }
    setSchedules(prev=>[...prev,temp])
    const {data,error} = await supabase.from('schedules').insert([newRow]).select().single()
    if(error){ setSchedules(prev=>prev.filter(s=>s.id!==temp.id)); showToast('❌',error.message); return }
    setSchedules(prev=>prev.map(s=>s.id===temp.id?data:s))
    const m=staff.find(x=>x.id===staffId)
    const sh=SHIFTS.find(x=>x.id===shiftType)
    showToast('✅',`${m?.first_name} → ${rowRole||sh?.label}`)
  }

  async function removeAssignment(id) {
    setSchedules(prev=>prev.filter(s=>s.id!==id))
    await supabase.from('schedules').delete().eq('id',id)
  }

  async function moveAssignment(sourceDate, sourceShift, staffId, targetDayIdx, targetShift, targetRole) {
    const targetDate=toISO(weekDates[targetDayIdx])
    const member = staff.find(x=>x.id===staffId)
    if (targetRole && KITCHEN_FLEX_ROWS.includes(targetRole) && !isKitchenFlexRole(member?.role)) {
      showToast('❌',`${member?.first_name} (${member?.role}) can't be assigned to a kitchen-team slot`)
      return
    }
    const old=schedules.find(s=>s.shift_date===sourceDate&&s.shift_type===sourceShift&&s.staff_id===staffId)
    if(sourceDate===targetDate&&sourceShift===targetShift&&(old?.assigned_role||null)===(KITCHEN_FLEX_ROWS.includes(targetRole)?targetRole:null))return
    const conflict = schedules.find(s=>s.shift_date===targetDate&&s.staff_id===staffId&&s.id!==old?.id)
    if (conflict) {
      const m=staff.find(x=>x.id===staffId)
      const sh=SHIFTS.find(x=>x.id===conflict.shift_type)
      showToast('❌',`${m?.first_name} ${m?.last_name} is already assigned to ${sh?.label} on ${DAYS[targetDayIdx]} — remove that shift first`)
      return
    }
    if(old)await supabase.from('schedules').delete().eq('id',old.id)
    const newRow={staff_id:staffId,shift_date:targetDate,shift_type:targetShift,week_start:weekStart,published:false,assigned_role:KITCHEN_FLEX_ROWS.includes(targetRole)?targetRole:null}
    const {data}=await supabase.from('schedules').insert([newRow]).select().single()
    if(data){
      setSchedules(prev=>[...prev.filter(s=>s.id!==old?.id),data])
      const m=staff.find(x=>x.id===staffId)
      const sh=SHIFTS.find(x=>x.id===targetShift)
      showToast('🔄',`${m?.first_name} moved to ${targetRole||sh?.label} · ${DAYS[targetDayIdx]}`)
    }
  }

  async function clearWeek() {
    if(!confirm('Clear all assignments for this week?'))return
    await supabase.from('schedules').delete().eq('week_start',weekStart)
    setSchedules([])
    showToast('🗑️','Week cleared')
  }

  async function publishSchedule() {
    setPublishing(true)
    await supabase.from('schedules').update({published:true}).eq('week_start',weekStart)
    setSchedules(prev=>prev.map(s=>({...s,published:true})))
    setShowPublishModal(false)
    setPublishing(false)
    showToast('📣','Schedule published!')
    // ── Messenger: notify each assigned staff member ──
    const uniqueStaffIds = [...new Set(schedules.map(s=>s.staff_id))]
    const weekLabel = weekDates && weekDates.length ? weekDates[0].toLocaleDateString('en-PH',{month:'short',day:'numeric'}) + ' to ' + weekDates[6].toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : 'this week'
    await Promise.allSettled(uniqueStaffIds.map(staffId =>
      fetch('/api/messenger/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ staffId, message: '📅 Schedule Published - Your schedule for ' + weekLabel + ' is now available. Log in to your OHT Staff Portal to view your shifts.' })
      }).catch(()=>{})
    ))
    await fetch('/api/messenger/send-by-emails', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        emails: ['ohheythere.matcha@gmail.com','ohheythere.group@gmail.com'],
        message: '📅 Schedule Published - ' + weekLabel + ' - ' + uniqueStaffIds.length + ' staff assigned and notified.'
      })
    }).catch(()=>{})
  }

  const isPublished = schedules.length>0&&schedules.every(s=>s.published)
  const totalAssignments = schedules.length
  const uniqueStaffAssigned = new Set(schedules.map(s=>s.staff_id)).size

  const filteredStaff = staff.filter(s=>{
    if (LEADERSHIP_ROLES.includes(s.role)) return false   // MD / CEO not schedulable
    const q=sidebarSearch.toLowerCase()
    return `${s.first_name} ${s.last_name} ${s.nickname||''}`.toLowerCase().includes(q)
  })

  function getStaffWeekHours(staffId){
    return schedules.filter(s=>s.staff_id===staffId).reduce((sum,s)=>{
      const sh=SHIFTS.find(x=>x.id===s.shift_type); return sum+(sh?.paid||0)
    },0)
  }

  function getStaffWeekShifts(staffId){
    return new Set(schedules.filter(s=>s.staff_id===staffId).map(s=>s.shift_date)).size
  }

  // Shift requirement alert
  const requiredStaff = staff.filter(s=>s.min_shifts_per_week===5 && !LEADERSHIP_ROLES.includes(s.role))
  const shortfall = requiredStaff.map(s=>{
    const count = getStaffWeekShifts(s.id)
    return {...s,count,missing:5-count}
  }).filter(s=>s.missing>0)

  // Critical role coverage check — flag any day missing Senior Barista or Executive Chef in AM/PM
  const CRITICAL_ROLES = ['Senior Barista', 'Executive Chef']
  const CRITICAL_SHIFTS = ['am', 'pm'] // MID doesn't have these roles
  const coverageGaps = []
  weekDates.forEach((date, di) => {
    const iso = toISO(date)
    CRITICAL_SHIFTS.forEach(shiftId => {
      const shift = SHIFTS.find(s => s.id === shiftId)
      CRITICAL_ROLES.forEach(role => {
        // Check if this role row exists in ROLE_ROWS for this shift
        const rowExists = ROLE_ROWS.some(r => r.shiftId === shiftId && r.role === role)
        if (!rowExists) return
        // Find any staff assigned to this shift on this date who match this role
        const assigned = schedules.filter(sc => sc.shift_date === iso && sc.shift_type === shiftId)
        const hasCoverage = assigned.some(sc => {
          const s = staff.find(st => st.id === sc.staff_id)
          if (!s) return false
          if (role === 'Executive Chef') return s.role === 'Executive Chef' || s.role === 'R&D Specialist'
          return s.role === role
        })
        if (!assigned.length || !hasCoverage) {
          coverageGaps.push({ date, iso, day: DAYS[di], shiftId, shiftLabel: shift.label, role })
        }
      })
    })
  })

  const ROW_H = 68 // cell height px

  return (
    <AuthShell>
      {/* TOPBAR */}
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div>
            <div className="topbar-title">Scheduling</div>
            <div className="topbar-sub">{totalAssignments} shifts · {uniqueStaffAssigned} staff assigned</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'4px 8px'}}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{width:26,height:26,borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:16,color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',minWidth:130,textAlign:'center'}}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
            </span>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{width:26,height:26,borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:16,color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            <button onClick={()=>setWeekOffset(0)} style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:5,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',color:'var(--text-muted)',fontFamily:"'DM Sans',sans-serif"}}>TODAY</button>
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <a href="/schedule/timesheet" style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-primary)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textDecoration:'none'}}>🗒️ Timesheet</a>
          <button onClick={clearWeek} style={{background:'transparent',border:'1px solid #f5c6c6',color:'#c0392b',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Clear Week</button>
          <button onClick={()=>setShowPublishModal(true)}
            style={{background:isPublished?'var(--matcha-dark)':'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
            {isPublished?'✓ Published':'📣 Publish Schedule'}
          </button>
        </div>
      </div>

      {/* SHIFT ALERT */}
      {requiredStaff.length > 0 && (
        shortfall.length === 0 ? (
          <div style={{background:'var(--matcha-pale)',borderBottom:'1px solid var(--matcha)',padding:'7px 20px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <span>✅</span><span style={{fontSize:11,fontWeight:600,color:'var(--matcha-dark)'}}>All required staff have 5 shifts this week</span>
          </div>
        ) : (
          <div style={{background:'#fef3e2',borderBottom:'1px solid #d4a84355',padding:'7px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0,flexWrap:'wrap'}}>
            <span>⚠️</span>
            <span style={{fontSize:11,fontWeight:700,color:'#a06000',flexShrink:0}}>{shortfall.length} below 5-shift minimum:</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {shortfall.map(s=>(
                <span key={s.id} style={{background:'white',border:'1px solid #d4a84388',borderRadius:7,padding:'2px 9px',fontSize:11,fontWeight:600,color:'var(--espresso)'}}>
                  {s.first_name} {s.last_name} <span style={{color:'#c0392b',fontFamily:"'DM Mono',monospace"}}>{s.count}/5</span>
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {/* CRITICAL COVERAGE ALERT */}
      {coverageGaps.length > 0 && (
        <div style={{background:'#fff0f0',borderBottom:'1px solid #f5c6c6',padding:'7px 20px',display:'flex',alignItems:'flex-start',gap:10,flexShrink:0,flexWrap:'wrap'}}>
          <span style={{fontSize:14,flexShrink:0,marginTop:1}}>🚨</span>
          <div style={{flex:1,minWidth:0}}>
            <span style={{fontSize:11,fontWeight:700,color:'#c0392b',display:'block',marginBottom:4}}>
              Critical role uncovered — {coverageGaps.length} gap{coverageGaps.length!==1?'s':''} this week:
            </span>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {coverageGaps.map((g,i)=>(
                <span key={i} style={{background:'white',border:'1px solid #f5c6c6',borderRadius:7,padding:'2px 9px',fontSize:11,fontWeight:600,color:'var(--espresso)',whiteSpace:'nowrap'}}>
                  <span style={{color:'#c0392b',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{g.shiftLabel} {g.day}</span>
                  {' '}— no {g.role}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{display:'flex',flex:1,overflow:'hidden',height:'calc(100vh - 108px)'}}>

        {/* STAFF SIDEBAR */}
        <div style={{width:200,flexShrink:0,background:'var(--espresso)',display:'flex',flexDirection:'column',overflowY:'auto',borderRight:'1px solid rgba(0,0,0,.2)'}}>
          <div style={{padding:'10px 10px 5px',fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'rgba(255,255,255,.35)'}}>Drag to assign</div>
          <div style={{padding:'0 8px 6px'}}>
            <input value={sidebarSearch} onChange={e=>setSidebarSearch(e.target.value)} placeholder="Search…"
              style={{width:'100%',background:'rgba(0,0,0,.2)',border:'1px solid rgba(255,255,255,.1)',borderRadius:7,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'white',outline:'none'}}/>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 8px 12px'}}>
            {filteredStaff.map(s=>{
              const hrs=getStaffWeekHours(s.id)
              const shifts=getStaffWeekShifts(s.id)
              const needsShifts=s.min_shifts_per_week===5
              // Check if this staff has a day-off anywhere in the current week
              const hasDayOffThisWeek=dayOffsData.some(d=>{
                if(d.staff_id!==s.id)return false
                return weekDates.some(wd=>{ const iso=toISO(wd); return iso>=d.date_from&&iso<=d.date_to })
              })
              return (
                <div key={s.id} draggable
                  onDragStart={e=>{setDragStaffId(s.id);setDragSource(null);e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('staffId',s.id)}}
                  onDragEnd={()=>setDragStaffId(null)}
                  style={{background:'rgba(0,0,0,.2)',border:'1px solid rgba(255,255,255,.08)',borderRadius:9,padding:'7px 9px',marginBottom:5,cursor:'grab',userSelect:'none',opacity:dragStaffId===s.id?.4:1,transition:'all .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.3)';e.currentTarget.style.borderColor=getRoleColor(s.role)+'88'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,.2)';e.currentTarget.style.borderColor='rgba(255,255,255,.08)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(s.first_name,s.last_name)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.first_name} {s.last_name}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,.45)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.role}</div>
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      {hrs>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,.6)'}}>{hrs}h</div>}
                      {needsShifts
                        ? <div style={{fontSize:8,fontWeight:700,color:shifts>=5?'#7ab648':'#e8845a'}}>{shifts}/5</div>
                        : <div style={{fontSize:8,fontWeight:700,color:shifts>0?'rgba(255,255,255,.5)':'rgba(255,255,255,.3)'}}>{shifts} shift{shifts!==1?'s':''}</div>}
                      {hasDayOffThisWeek&&<div style={{fontSize:8,fontWeight:700,color:'#f5a623'}}>📆 off</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ROSTER GRID */}
        <div style={{flex:1,overflowX:'auto',overflowY:'auto',background:'var(--surface)'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading schedule…</div>
          ) : (
            <div style={{minWidth:760}}>

              {/* Day headers — sticky */}
              <div style={{display:'grid',gridTemplateColumns:'140px repeat(7,1fr)',position:'sticky',top:0,zIndex:10,background:'var(--espresso)',borderBottom:'2px solid rgba(0,0,0,.2)'}}>
                <div style={{padding:'10px 12px',fontSize:9,fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,.5)',textTransform:'uppercase'}}>Role / Day</div>
                {weekDates.map((d,i)=>{
                  const isToday=d.toDateString()===new Date().toDateString()
                  return (
                    <div key={i} style={{padding:'10px 6px',textAlign:'center',borderLeft:'1px solid rgba(255,255,255,.1)'}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:isToday?'#a8d672':'rgba(255,255,255,.5)'}}>{DAYS[i]}</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:900,color:isToday?'#a8d672':'white',lineHeight:1.1,marginTop:2}}>{d.getDate()}</div>
                      <div style={{fontSize:8,color:'rgba(255,255,255,.35)',marginTop:1}}>{fmtDate(d)}</div>
                    </div>
                  )
                })}
              </div>

              {/* Role rows */}
              {ROLE_ROWS.map((row,rowIdx)=>{
                const shift=SHIFTS.find(s=>s.id===row.shiftId)

                return (
                  <div key={rowIdx}>
                    {/* Shift group header */}
                    {row.shiftBreak && (
                      <div style={{display:'grid',gridTemplateColumns:'140px repeat(7,1fr)',background:shift.color,borderTop:'3px solid rgba(0,0,0,.15)'}}>
                        <div style={{padding:'6px 12px',fontSize:10,fontWeight:900,color:'white',letterSpacing:1,textTransform:'uppercase',gridColumn:'1/-1',display:'flex',alignItems:'center',gap:8}}>
                          <span>{shift.label} SHIFT</span>
                          <span style={{fontSize:9,fontWeight:400,opacity:.7}}>{shift.time}</span>
                        </div>
                      </div>
                    )}
                    {rowIdx===0 && (
                      <div style={{display:'grid',gridTemplateColumns:'140px repeat(7,1fr)',background:SHIFTS[0].color,borderTop:'3px solid rgba(0,0,0,.1)'}}>
                        <div style={{padding:'6px 12px',fontSize:10,fontWeight:900,color:'white',letterSpacing:1,textTransform:'uppercase',gridColumn:'1/-1',display:'flex',alignItems:'center',gap:8}}>
                          <span>AM SHIFT</span>
                          <span style={{fontSize:9,fontWeight:400,opacity:.7}}>{SHIFTS[0].time}</span>
                        </div>
                      </div>
                    )}

                    {/* Section divider — Kitchen / Bar */}
                    {row.divider && (
                      <div style={{display:'grid',gridTemplateColumns:'140px repeat(7,1fr)',background:'rgba(0,0,0,.04)',borderTop:'1px dashed var(--border)'}}>
                        <div style={{padding:'3px 12px',fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',gridColumn:'1/-1'}}>
                          {row.dividerLabel}
                        </div>
                      </div>
                    )}

                    {/* Role row cells */}
                    <div style={{display:'grid',gridTemplateColumns:'140px repeat(7,1fr)',borderTop:'1px solid var(--border)'}}>
                      {/* Row label */}
                      <div style={{padding:'8px 12px',background:'var(--white)',borderRight:'2px solid var(--border)',display:'flex',alignItems:'center',minHeight:ROW_H}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--espresso)',lineHeight:1.3}}>{row.label}</div>
                          <div style={{fontSize:9,color:'rgba('+shift.color.slice(1).match(/../g).map(x=>parseInt(x,16)).join(',')+',.8)',marginTop:2,fontWeight:600}}>{shift.label}</div>
                        </div>
                      </div>

                      {/* Day cells */}
                      {weekDates.map((d,dayIdx)=>{
                        const assignments=getCellAssignments(dayIdx,row.shiftId,row.role)
                        const dateISO=toISO(d)
                        const isToday=d.toDateString()===new Date().toDateString()

                        return (
                          <div key={dayIdx}
                            onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=shift.bg;e.currentTarget.style.outline=`2px dashed ${shift.border}`}}
                            onDragLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.outline=''}}
                            onDrop={e=>{
                              e.preventDefault()
                              e.currentTarget.style.background=''
                              e.currentTarget.style.outline=''
                              // Read from dataTransfer as fallback — dragStaffId can be null on drop in some browsers
                              const sid = dragStaffId || e.dataTransfer.getData('staffId')
                              const src = dragSource || (e.dataTransfer.getData('sourceDate') ? { date:e.dataTransfer.getData('sourceDate'), shiftType:e.dataTransfer.getData('sourceShift') } : null)
                              if(!sid){ setDragStaffId(null); setDragSource(null); return }
                              const member=staff.find(x=>x.id===sid)
                              if(isOnLeave(sid,dayIdx,row.shiftId)){
                                showToast('🚫','On approved leave for this date')
                              } else if(isOnDayOff(sid,dayIdx)){
                                showToast('📆','Staff has a day-off on this date')
                              } else if(src){
                                moveAssignment(src.date,src.shiftType,sid,dayIdx,row.shiftId,row.role)
                              } else {
                                addAssignment(dayIdx,row.shiftId,sid,row.role)
                              }
                              setDragStaffId(null);setDragSource(null)
                            }}
                            style={{
                              borderLeft:'1px solid var(--border)',
                              padding:4,
                              minHeight:ROW_H,
                              background: assignments.length===0 && CRITICAL_ROLES.includes(row.role) && CRITICAL_SHIFTS.includes(row.shiftId)
                                ? (isToday ? '#ffe0e088' : '#fff0f0')
                                : (isToday ? shift.bg+'66' : 'var(--white)'),
                              position:'relative',
                              transition:'background .1s',
                            }}>

                            {assignments.length===0 && (
                              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                                {CRITICAL_ROLES.includes(row.role) && CRITICAL_SHIFTS.includes(row.shiftId) ? (
                                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                                    <span style={{fontSize:12}}>🚨</span>
                                    <span style={{fontSize:8,fontWeight:700,color:'#c0392b',textAlign:'center',lineHeight:1.2,fontFamily:"'DM Sans',sans-serif"}}>Required</span>
                                  </div>
                                ) : (
                                  <div style={{width:20,height:20,borderRadius:'50%',border:`1.5px dashed ${shift.border}44`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    <span style={{fontSize:10,color:shift.border+'66',lineHeight:1}}>+</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {assignments.map(asgn=>{
                              const m=staff.find(x=>x.id===asgn.staff_id)
                              if(!m)return null
                              return (
                                <div key={asgn.id} draggable
                                  onDragStart={e=>{
                                    setDragStaffId(m.id)
                                    setDragSource({date:dateISO,shiftType:row.shiftId})
                                    e.dataTransfer.effectAllowed='move'
                                    e.dataTransfer.setData('staffId',m.id)
                                    e.dataTransfer.setData('sourceDate',dateISO)
                                    e.dataTransfer.setData('sourceShift',row.shiftId)
                                    e.stopPropagation()
                                  }}
                                  style={{display:'flex',alignItems:'center',gap:4,borderRadius:6,padding:'4px 6px',marginBottom:3,cursor:'grab',
                                    background:shift.bg,border:`1.5px solid ${shift.border}`,transition:'all .1s'}}
                                  onMouseEnter={e=>e.currentTarget.querySelector('.rm').style.opacity='1'}
                                  onMouseLeave={e=>e.currentTarget.querySelector('.rm').style.opacity='0'}>
                                  <div style={{width:18,height:18,borderRadius:'50%',background:getRoleColor(m.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'white',flexShrink:0}}>
                                    {initials(m.first_name,m.last_name)}
                                  </div>
                                  <span style={{fontSize:10,fontWeight:600,color:shift.color,flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                    {m.nickname||m.first_name}
                                  </span>
                                  <span className="rm" onClick={()=>removeAssignment(asgn.id)}
                                    style={{width:13,height:13,borderRadius:'50%',background:'rgba(0,0,0,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'white',opacity:0,cursor:'pointer',transition:'opacity .1s',flexShrink:0}}>
                                    ×
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Shifts summary — frozen to bottom of the scroll area so it stays visible */}
              {filteredStaff.length>0&&(
                <div style={{position:'sticky',bottom:0,left:0,padding:'12px 16px',background:'var(--white)',borderTop:'2px solid var(--border)',boxShadow:'0 -6px 14px rgba(0,0,0,.06)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',maxHeight:110,overflowY:'auto',zIndex:5}}>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',flexShrink:0,position:'sticky',left:16}}>Shifts this week:</span>
                  {[...filteredStaff].sort((a,b)=>getStaffWeekShifts(b.id)-getStaffWeekShifts(a.id)).map(s=>{
                    const shiftCount=getStaffWeekShifts(s.id)
                    const hasShifts=shiftCount>0
                    return (
                      <div key={s.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'3px 8px',background:hasShifts?'var(--surface)':'transparent',border:`1px solid ${hasShifts?'var(--border)':'var(--border)'}`,borderRadius:6,opacity:hasShifts?1:.5}}>
                        <div style={{width:14,height:14,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:6,fontWeight:700,color:'white'}}>
                          {initials(s.first_name,s.last_name)}
                        </div>
                        <span style={{fontWeight:600}}>{s.nickname||s.first_name}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",color:hasShifts?'var(--matcha-dark)':'var(--text-muted)',fontWeight:700}}>{shiftCount} shift{shiftCount!==1?'s':''}</span>
                      </div>
                    )
                  })}
                </div>

              )}
            </div>
          )}
        </div>
      </div>

      {/* PUBLISH MODAL */}
      {showPublishModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>e.target===e.currentTarget&&setShowPublishModal(false)}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:460,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{fontSize:32,marginBottom:10}}>📣</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:19,fontWeight:700,marginBottom:6}}>Publish Schedule?</div>
            <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:16}}>
              Staff will be notified of their shifts for <strong>{fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}</strong>.
            </div>
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:16,maxHeight:200,overflowY:'auto'}}>
              {[...new Set(schedules.map(s=>s.staff_id))].map(sid=>{
                const m=staff.find(x=>x.id===sid); if(!m)return null
                const shifts=schedules.filter(x=>x.staff_id===sid)
                return (
                  <div key={sid} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:12}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:getRoleColor(m.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(m.first_name,m.last_name)}
                    </div>
                    <span style={{fontWeight:600,flex:1}}>{m.first_name} {m.last_name}</span>
                    <span style={{color:'var(--text-muted)',fontSize:11}}>{shifts.length} shift{shifts.length!==1?'s':''}</span>
                    <span style={{color:'#1877F2',fontSize:10,fontWeight:600}}>💬 Notify</span>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setShowPublishModal(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'11px 18px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={publishSchedule} disabled={publishing}
                style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:11,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {publishing?'Publishing…':'✓ Publish & Notify Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'white',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
