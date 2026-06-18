'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

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
const fmtShort = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '—'
const fmtFull  = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '—'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

export default function DayOffPage() {
  const supabase = createClient()
  const today = new Date()

  const [staff,    setStaff]    = useState([])
  const [dayOffs,  setDayOffs]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  // Drag state
  const [dragging,   setDragging]   = useState(null)   // { staff_id, name, role }
  const [dragOver,   setDragOver]   = useState(null)    // 'YYYY-MM-DD'
  const [confirmBox, setConfirmBox] = useState(null)    // { staff, iso } pending confirm

  // Staff search filter
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data:s }, { data:d }] = await Promise.all([
      supabase.from('staff').select('id,first_name,last_name,nickname,role,employment_status').order('last_name'),
      supabase.from('day_offs').select('*, staff(first_name,last_name,nickname,role)').order('date_from',{ascending:false}),
    ])
    setStaff(s||[])
    setDayOffs(d||[])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3200) }

  // ── Drag handlers ──────────────────────────────────────────────
  function onDragStart(e, member) {
    setDragging({ staff_id: member.id, name: member.nickname || member.first_name, fullName: `${member.first_name} ${member.last_name}`, role: member.role })
    e.dataTransfer.effectAllowed = 'copy'
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }

  function onCellDragOver(e, iso) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(iso)
  }
  function onCellDragLeave() { setDragOver(null) }

  function onCellDrop(e, iso) {
    e.preventDefault()
    setDragOver(null)
    if (!dragging) return
    // Check if already assigned that day
    const already = calDayOffMap[iso]?.some(x => x.staff_id === dragging.staff_id)
    if (already) { showToast('⚠️', `${dragging.name} already has a day-off on ${fmtShort(iso)}`); return }
    setConfirmBox({ staff: dragging, iso })
    setDragging(null)
  }

  // ── Touch drag (mobile fallback) ───────────────────────────────
  const touchStaff = useRef(null)
  const ghostRef   = useRef(null)

  function onTouchStart(e, member) {
    touchStaff.current = { staff_id: member.id, name: member.nickname || member.first_name, fullName: `${member.first_name} ${member.last_name}`, role: member.role }
    const ghost = document.createElement('div')
    ghost.id = 'touch-ghost'
    ghost.textContent = touchStaff.current.name
    Object.assign(ghost.style, {
      position:'fixed', pointerEvents:'none', zIndex:9999,
      background: getRoleColor(member.role), color:'white',
      padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:700,
      boxShadow:'0 4px 16px rgba(0,0,0,.25)', opacity:0.9,
    })
    document.body.appendChild(ghost)
    ghostRef.current = ghost
  }

  function onTouchMove(e) {
    if (!touchStaff.current) return
    const t = e.touches[0]
    if (ghostRef.current) {
      ghostRef.current.style.left = (t.clientX - 40) + 'px'
      ghostRef.current.style.top  = (t.clientY - 20) + 'px'
    }
    // Highlight cell under finger
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const cell = el?.closest('[data-iso]')
    setDragOver(cell ? cell.dataset.iso : null)
  }

  function onTouchEnd(e) {
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null }
    const t = e.changedTouches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const cell = el?.closest('[data-iso]')
    if (cell && touchStaff.current) {
      const iso = cell.dataset.iso
      const already = calDayOffMap[iso]?.some(x => x.staff_id === touchStaff.current.staff_id)
      if (already) { showToast('⚠️', `${touchStaff.current.name} already has a day-off on ${fmtShort(iso)}`); touchStaff.current = null; setDragOver(null); return }
      setConfirmBox({ staff: touchStaff.current, iso })
    }
    touchStaff.current = null
    setDragOver(null)
  }

  // ── Save confirmed day-off ─────────────────────────────────────
  async function confirmAssign() {
    if (!confirmBox) return
    setSaving(true)
    const { staff: s, iso } = confirmBox
    const { error } = await supabase.from('day_offs').insert([{
      staff_id: s.staff_id, date_from: iso, date_to: iso, reason: null,
    }])
    if (error) { showToast('❌', error.message); setSaving(false); setConfirmBox(null); return }
    await notifyOne(s.staff_id, {
      type:'general',
      title:'📆 Day-Off Assigned',
      message:`You have been assigned a day-off on ${fmtFull(iso)}. You won't be scheduled for any shift on this date.`,
    })
    await fetchAll()
    setConfirmBox(null)
    showToast('✅', `Day-off saved for ${s.name} on ${fmtShort(iso)}`)
    setSaving(false)
  }

  async function deleteDayOff(id, staffName, iso) {
    setDeleting(id)
    const { error } = await supabase.from('day_offs').delete().eq('id', id)
    if (error) { showToast('❌', error.message); setDeleting(null); return }
    await fetchAll()
    showToast('🗑️', `Day-off removed`)
    setDeleting(null)
  }

  // ── Calendar helpers ───────────────────────────────────────────
  const calDayOffMap = (() => {
    const map = {}
    dayOffs.forEach(d => {
      const from = new Date(d.date_from+'T00:00:00')
      const to   = new Date(d.date_to+'T00:00:00')
      const cur  = new Date(from)
      while (cur <= to) {
        const iso = toISO(cur)
        if (!map[iso]) map[iso] = []
        map[iso].push({ name: d.staff?.nickname || d.staff?.first_name || '?', role: d.staff?.role, staff_id: d.staff_id, id: d.id })
        cur.setDate(cur.getDate()+1)
      }
    })
    return map
  })()

  function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate() }
  function getFirstDay(y,m)    { return new Date(y,m,1).getDay() }

  const filteredStaff = staff.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.first_name+' '+s.last_name+' '+(s.nickname||'')).toLowerCase().includes(q)
  })

  // Stats
  const todayISO = toISO(today)
  const upcomingCount = Object.keys(calDayOffMap).filter(iso => iso >= todayISO).length

  // ── Render ─────────────────────────────────────────────────────
  return (
    <AuthShell requiredPermission='schedule'>
      {/* Touch event listeners on body for mobile drag */}
      <div
        style={{padding:'24px 28px',fontFamily:"'DM Sans',sans-serif",height:'100vh',boxSizing:'border-box',display:'flex',flexDirection:'column',overflow:'hidden'}}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div style={{marginBottom:16,flexShrink:0}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:800,color:'var(--text-primary)'}}>📆 Day-Off Manager</h1>
          <p style={{margin:'3px 0 0',fontSize:11,color:'var(--text-muted)'}}>Drag a staff name onto any calendar date to assign a day-off · Staff are blocked from scheduling on that date</p>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16,flexShrink:0}}>
          {[
            { label:'Total', value: dayOffs.length, icon:'📅', color:'#4a90c4', bg:'#e8f0fb' },
            { label:'This Month', value: dayOffs.filter(d=>{ const f=new Date(d.date_from+'T00:00:00'); return f.getMonth()===calMonth&&f.getFullYear()===calYear }).length, icon:'🗓️', color:'#a06000', bg:'#fef3e2' },
            { label:'Upcoming', value: upcomingCount, icon:'🔜', color:'#4a7a1e', bg:'#eef7e4' },
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

        {/* Main layout: Staff panel | Calendar */}
        <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16,flex:1,minHeight:0}}>

          {/* ── Staff Roster Panel ── */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 12px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:10}}>Staff — Drag to assign</div>

            {/* Search */}
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder='Search…'
              style={{width:'100%',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',marginBottom:10,boxSizing:'border-box'}}
            />

            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
              {loading ? (
                <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',paddingTop:20}}>Loading…</div>
              ) : filteredStaff.map(member => {
                const color = getRoleColor(member.role)
                return (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={e=>onDragStart(e,member)}
                    onDragEnd={onDragEnd}
                    onTouchStart={e=>onTouchStart(e,member)}
                    style={{
                      display:'flex',alignItems:'center',gap:8,
                      padding:'7px 10px',borderRadius:8,
                      background:`${color}14`,border:`1px solid ${color}33`,
                      cursor:'grab',userSelect:'none',
                      transition:'transform .1s,box-shadow .1s',
                    }}
                    onMouseDown={e=>e.currentTarget.style.cursor='grabbing'}
                    onMouseUp={e=>e.currentTarget.style.cursor='grab'}
                  >
                    <div style={{width:26,height:26,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(member.first_name,member.last_name)}
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {member.nickname || member.first_name}
                      </div>
                      <div style={{fontSize:9,color:color,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{member.role}</div>
                    </div>
                    <div style={{marginLeft:'auto',fontSize:12,opacity:.35,flexShrink:0}}>⠿</div>
                  </div>
                )
              })}
            </div>

            {/* Drag hint */}
            <div style={{marginTop:10,padding:'8px 10px',background:'#eef7e4',border:'1px solid #7ab64844',borderRadius:8,fontSize:9.5,color:'#4a7a1e',lineHeight:1.5,flexShrink:0}}>
              👆 Drag any name to a calendar date to assign a day-off
            </div>
          </div>

          {/* ── Calendar Panel ── */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Month nav */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexShrink:0}}>
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

            {/* Calendar grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,flex:1,gridAutoRows:'1fr'}}>
              {(() => {
                const daysInMonth = getDaysInMonth(calYear,calMonth)
                const firstDay    = getFirstDay(calYear,calMonth)
                const cells = []

                for (let i=0;i<firstDay;i++) cells.push(
                  <div key={`e${i}`} style={{background:'transparent'}} />
                )

                for (let day=1;day<=daysInMonth;day++) {
                  const iso = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const entries  = calDayOffMap[iso] || []
                  const isToday  = iso === todayISO
                  const isOver   = dragOver === iso
                  const isPast   = iso < todayISO

                  cells.push(
                    <div
                      key={iso}
                      data-iso={iso}
                      onDragOver={e=>onCellDragOver(e,iso)}
                      onDragLeave={onCellDragLeave}
                      onDrop={e=>onCellDrop(e,iso)}
                      style={{
                        borderRadius:8,
                        padding:'5px 5px 4px',
                        border: isOver   ? '2px dashed #EF4576'
                               : isToday ? '2px solid #EF4576'
                               : entries.length ? '1px solid #d4a84355'
                               : '1px solid var(--border)',
                        background: isOver   ? '#EF457612'
                                  : entries.length ? '#fef3e2'
                                  : isPast ? 'var(--bg)'
                                  : 'var(--surface)',
                        opacity: isPast && !entries.length ? 0.5 : 1,
                        transition:'border .1s,background .1s',
                        overflow:'hidden',
                        display:'flex',
                        flexDirection:'column',
                        minHeight:0,
                      }}
                    >
                      {/* Day number */}
                      <div style={{fontSize:10,fontWeight:isToday?800:500,color:isToday?'#EF4576':isOver?'#EF4576':'var(--text-secondary)',marginBottom:3,flexShrink:0}}>
                        {day}
                        {isOver && <span style={{marginLeft:4,fontSize:9,fontWeight:700,color:'#EF4576'}}>drop</span>}
                      </div>

                      {/* Assigned staff chips */}
                      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',gap:2}}>
                        {entries.slice(0,3).map((e,ei)=>(
                          <div key={ei}
                            style={{
                              display:'flex',alignItems:'center',gap:3,
                              background:'white',border:`1px solid ${getRoleColor(e.role)}44`,
                              borderRadius:4,padding:'2px 4px',
                            }}
                          >
                            <div style={{width:10,height:10,borderRadius:'50%',background:getRoleColor(e.role),flexShrink:0}} />
                            <span style={{fontSize:8,fontWeight:700,color:getRoleColor(e.role),flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</span>
                            <button
                              onClick={()=>deleteDayOff(e.id,e.name,iso)}
                              disabled={deleting===e.id}
                              style={{background:'none',border:'none',cursor:'pointer',fontSize:8,lineHeight:1,padding:0,color:'#c0392b',opacity:deleting===e.id?0.3:0.6,flexShrink:0}}
                              title='Remove'
                            >✕</button>
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <div style={{fontSize:7.5,color:'var(--text-muted)',fontWeight:700,paddingLeft:2}}>+{entries.length-3} more</div>
                        )}
                      </div>
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
            <div style={{background:'var(--surface)',borderRadius:16,padding:'28px 32px',width:340,boxShadow:'0 8px 40px rgba(0,0,0,.2)',fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:8,textAlign:'center'}}>📆</div>
              <div style={{fontWeight:800,fontSize:16,textAlign:'center',color:'var(--text-primary)',marginBottom:6}}>Assign Day-Off?</div>
              <div style={{fontSize:13,color:'var(--text-secondary)',textAlign:'center',marginBottom:24,lineHeight:1.6}}>
                <strong style={{color:getRoleColor(confirmBox.staff.role)}}>{confirmBox.staff.fullName}</strong>
                <br/>will have a day-off on<br/>
                <strong style={{color:'var(--text-primary)'}}>{fmtFull(confirmBox.iso)}</strong>
                <br/><span style={{fontSize:11,color:'var(--text-muted)'}}>They won't appear in scheduling on this date.</span>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setConfirmBox(null)}
                  style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text-primary)',borderRadius:9,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  Cancel
                </button>
                <button onClick={confirmAssign} disabled={saving}
                  style={{flex:2,background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?.65:1,fontFamily:"'DM Sans',sans-serif"}}>
                  {saving ? 'Saving…' : '✅ Confirm'}
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
