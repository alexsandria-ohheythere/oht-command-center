'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { notifyOne } from '../../lib/notify'

const fmtFull = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '—'
const fmtShort = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
const toISO = d => { const p=d.toLocaleDateString('en-CA'); return p }
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const ROLE_COLORS = {'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'}
const getRoleColor = r => ROLE_COLORS[r]||'#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

function getWeekDates(offset=0) {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day===0?6:day-1) + offset*7)
  mon.setHours(0,0,0,0)
  return DAYS.map((_,i) => { const d=new Date(mon); d.setDate(mon.getDate()+i); return d })
}

export default function DayOffPage() {
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [dayOffs, setDayOffs]       = useState([])
  const [schedules, setSchedules]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [confirmBox, setConfirmBox] = useState(null)
  const [toast, setToast]           = useState(null)
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])
  const weekEnd   = toISO(weekDates[6])

  useEffect(() => { fetchAll() }, [weekOffset])

  async function fetchAll() {
    setLoading(true)
    try {
      const [{ data:s },{ data:d },{ data:sc }] = await Promise.all([
        supabase.from('staff').select('id,first_name,last_name,nickname,role,status').eq('status','active').order('last_name'),
        supabase.from('day_offs').select('*').gte('date_from',weekStart).lte('date_to',weekEnd),
        supabase.from('schedules').select('staff_id,shift_date,shift_type').gte('shift_date',weekStart).lte('shift_date',weekEnd),
      ])
      setStaff(s||[]); setDayOffs(d||[]); setSchedules(sc||[])
    } catch(e){ console.error(e) }
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}

  function hasDayOff(staffId, dateStr) {
    return dayOffs.some(d=>d.staff_id===staffId && dateStr>=d.date_from && dateStr<=d.date_to)
  }
  function hasShift(staffId, dateStr) {
    return schedules.some(s=>s.staff_id===staffId && s.shift_date===dateStr)
  }

  function handleCellClick(staffRow, date) {
    const iso = toISO(date)
    if (hasDayOff(staffRow.id, iso)) return
    setConfirmBox({ staff:{ staff_id:staffRow.id, name:`${staffRow.first_name} ${staffRow.last_name}`, fullName:`${staffRow.first_name} ${staffRow.last_name}` }, iso })
  }

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
    // Messenger to staff member
    await fetch('/api/messenger/send', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ staffId: s.staff_id, message: `📆 Day-Off Assigned\n\n${fmtFull(iso)}\n\nYou won't be scheduled for any shift on this date.` })
    }).catch(()=>{})
    // Messenger to Alex & CJ
    await fetch('/api/messenger/send-by-emails', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        emails: ['ohheythere.matcha@gmail.com','ohheythere.group@gmail.com'],
        message: `📆 Day-Off Assigned\n\n${s.fullName} has been assigned a day-off on ${fmtFull(iso)}.`
      })
    }).catch(()=>{})
    await fetchAll()
    setConfirmBox(null)
    showToast('✅',`Day-off saved · ${s.name} · ${fmtShort(iso)}`)
    setSaving(false)
  }

  async function removeDayOff(staffId, dateStr) {
    const record = dayOffs.find(d=>d.staff_id===staffId && dateStr>=d.date_from && dateStr<=d.date_to)
    if (!record) return
    if (!confirm(`Remove day-off for ${dateStr}?`)) return
    await supabase.from('day_offs').delete().eq('id',record.id)
    await fetchAll()
    showToast('🗑️','Day-off removed')
  }

  const roles = ['All',...[...new Set(staff.map(s=>s.role))]]
  const filtered = staff.filter(s => {
    if (roleFilter!=='All' && s.role!==roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || (s.nickname||'').toLowerCase().includes(q)
    }
    return true
  })

  const weekLabel = `${fmtShort(toISO(weekDates[0]))} – ${fmtShort(toISO(weekDates[6]))}`
  const today = toISO(new Date())

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Day-Off Manager</div>
          <div className="topbar-sub">Click any cell to assign a day-off · {weekLabel}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setWeekOffset(p=>p-1)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:13,fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>←</button>
          <button onClick={()=>setWeekOffset(0)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:11,fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Today</button>
          <button onClick={()=>setWeekOffset(p=>p+1)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:13,fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>→</button>
        </div>
      </div>

      <div className="page-content">
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff…"
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',width:200}}/>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {roles.map(r=>(
              <button key={r} onClick={()=>setRoleFilter(r)}
                style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${roleFilter===r?getRoleColor(r):'var(--border)'}`,background:roleFilter===r?getRoleColor(r)+'22':'transparent',color:roleFilter===r?getRoleColor(r):'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading…</div>
        ) : (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
              <thead>
                <tr style={{background:'var(--espresso)'}}>
                  <th style={{padding:'11px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'var(--matcha-light)',width:200,whiteSpace:'nowrap'}}>Staff</th>
                  {weekDates.map((d,i) => {
                    const iso = toISO(d)
                    const isToday = iso===today
                    return (
                      <th key={i} style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:isToday?'#EF4576':'var(--matcha-light)',whiteSpace:'nowrap',minWidth:90}}>
                        <div>{DAYS[i]}</div>
                        <div style={{fontSize:11,marginTop:2,fontFamily:"'Montserrat',sans-serif"}}>{d.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s,si) => (
                  <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:si%2===0?'var(--white)':'var(--surface)'}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{initials(s.first_name,s.last_name)}</div>
                        <div>
                          <div style={{fontWeight:600,fontSize:12,color:'var(--text-primary)'}}>{s.first_name} {s.last_name}</div>
                          <div style={{fontSize:9,color:'var(--text-muted)'}}>{s.role}</div>
                        </div>
                      </div>
                    </td>
                    {weekDates.map((d,di) => {
                      const iso = toISO(d)
                      const off = hasDayOff(s.id, iso)
                      const shift = hasShift(s.id, iso)
                      const isToday = iso===today
                      return (
                        <td key={di} onClick={()=>!off?handleCellClick(s,d):null}
                          style={{padding:'6px',textAlign:'center',cursor:off?'default':'pointer',position:'relative',background:isToday?'#fff5f7':undefined,transition:'background .1s'}}
                          onMouseEnter={e=>{ if(!off) e.currentTarget.style.background='var(--matcha-pale)' }}
                          onMouseLeave={e=>{ e.currentTarget.style.background=isToday?'#fff5f7':'' }}>
                          {off ? (
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                              <div style={{background:'#fdeef3',border:'1px solid #f5a0b8',borderRadius:7,padding:'4px 8px',fontSize:10,fontWeight:700,color:'#EF4576'}}>Day Off</div>
                              <button onClick={e=>{e.stopPropagation();removeDayOff(s.id,iso)}}
                                style={{background:'transparent',border:'none',fontSize:10,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                                onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--text-muted)'}>
                                remove
                              </button>
                            </div>
                          ) : shift ? (
                            <div style={{fontSize:9,color:'var(--text-muted)',background:'var(--surface)',borderRadius:5,padding:'3px 6px',display:'inline-block'}}>on shift</div>
                          ) : (
                            <div style={{fontSize:18,color:'var(--border)',opacity:.4}}>+</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmBox && (
        <div onClick={e=>e.target===e.currentTarget&&setConfirmBox(null)}
          style={{position:'fixed',inset:0,background:'rgba(26,18,8,.5)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--white)',borderRadius:16,padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:6}}>📆 Assign Day-Off</div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>
              <strong>{confirmBox.staff.name}</strong><br/>
              {fmtFull(confirmBox.iso)}
            </div>
            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#a06000',lineHeight:1.6}}>
              ⚠️ This staff member will not be scheduled for any shift on this date. They will be notified via portal and Messenger.
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setConfirmBox(null)} style={{flex:1,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:'10px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",color:'var(--text-muted)'}}>Cancel</button>
              <button onClick={confirmAssign} disabled={saving}
                style={{flex:2,background:'#EF4576',color:'white',border:'none',borderRadius:9,padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving?'Saving…':'✅ Confirm Day-Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
