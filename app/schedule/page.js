'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM – 3:30PM',  hours:9, paid:8 },
  { id:'mid', label:'MID', time:'11:00AM – 8:00PM', hours:9, paid:8 },
  { id:'pm',  label:'PM',  time:'3:00PM – 11:00PM', hours:8, paid:7 },
]

const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()

function getWeekDates(offset = 0) {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  mon.setHours(0,0,0,0)
  return DAYS.map((_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function fmtDate(d) {
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric' })
}

export default function SchedulePage() {
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [schedules, setSchedules]   = useState([]) // [{id, staff_id, shift_date, shift_type, published}]
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [toast, setToast]           = useState(null)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [approvedLeaves, setApprovedLeaves] = useState([]) // [{staff_id, date_from, date_to}]
  const [dragStaffId, setDragStaffId] = useState(null)
  const [dragSource, setDragSource]   = useState(null) // {shiftDate, shiftType}
  const [sidebarSearch, setSidebarSearch] = useState('')
  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])

  useEffect(() => { fetchStaff() }, [])
  useEffect(() => { if (staff.length) { fetchSchedules(); fetchLeaves() } }, [weekOffset, staff])

  async function fetchLeaves() {
    const { data } = await supabase
      .from('leave_requests')
      .select('staff_id, date_from, date_to, leave_type')
      .eq('status', 'approved')
    setApprovedLeaves(data || [])
  }

  async function fetchStaff() {
    const { data } = await supabase.from('staff').select('*').order('last_name')
    setStaff(data || [])
  }

  async function fetchSchedules() {
    setLoading(true)
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start', weekStart)
    setSchedules(data || [])
    setLoading(false)
  }

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Check if staff member is on approved leave for a given day
  function isOnLeave(staffId, dayIdx) {
    const date = toISO(weekDates[dayIdx])
    return approvedLeaves.some(l => l.staff_id === staffId && date >= l.date_from && date <= l.date_to)
  }

  function getLeaveType(staffId, dayIdx) {
    const date = toISO(weekDates[dayIdx])
    return approvedLeaves.find(l => l.staff_id === staffId && date >= l.date_from && date <= l.date_to)
  }

  // Get assigned staff for a cell
  function getCellAssignments(dayIdx, shiftId) {
    const date = toISO(weekDates[dayIdx])
    return schedules.filter(s => s.shift_date === date && s.shift_type === shiftId)
  }

  // Add assignment
  async function addAssignment(dayIdx, shiftType, staffId) {
    const date = toISO(weekDates[dayIdx])
    // Check already assigned
    if (schedules.some(s => s.shift_date === date && s.shift_type === shiftType && s.staff_id === staffId)) return
    const newRow = {
      staff_id: staffId,
      shift_date: date,
      shift_type: shiftType,
      week_start: weekStart,
      published: false,
    }
    // Optimistic update
    const temp = { ...newRow, id: 'temp_' + Date.now() }
    setSchedules(prev => [...prev, temp])
    const { data, error } = await supabase.from('schedules').insert([newRow]).select().single()
    if (error) {
      setSchedules(prev => prev.filter(s => s.id !== temp.id))
      showToast('❌', error.message)
      return
    }
    setSchedules(prev => prev.map(s => s.id === temp.id ? data : s))
    const s = staff.find(x => x.id === staffId)
    const shift = SHIFTS.find(x => x.id === shiftType)
    showToast('✅', `${s?.first_name} ${s?.last_name} → ${shift?.label} · ${DAYS[dayIdx]}`)
  }

  // Remove assignment
  async function removeAssignment(id) {
    setSchedules(prev => prev.filter(s => s.id !== id))
    await supabase.from('schedules').delete().eq('id', id)
  }

  // Move assignment (drag from cell to cell)
  async function moveAssignment(sourceDate, sourceShift, staffId, targetDayIdx, targetShift) {
    const targetDate = toISO(weekDates[targetDayIdx])
    if (sourceDate === targetDate && sourceShift === targetShift) return
    // Remove old
    const old = schedules.find(s => s.shift_date === sourceDate && s.shift_type === sourceShift && s.staff_id === staffId)
    if (old) await supabase.from('schedules').delete().eq('id', old.id)
    // Add new
    const newRow = { staff_id: staffId, shift_date: targetDate, shift_type: targetShift, week_start: weekStart, published: false }
    const { data } = await supabase.from('schedules').insert([newRow]).select().single()
    if (data) {
      setSchedules(prev => [...prev.filter(s => s.id !== old?.id), data])
      const s = staff.find(x => x.id === staffId)
      const shift = SHIFTS.find(x => x.id === targetShift)
      showToast('🔄', `${s?.first_name} moved to ${shift?.label} · ${DAYS[targetDayIdx]}`)
    }
  }

  // Clear week
  async function clearWeek() {
    if (!confirm('Clear all assignments for this week?')) return
    await supabase.from('schedules').delete().eq('week_start', weekStart)
    setSchedules([])
    showToast('🗑️', 'Week cleared')
  }

  // Publish schedule
  async function publishSchedule() {
    setPublishing(true)
    await supabase.from('schedules').update({ published: true }).eq('week_start', weekStart)
    setSchedules(prev => prev.map(s => ({ ...s, published: true })))
    setShowPublishModal(false)
    setPublishing(false)
    showToast('📣', 'Schedule published! Staff will be notified.')
  }

  const isPublished = schedules.length > 0 && schedules.every(s => s.published)
  const totalAssignments = schedules.length
  const uniqueStaffAssigned = new Set(schedules.map(s => s.staff_id)).size

  // Sidebar staff filtered
  const filteredStaff = staff.filter(s => {
    const q = sidebarSearch.toLowerCase()
    return `${s.first_name} ${s.last_name} ${s.nickname||''}`.toLowerCase().includes(q)
  })

  // Hours per staff this week
  function getStaffWeekHours(staffId) {
    return schedules
      .filter(s => s.staff_id === staffId)
      .reduce((sum, s) => {
        const shift = SHIFTS.find(x => x.id === s.shift_type)
        return sum + (shift?.paid || 0)
      }, 0)
  }

  return (
    <AuthShell>
      {/* TOPBAR */}
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div>
            <div className="topbar-title">Scheduling</div>
            <div className="topbar-sub">{totalAssignments} shifts · {uniqueStaffAssigned} staff assigned</div>
          </div>
          {/* Week nav */}
          <div style={{display:'flex',alignItems:'center',gap:7,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'4px 8px'}}>
            <button onClick={() => setWeekOffset(w => w-1)} style={{width:26,height:26,borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:14,color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',minWidth:130,textAlign:'center'}}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
            </span>
            <button onClick={() => setWeekOffset(w => w+1)} style={{width:26,height:26,borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:14,color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            <button onClick={() => setWeekOffset(0)} style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:5,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',color:'var(--text-muted)',fontFamily:"'DM Sans',sans-serif"}}>TODAY</button>
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button className="btn btn-danger" onClick={clearWeek}>Clear Week</button>
          <button
            onClick={() => setShowPublishModal(true)}
            style={{background:isPublished?'var(--matcha-dark)':'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,transition:'all .15s'}}>
            {isPublished ? '✓ Published' : '📣 Publish Schedule'}
          </button>
        </div>
      </div>

      {/* LEGEND */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'8px 24px',display:'flex',alignItems:'center',gap:16,flexShrink:0,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)'}}>Shifts:</span>
        {SHIFTS.map(sh => (
          <span key={sh.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:600,padding:'3px 9px',borderRadius:20,border:'1.5px solid',
            color: sh.id==='am'?'#4a7a1e':sh.id==='mid'?'#a06000':'#2d5a8a',
            background: sh.id==='am'?'#eef7e4':sh.id==='mid'?'#fef3e2':'#e8f0fb',
            borderColor: sh.id==='am'?'#7ab648':sh.id==='mid'?'#d4a843':'#4a90c4'}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:sh.id==='am'?'#4a7a1e':sh.id==='mid'?'#a06000':'#2d5a8a',display:'inline-block'}}></span>
            {sh.label} — {sh.time}
          </span>
        ))}
        {isPublished && <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'var(--matcha-dark)',background:'var(--matcha-pale)',padding:'3px 9px',borderRadius:8}}>✓ Published this week</span>}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{display:'flex',flex:1,overflow:'hidden',height:'calc(100vh - 116px)'}}>

        {/* SIDEBAR — Staff */}
        <div style={{width:220,flexShrink:0,background:'var(--espresso)',display:'flex',flexDirection:'column',overflowY:'auto',borderRight:'1px solid #2d2010'}}>
          <div style={{padding:'12px 12px 6px',fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'#5a4a30'}}>
            Staff Profiles
          </div>
          <div style={{padding:'0 10px 8px'}}>
            <input
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search…"
              style={{width:'100%',background:'#2d2010',border:'1px solid #3d3020',borderRadius:7,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--cream)',outline:'none'}}
            />
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 10px 12px'}}>
            {filteredStaff.map(s => {
              const weekHrs = getStaffWeekHours(s.id)
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={e => { setDragStaffId(s.id); setDragSource(null); e.dataTransfer.effectAllowed='copy' }}
                  onDragEnd={() => setDragStaffId(null)}
                  style={{background:'#2d2010',border:'1px solid #3d3020',borderRadius:9,padding:'8px 10px',marginBottom:6,cursor:'grab',userSelect:'none',transition:'all .15s',opacity:dragStaffId===s.id?0.4:1}}
                  onMouseEnter={e => { e.currentTarget.style.background='#3d3020'; e.currentTarget.style.borderColor=getRoleColor(s.role) }}
                  onMouseLeave={e => { e.currentTarget.style.background='#2d2010'; e.currentTarget.style.borderColor='#3d3020' }}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(s.first_name,s.last_name)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--cream)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.first_name} {s.last_name}</div>
                      <div style={{fontSize:9,color:'#8a7a60',marginTop:1}}>{s.role}</div>
                    </div>
                    {weekHrs > 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'var(--matcha-light)',background:'#1a1208',padding:'2px 5px',borderRadius:4,flexShrink:0}}>{weekHrs}h</div>}
                    {weekDates.some((_,di)=>isOnLeave(s.id,di)) && <div style={{fontSize:9,fontWeight:700,color:'#c0392b',background:'#fdeaea',padding:'2px 5px',borderRadius:4,flexShrink:0}}>On Leave</div>}
                  </div>
                  {/* Messenger status dot */}
                  <div style={{display:'flex',alignItems:'center',gap:4,marginTop:5}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:'#1877F2'}}></div>
                    <span style={{fontSize:8,color:'#5a4a30'}}>Will receive notification</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CALENDAR */}
        <div style={{flex:1,overflowX:'auto',overflowY:'auto',padding:'14px 20px 20px',background:'var(--surface)'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-muted)',fontSize:13}}>Loading schedule…</div>
          ) : (
            <div style={{minWidth:820,border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',background:'var(--border)',boxShadow:'0 4px 18px rgba(26,18,8,.06)'}}>

              {/* Header row */}
              <div style={{display:'grid',gridTemplateColumns:'80px repeat(7,1fr)'}}>
                <div style={{background:'#2d2010',padding:'11px 8px',textAlign:'center'}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'#5a4a30'}}>SHIFT</div>
                </div>
                {weekDates.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString()
                  return (
                    <div key={i} style={{background:'var(--espresso)',padding:'11px 7px',textAlign:'center',borderLeft:'1px solid #2d2010'}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:isToday?'var(--matcha-light)':'#8a7a60'}}>{DAYS[i]}</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,color:isToday?'var(--matcha-light)':'var(--cream)',marginTop:2,lineHeight:1}}>
                        {d.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Shift rows */}
              {SHIFTS.map(shift => (
                <div key={shift.id} style={{display:'grid',gridTemplateColumns:'80px repeat(7,1fr)'}}>
                  {/* Row label */}
                  <div style={{background:'var(--white)',padding:'10px 6px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',borderTop:'1px solid var(--border)'}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',writingMode:'vertical-rl',textOrientation:'mixed',transform:'rotate(180deg)',
                      color:shift.id==='am'?'#4a7a1e':shift.id==='mid'?'#a06000':'#2d5a8a'}}>
                      {shift.label}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:'var(--text-muted)',marginTop:5,writingMode:'vertical-rl',textOrientation:'mixed',transform:'rotate(180deg)',lineHeight:1.3}}>
                      {shift.time}
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDates.map((d, dayIdx) => {
                    const assignments = getCellAssignments(dayIdx, shift.id)
                    const cellBg = shift.id==='am'?'#eef7e4':shift.id==='mid'?'#fef3e2':'#e8f0fb'
                    const cellBorder = shift.id==='am'?'#7ab648':shift.id==='mid'?'#d4a843':'#4a90c4'

                    return (
                      <div
                        key={dayIdx}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.outline=`2px dashed ${cellBorder}`; e.currentTarget.style.background=cellBg }}
                        onDragLeave={e => { e.currentTarget.style.outline=''; e.currentTarget.style.background='' }}
                        onDrop={e => {
                          e.preventDefault()
                          e.currentTarget.style.outline=''
                          e.currentTarget.style.background=''
                          if (dragStaffId && isOnLeave(dragStaffId, dayIdx)) {
                            showToast('🚫', 'This staff member is on approved leave for this date')
                          } else if (dragSource) {
                            moveAssignment(dragSource.date, dragSource.shiftType, dragStaffId, dayIdx, shift.id)
                          } else if (dragStaffId) {
                            addAssignment(dayIdx, shift.id, dragStaffId)
                          }
                          setDragStaffId(null)
                          setDragSource(null)
                        }}
                        style={{background:'var(--white)',borderTop:'1px solid var(--border)',borderLeft:'1px solid var(--border)',padding:5,minHeight:100,position:'relative',transition:'background .1s'}}>

                        {assignments.length === 0 && (
                          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                            <div style={{fontSize:9,color:'var(--border)',textAlign:'center',lineHeight:1.5}}>Drop<br/>profile</div>
                          </div>
                        )}

                        {assignments.map(asgn => {
                          const s = staff.find(x => x.id === asgn.staff_id)
                          if (!s) return null
                          const chipColor = shift.id==='am'?'#4a7a1e':shift.id==='mid'?'#a06000':'#2d5a8a'
                          return (
                            <div
                              key={asgn.id}
                              draggable
                              onDragStart={e => {
                                setDragStaffId(s.id)
                                setDragSource({ date: toISO(d), shiftType: shift.id })
                                e.dataTransfer.effectAllowed='move'
                                e.stopPropagation()
                              }}
                              style={{display:'flex',alignItems:'center',gap:5,borderRadius:7,padding:'5px 7px',marginBottom:3,cursor:'grab',border:'1.5px solid',
                                background: shift.id==='am'?'#eef7e4':shift.id==='mid'?'#fef3e2':'#e8f0fb',
                                borderColor: cellBorder,
                                transition:'all .12s'}}
                              onMouseEnter={e => e.currentTarget.querySelector('.chip-remove').style.opacity='1'}
                              onMouseLeave={e => e.currentTarget.querySelector('.chip-remove').style.opacity='0'}>
                              <div style={{width:18,height:18,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'white',flexShrink:0}}>
                                {initials(s.first_name,s.last_name)}
                              </div>
                              <span style={{fontSize:10,fontWeight:600,color:chipColor,flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                {s.nickname || s.first_name}
                              </span>
                              <span
                                className="chip-remove"
                                onClick={() => removeAssignment(asgn.id)}
                                style={{width:13,height:13,borderRadius:'50%',background:'rgba(0,0,0,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white',opacity:0,cursor:'pointer',transition:'opacity .12s',flexShrink:0,lineHeight:1}}>
                                ×
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Hours summary */}
          {schedules.length > 0 && (
            <div style={{marginTop:14,background:'var(--white)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',flexShrink:0}}>Hours This Week:</span>
              {staff.filter(s => getStaffWeekHours(s.id) > 0).sort((a,b) => getStaffWeekHours(b.id)-getStaffWeekHours(a.id)).map(s => (
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'3px 8px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,flexShrink:0}}>
                  <div style={{width:16,height:16,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'white'}}>
                    {initials(s.first_name,s.last_name)}
                  </div>
                  <span style={{fontWeight:600,color:'var(--espresso)'}}>{s.nickname||s.first_name}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{getStaffWeekHours(s.id)}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PUBLISH MODAL */}
      {showPublishModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e => e.target===e.currentTarget&&setShowPublishModal(false)}>
          <div style={{background:'var(--white)',borderRadius:18,padding:28,width:460,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{fontSize:32,marginBottom:10}}>📣</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:19,fontWeight:700,marginBottom:6}}>Publish Schedule?</div>
            <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:16}}>
              The following staff will be notified of their shifts for <strong>{fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}</strong> via Messenger.
            </div>

            {/* Summary */}
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:16,maxHeight:200,overflowY:'auto'}}>
              {[...new Set(schedules.map(s => s.staff_id))].map(sid => {
                const s = staff.find(x => x.id === sid)
                if (!s) return null
                const shifts = schedules.filter(x => x.staff_id === sid)
                return (
                  <div key={sid} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:12}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(s.first_name,s.last_name)}
                    </div>
                    <span style={{fontWeight:600,flex:1}}>{s.first_name} {s.last_name}</span>
                    <span style={{color:'var(--text-muted)',fontSize:11}}>{shifts.length} shift{shifts.length!==1?'s':''}</span>
                    <span style={{color:'#1877F2',fontSize:10,fontWeight:600}}>💬 Notify</span>
                  </div>
                )
              })}
            </div>

            <div style={{display:'flex',gap:9}}>
              <button onClick={() => setShowPublishModal(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:9,padding:'11px 18px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
              <button onClick={publishSchedule} disabled={publishing}
                style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:9,padding:11,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {publishing ? 'Publishing…' : '✓ Publish & Notify Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
