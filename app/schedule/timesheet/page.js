'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM', paid:8, color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'ops', label:'OPS', time:'8:00AM–5:00PM', paid:8, color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5' },
  { id:'mid', label:'MID', time:'11AM–8PM',       paid:8, color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM',  time:'3PM–11PM',       paid:7, color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]

const LEADERSHIP_ROLES = ['Managing Director','CEO']
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => {
  if (!r) return '#7a6a50'
  if (r.startsWith('Junior Barista')) return '#e8845a'
  return ROLE_COLORS[r] || '#7a6a50'
}
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
const fmtDateShort = d => d.toLocaleDateString('en-PH',{month:'short',day:'numeric',weekday:'short'})

export default function TimesheetPage() {
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [schedules, setSchedules]   = useState([])
  const [dayOffsData, setDayOffsData] = useState([])
  const [approvedLeaves, setApprovedLeaves] = useState([])
  const [loading, setLoading]       = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [onlyAssigned, setOnlyAssigned] = useState(false)

  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])

  useEffect(()=>{ fetchStaff() },[])
  useEffect(()=>{ if(staff.length) fetchWeekData() },[weekOffset,staff])

  async function fetchStaff() {
    const {data} = await supabase.from('staff').select('*').order('last_name')
    setStaff(data||[])
  }

  async function fetchWeekData() {
    setLoading(true)
    const [{data:sch},{data:offs},{data:lv}] = await Promise.all([
      supabase.from('schedules').select('*').eq('week_start',weekStart),
      supabase.from('day_offs').select('staff_id,date_from,date_to'),
      supabase.from('leave_requests').select('staff_id,date_from,date_to,leave_type').eq('status','approved'),
    ])
    setSchedules(sch||[])
    setDayOffsData(offs||[])
    setApprovedLeaves(lv||[])
    setLoading(false)
  }

  function isOnDayOff(staffId, iso) {
    return dayOffsData.some(d=>d.staff_id===staffId && iso>=d.date_from && iso<=d.date_to)
  }
  function isOnLeave(staffId, iso) {
    return approvedLeaves.some(l=>l.staff_id===staffId && iso>=l.date_from && iso<=l.date_to)
  }
  function entriesFor(staffId, iso) {
    return schedules.filter(s=>s.staff_id===staffId && s.shift_date===iso)
  }
  function weekHours(staffId) {
    return schedules.filter(s=>s.staff_id===staffId).reduce((sum,s)=>{
      const sh = SHIFTS.find(x=>x.id===s.shift_type); return sum+(sh?.paid||0)
    },0)
  }
  function weekShiftCount(staffId) {
    return new Set(schedules.filter(s=>s.staff_id===staffId).map(s=>s.shift_date)).size
  }

  const roleOptions = [...new Set(staff.filter(s=>!LEADERSHIP_ROLES.includes(s.role)).map(s=>s.role))].filter(Boolean).sort()

  const rows = staff
    .filter(s=>!LEADERSHIP_ROLES.includes(s.role))
    .filter(s=>roleFilter==='all' || s.role===roleFilter)
    .filter(s=>{
      const q = search.toLowerCase()
      return !q || `${s.first_name} ${s.last_name} ${s.nickname||''}`.toLowerCase().includes(q)
    })
    .filter(s=> !onlyAssigned || weekShiftCount(s.id)>0)
    .sort((a,b)=> weekShiftCount(b.id)-weekShiftCount(a.id) || (a.last_name||'').localeCompare(b.last_name||''))

  const grandShifts = schedules.length
  const grandHours  = rows.reduce((sum,s)=>sum+weekHours(s.id),0)
  const staffScheduledCount = new Set(schedules.map(s=>s.staff_id)).size
  const isPublished = schedules.length>0 && schedules.every(s=>s.published)

  const dayTotals = weekDates.map(d=>{
    const iso = toISO(d)
    return new Set(schedules.filter(s=>s.shift_date===iso).map(s=>s.staff_id)).size
  })

  function exportCSV() {
    const header = ['Staff','Role',...weekDates.map(d=>fmtDateShort(d)),'Shifts','Hours']
    const lines = [header.join(',')]
    rows.forEach(s=>{
      const cells = weekDates.map(d=>{
        const iso = toISO(d)
        const entries = entriesFor(s.id, iso)
        if (entries.length) return entries.map(e=>SHIFTS.find(x=>x.id===e.shift_type)?.label||e.shift_type).join('+')
        if (isOnLeave(s.id, iso)) return 'LEAVE'
        if (isOnDayOff(s.id, iso)) return 'OFF'
        return ''
      })
      lines.push([`"${s.first_name} ${s.last_name}"`, `"${s.role||''}"`, ...cells, weekShiftCount(s.id), weekHours(s.id)].join(','))
    })
    const blob = new Blob([lines.join('\n')], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `timesheet_${weekStart}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <AuthShell>
      {/* TOPBAR */}
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div>
            <div className="topbar-title">Timesheet</div>
            <div className="topbar-sub">{grandShifts} shifts · {staffScheduledCount} staff · {grandHours}h scheduled {isPublished && schedules.length>0 ? '· ✓ Published' : ''}</div>
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
          <a href="/schedule" style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text-primary)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textDecoration:'none'}}>📅 Calendar View</a>
          <button onClick={exportCSV} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>⬇️ Export CSV</button>
        </div>
      </div>

      <div className="page-content">
        {/* FILTERS */}
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff…"
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',minWidth:160}}/>
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}}>
            <option value="all">All Roles</option>
            {roleOptions.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text-muted)',fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
            <input type="checkbox" checked={onlyAssigned} onChange={e=>setOnlyAssigned(e.target.checked)} />
            Only show assigned staff
          </label>
          <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
            {SHIFTS.map(sh=>(
              <div key={sh.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--text-muted)'}}>
                <span style={{width:10,height:10,borderRadius:3,background:sh.bg,border:`1px solid ${sh.border}`,display:'inline-block'}}/>
                {sh.label}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--text-muted)'}}>
              <span style={{width:10,height:10,borderRadius:3,background:'#fef3e2',border:'1px solid #f5a623',display:'inline-block'}}/>Leave
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--text-muted)'}}>
              <span style={{width:10,height:10,borderRadius:3,background:'#f0ede8',border:'1px solid var(--border)',display:'inline-block'}}/>Day-Off
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading timesheet…</div>
        ) : rows.length===0 ? (
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>🗒️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700}}>No staff to show</div>
          </div>
        ) : (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:"'DM Sans',sans-serif"}}>
              <thead>
                <tr style={{background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1,textTransform:'uppercase',position:'sticky',left:0,background:'var(--surface)'}}>Staff</th>
                  {weekDates.map((d,i)=>(
                    <th key={i} style={{textAlign:'center',padding:'10px 8px',fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1,minWidth:64}}>
                      {DAYS[i]}<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:400,marginTop:2}}>{fmtDate(d)}</div>
                    </th>
                  ))}
                  <th style={{textAlign:'center',padding:'10px 8px',fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1}}>Shifts</th>
                  <th style={{textAlign:'center',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1}}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s=>{
                  const shifts = weekShiftCount(s.id)
                  const hours  = weekHours(s.id)
                  return (
                    <tr key={s.id} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'9px 14px',position:'sticky',left:0,background:'var(--white)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                            {initials(s.first_name,s.last_name)}
                          </div>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>{s.first_name} {s.last_name}</div>
                            <div style={{fontSize:9,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{s.role}</div>
                          </div>
                        </div>
                      </td>
                      {weekDates.map((d,i)=>{
                        const iso = toISO(d)
                        const entries = entriesFor(s.id, iso)
                        const onLeave = isOnLeave(s.id, iso)
                        const onOff   = isOnDayOff(s.id, iso)
                        return (
                          <td key={i} style={{textAlign:'center',padding:'6px 6px'}}>
                            {entries.length>0 ? (
                              <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'center'}}>
                                {entries.map(e=>{
                                  const sh = SHIFTS.find(x=>x.id===e.shift_type)
                                  return (
                                    <span key={e.id} style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:6,background:sh?.bg,color:sh?.color,border:`1px solid ${sh?.border}`,whiteSpace:'nowrap'}}>
                                      {sh?.label||e.shift_type}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : onLeave ? (
                              <span style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:6,background:'#fef3e2',color:'#a06000',border:'1px solid #f5a623'}}>LEAVE</span>
                            ) : onOff ? (
                              <span style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:6,background:'#f0ede8',color:'var(--text-muted)',border:'1px solid var(--border)'}}>OFF</span>
                            ) : (
                              <span style={{fontSize:11,color:'var(--border)'}}>–</span>
                            )}
                          </td>
                        )
                      })}
                      <td style={{textAlign:'center',padding:'9px 8px',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:shifts>=5?'#4a7a1e':'var(--text-primary)'}}>{shifts}</td>
                      <td style={{textAlign:'center',padding:'9px 14px',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:'var(--matcha-dark)'}}>{hours}h</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--surface)',borderTop:'2px solid var(--border)'}}>
                  <td style={{padding:'9px 14px',fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:1,textTransform:'uppercase',position:'sticky',left:0,background:'var(--surface)'}}>Headcount</td>
                  {dayTotals.map((c,i)=>(
                    <td key={i} style={{textAlign:'center',padding:'9px 8px',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>{c}</td>
                  ))}
                  <td style={{textAlign:'center',padding:'9px 8px',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700}}>{grandShifts}</td>
                  <td style={{textAlign:'center',padding:'9px 14px',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:'var(--matcha-dark)'}}>{grandHours}h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
