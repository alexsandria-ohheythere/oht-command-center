'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM',  color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648', emoji:'🌅' },
  { id:'ops', label:'OPS', time:'8:00AM–5:00PM',  color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5', emoji:'🟣' },
  { id:'mid', label:'MID', time:'11:00AM–8:00PM', color:'#a06000', bg:'#fef3e2', border:'#d4a843', emoji:'☀️'  },
  { id:'pm',  label:'PM',  time:'3:00PM–11:00PM', color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4', emoji:'🌙' },
]
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : ''

function ScoreRing({ pct, color, size=56 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0ede8" strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct===100?'#7ab648':color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset .5s ease' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize:11, fontWeight:700, fill:pct===100?'#4a7a1e':color, fontFamily:"'Montserrat',sans-serif", transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px` }}>
        {pct}%
      </text>
    </svg>
  )
}

export default function CheckinPage() {
  const supabase = createClient()
  const todayISO = toISO(new Date())

  const [viewDate, setViewDate]           = useState(new Date())
  const [staff, setStaff]                 = useState([])
  const [selectedShift, setSelectedShift] = useState('am')
  const [assignments, setAssignments]     = useState([])
  const [tasks, setTasks]                 = useState([])
  const [checkIns, setCheckIns]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [view, setView]                   = useState('overview')
  const [saving, setSaving]               = useState(null)
  const [toast, setToast]                 = useState(null)

  const dateISO   = toISO(viewDate)
  const isToday   = dateISO === todayISO
  const isPast    = dateISO < todayISO
  const dateLabel = viewDate.toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

  useEffect(() => {
    setView('overview')
    setSelectedStaff(null)
    fetchAll()
  }, [dateISO])

  async function fetchAll() {
    setLoading(true)
    try {
      const [{ data: s, error: e1 }, { data: sch, error: e2 }, { data: t, error: e3 }, { data: ci, error: e4 }] = await Promise.all([
        supabase.from('staff').select('*').order('last_name'),
        supabase.from('schedules').select('*').eq('shift_date', dateISO),
        supabase.from('role_tasks').select('*').eq('is_active', true).order('task_order'),
        supabase.from('shift_task_assignments').select('*').eq('shift_date', dateISO),
      ])
      if (e1) console.error('staff fetch error:', e1)
      if (e2) console.error('schedules fetch error:', e2)
      if (e3) console.error('role_tasks fetch error:', e3)
      if (e4) console.error('shift_task_assignments fetch error:', e4)
      setStaff(s||[])
      setAssignments(sch||[])
      setTasks(t||[])
      setCheckIns(ci||[])
    } catch (err) {
      console.error('fetchAll failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function goToPrevDay() {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - 1)
    setViewDate(d)
  }

  function goToNextDay() {
    if (isToday) return
    const d = new Date(viewDate)
    d.setDate(d.getDate() + 1)
    setViewDate(d)
  }

  function goToToday() {
    setViewDate(new Date())
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}

  function getScheduledStaff(shiftId) {
    return assignments.filter(a=>a.shift_type===shiftId).map(a=>staff.find(s=>s.id===a.staff_id)).filter(Boolean)
  }

  function getStaffTasks(staffId, shiftId) {
    return checkIns.filter(ci => ci.staff_id===staffId && ci.shift_type===shiftId)
  }

  function getScore(staffId, shiftId) {
    const all = getStaffTasks(staffId, shiftId)
    const done = all.filter(ci=>ci.completed).length
    return { total:all.length, done, pct: all.length>0?Math.round((done/all.length)*100):0 }
  }

  async function openDetail(staffMember, shiftId) {
    setSelectedStaff(staffMember)
    setSelectedShift(shiftId)
    setView('detail')
    // Only auto-assign tasks on today — don't create tasks for past dates
    if (isToday) {
      const existing = checkIns.filter(ci=>ci.staff_id===staffMember.id&&ci.shift_type===shiftId)
      if (existing.length === 0) {
        const roleTasks = tasks.filter(t=>t.role===staffMember.role&&t.shift_type===shiftId)
        if (roleTasks.length > 0) {
          const schedEntry = assignments.find(a=>a.staff_id===staffMember.id&&a.shift_type===shiftId)
          const inserts = roleTasks.map(t=>({ schedule_id:schedEntry?.id||null, task_id:t.id, staff_id:staffMember.id, shift_date:dateISO, shift_type:shiftId, completed:false, completed_at:null }))
          const { data } = await supabase.from('shift_task_assignments').insert(inserts).select()
          if (data) setCheckIns(prev=>[...prev,...data])
        }
      }
    }
  }

  async function toggleTask(ciId, completed) {
    if (isPast) return // read-only for past dates
    setSaving(ciId)
    const completed_at = completed ? new Date().toISOString() : null
    const { data } = await supabase.from('shift_task_assignments').update({ completed, completed_at }).eq('id', ciId).select().single()
    if (data) setCheckIns(prev=>prev.map(ci=>ci.id===ciId?data:ci))
    setSaving(null)
  }

  const shiftOverview = SHIFTS.map(sh => {
    const shiftStaff = getScheduledStaff(sh.id)
    const scores = shiftStaff.map(s => getScore(s.id, sh.id))
    const totalTasks = scores.reduce((a,sc)=>a+sc.total,0)
    const doneTasks  = scores.reduce((a,sc)=>a+sc.done,0)
    const avgPct = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : null
    return { ...sh, staff:shiftStaff, totalTasks, doneTasks, avgPct, scores }
  })

  const detailTasks = selectedStaff ? getStaffTasks(selectedStaff.id, selectedShift) : []
  const detailScore = selectedStaff ? getScore(selectedStaff.id, selectedShift) : { total:0, done:0, pct:0 }
  const detailShift = SHIFTS.find(s=>s.id===selectedShift)

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Daily Check-In</div>
          <div className="topbar-sub" style={{display:'flex',alignItems:'center',gap:8}}>
            {/* Date navigator */}
            <button onClick={goToPrevDay}
              style={{background:'none',border:'1px solid var(--border)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}>
              ‹
            </button>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11}}>
              {isToday ? `Today · ${dateLabel}` : isPast ? `${dateLabel}` : dateLabel}
            </span>
            <button onClick={goToNextDay} disabled={isToday}
              style={{background:'none',border:'1px solid var(--border)',borderRadius:6,width:24,height:24,cursor:isToday?'not-allowed':'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:isToday?'var(--border)':'var(--text-muted)',opacity:isToday?.4:1}}>
              ›
            </button>
            {!isToday && (
              <button onClick={goToToday}
                style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:6,padding:'2px 10px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginLeft:4}}>
                Today
              </button>
            )}
          </div>
        </div>
        {view==='detail'&&<button className="btn btn-secondary" onClick={()=>setView('overview')}>← Back</button>}
      </div>

      <div className="page-content">

        {/* Past date banner */}
        {isPast && (
          <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,fontSize:12}}>
            <span style={{fontSize:16}}>📅</span>
            <span style={{color:'#a06000',fontWeight:600}}>Viewing past check-in — read-only</span>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {view==='overview'&&(
          <>
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              {SHIFTS.map(sh=>(
                <button key={sh.id} onClick={()=>setSelectedShift(sh.id)}
                  style={{padding:'8px 18px',borderRadius:9,border:`1.5px solid ${selectedShift===sh.id?sh.border:'var(--border)'}`,background:selectedShift===sh.id?sh.bg:'var(--white)',color:selectedShift===sh.id?sh.color:'var(--text-muted)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s',display:'flex',alignItems:'center',gap:6}}>
                  {sh.emoji} {sh.label} Shift
                  <span style={{opacity:.7,fontSize:10}}>({getScheduledStaff(sh.id).length})</span>
                </button>
              ))}
            </div>

            {(() => {
              const sh = shiftOverview.find(s=>s.id===selectedShift)
              if (!sh || sh.staff.length===0) return (
                <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                  <div style={{fontSize:36,marginBottom:12}}>{sh?.emoji||'📅'}</div>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700}}>No staff scheduled for {sh?.label} {isToday?'today':'on this day'}</div>
                </div>
              )
              return (
                <>
                  {sh.avgPct !== null && (
                    <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:20}}>
                      <ScoreRing pct={sh.avgPct} color={sh.color} size={64}/>
                      <div>
                        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700}}>{sh.emoji} {sh.label} Shift Progress</div>
                        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{sh.doneTasks} of {sh.totalTasks} tasks completed across {sh.staff.length} staff</div>
                        <div style={{height:6,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden',width:200,marginTop:8}}>
                          <div style={{height:'100%',width:`${sh.avgPct}%`,background:sh.avgPct===100?'var(--matcha)':sh.border,borderRadius:4,transition:'width .5s'}}/>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                    {sh.staff.map(s=>{
                      const score = getScore(s.id, selectedShift)
                      return (
                        <div key={s.id} onClick={()=>openDetail(s,selectedShift)}
                          style={{background:'var(--white)',border:`1px solid ${score.pct===100?'var(--matcha)':'var(--border)'}`,borderRadius:13,padding:'16px',cursor:'pointer',transition:'all .2s',borderTop:`3px solid ${getRoleColor(s.role)}`}}
                          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)'}}
                          onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                              {initials(s.first_name,s.last_name)}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                              <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.role}</div>
                            </div>
                            <ScoreRing pct={score.pct} color={getRoleColor(s.role)} size={48}/>
                          </div>
                          {score.total > 0 ? (
                            <>
                              <div style={{height:5,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden',marginBottom:5}}>
                                <div style={{height:'100%',width:`${score.pct}%`,background:score.pct===100?'var(--matcha)':getRoleColor(s.role),borderRadius:4,transition:'width .3s'}}/>
                              </div>
                              <div style={{fontSize:10,color:'var(--text-muted)'}}>{score.done}/{score.total} tasks · {score.pct===100?'✅ Complete':'In progress'}</div>
                            </>
                          ) : (
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>
                              {isPast ? 'No check-in recorded' : 'Tap to assign & start check-in'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </>
        )}

        {/* ── DETAIL ── */}
        {view==='detail'&&selectedStaff&&(
          <div style={{maxWidth:560,margin:'0 auto'}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 22px',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:getRoleColor(selectedStaff.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(selectedStaff.first_name,selectedStaff.last_name)}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700}}>{selectedStaff.first_name} {selectedStaff.last_name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{selectedStaff.role} · <span style={{color:detailShift?.color,fontWeight:600}}>{detailShift?.emoji} {detailShift?.label} Shift</span></div>
              </div>
              <ScoreRing pct={detailScore.pct} color={detailShift?.color||'#7ab648'} size={64}/>
            </div>

            {detailTasks.length>0&&(
              <div style={{height:8,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden',marginBottom:14}}>
                <div style={{height:'100%',width:`${detailScore.pct}%`,background:detailScore.pct===100?'var(--matcha)':detailShift?.border,borderRadius:4,transition:'width .4s'}}/>
              </div>
            )}

            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',marginBottom:12}}>
              <div style={{background:detailShift?.bg,padding:'11px 16px',borderBottom:`1px solid ${detailShift?.border}33`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:11,fontWeight:700,color:detailShift?.color}}>
                  {isToday ? "Today's" : dateLabel.split(',')[0] + "'s"} Checklist · {detailScore.done}/{detailScore.total}
                </span>
                <span style={{fontSize:13,fontWeight:700,color:detailScore.pct===100?'var(--matcha-dark)':detailShift?.color}}>{detailScore.pct}%</span>
              </div>
              {detailTasks.length===0?(
                <div style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>
                  {isPast ? 'No tasks were recorded for this shift.' : 'No tasks assigned — tasks auto-load from Role Templates.'}
                </div>
              ):detailTasks.map(ci=>{
                const task = tasks.find(t=>t.id===ci.task_id)
                return (
                  <div key={ci.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:'1px solid var(--cream-dark)',background:ci.completed?'#f8fdf5':'var(--white)',transition:'background .2s'}}>
                    <button onClick={()=>toggleTask(ci.id,!ci.completed)} disabled={saving===ci.id||isPast}
                      style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${ci.completed?'var(--matcha)':detailShift?.border}`,background:ci.completed?'var(--matcha)':'transparent',cursor:isPast?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',flexShrink:0,opacity:isPast?.7:1}}>
                      {ci.completed&&<span style={{color:'white',fontSize:12,fontWeight:700}}>✓</span>}
                    </button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:500,color:ci.completed?'var(--text-muted)':'var(--espresso)',textDecoration:ci.completed?'line-through':'none'}}>
                        {task?.task_name||'Task'}
                      </div>
                      {ci.completed&&ci.completed_at&&(
                        <div style={{fontSize:10,color:'var(--matcha-dark)',marginTop:2,fontFamily:"'DM Mono',monospace"}}>✓ {fmtTime(ci.completed_at)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {detailScore.pct===100&&detailTasks.length>0&&(
              <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:12,padding:'16px',textAlign:'center'}}>
                <div style={{fontSize:28,marginBottom:6}}>🎉</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,color:'var(--matcha-dark)'}}>100% Complete!</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{selectedStaff.first_name} finished all {detailShift?.label} tasks {isToday?'today':'on this day'}</div>
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
