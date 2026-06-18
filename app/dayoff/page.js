'use client'
import { useState, useEffect, useCallback } from 'react'
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
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '—'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

export default function DayOffPage() {
  const supabase = createClient()
  const [staff, setStaff]           = useState([])
  const [dayOffs, setDayOffs]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('calendar') // 'calendar' | 'list' | 'form'
  const [toast, setToast]           = useState(null)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(null)
  const [filterStaff, setFilterStaff] = useState('')

  // Calendar state
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  // Form
  const EMPTY_FORM = { staff_id:'', date_from:toISO(today), date_to:toISO(today), reason:'' }
  const [form, setForm] = useState(EMPTY_FORM)

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

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  async function submit() {
    if (!form.staff_id) { showToast('⚠️','Select a staff member'); return }
    if (form.date_to < form.date_from) { showToast('⚠️','End date must be on or after start date'); return }
    setSaving(true)
    const { error } = await supabase.from('day_offs').insert([{
      staff_id: form.staff_id,
      date_from: form.date_from,
      date_to:   form.date_to,
      reason:    form.reason || null,
    }])
    if (error) { showToast('❌', error.message); setSaving(false); return }

    // Notify the staff member
    const member = staff.find(s=>s.id===form.staff_id)
    if (member) {
      const range = form.date_from === form.date_to
        ? fmtDate(form.date_from)
        : `${fmtDate(form.date_from)} – ${fmtDate(form.date_to)}`
      await notifyOne(form.staff_id, {
        type:'general',
        title:'📆 Day-Off Assigned',
        message:`You have been assigned a day-off on ${range}. You won't be scheduled for any shift on this date.`,
      })
    }

    await fetchAll()
    setForm(EMPTY_FORM)
    setView('calendar')
    showToast('✅','Day-off saved successfully')
    setSaving(false)
  }

  async function deleteDayOff(id) {
    setDeleting(id)
    const { error } = await supabase.from('day_offs').delete().eq('id', id)
    if (error) { showToast('❌', error.message); setDeleting(null); return }
    await fetchAll()
    showToast('🗑️','Day-off removed')
    setDeleting(null)
  }

  // Calendar helpers
  function getDaysInMonth(y, m) {
    return new Date(y, m+1, 0).getDate()
  }
  function getFirstDayOfMonth(y, m) {
    return new Date(y, m, 1).getDay()
  }

  // Get all day-off dates for current month view as a Set of 'YYYY-MM-DD'
  const calDayOffDates = (() => {
    const map = {} // date -> [staffNames]
    dayOffs.forEach(d => {
      const from = new Date(d.date_from+'T00:00:00')
      const to   = new Date(d.date_to+'T00:00:00')
      const cur  = new Date(from)
      const name = d.staff ? (d.staff.nickname || d.staff.first_name) : '?'
      while (cur <= to) {
        const iso = toISO(cur)
        if (!map[iso]) map[iso] = []
        map[iso].push({ name, role: d.staff?.role, staff_id: d.staff_id, id: d.id })
        cur.setDate(cur.getDate()+1)
      }
    })
    return map
  })()

  const filteredDayOffs = filterStaff
    ? dayOffs.filter(d => d.staff_id === filterStaff)
    : dayOffs

  function renderCalendar() {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const firstDay    = getFirstDayOfMonth(calYear, calMonth)
    const cells = []

    // Empty cells before first day
    for (let i=0; i<firstDay; i++) cells.push(null)
    for (let d=1; d<=daysInMonth; d++) cells.push(d)

    return (
      <div>
        {/* Calendar nav */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <button onClick={()=>{ let m=calMonth-1,y=calYear; if(m<0){m=11;y--}; setCalMonth(m);setCalYear(y) }}
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:14}}>‹</button>
          <div style={{fontWeight:700,fontSize:15,color:'var(--text-primary)'}}>
            {MONTHS[calMonth]} {calYear}
          </div>
          <button onClick={()=>{ let m=calMonth+1,y=calYear; if(m>11){m=0;y++}; setCalMonth(m);setCalYear(y) }}
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:14}}>›</button>
        </div>

        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
          {DAYS_SHORT.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',padding:'4px 0'}}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
          {cells.map((day,i)=>{
            if (!day) return <div key={`empty-${i}`} />
            const iso = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const entries = calDayOffDates[iso] || []
            const isToday = iso === toISO(today)
            return (
              <div key={iso} style={{
                minHeight:72,
                background: entries.length ? '#fef3e2' : 'var(--surface)',
                border: `1px solid ${isToday ? '#EF4576' : entries.length ? '#d4a84355' : 'var(--border)'}`,
                borderRadius:8,
                padding:'6px 6px 4px',
                position:'relative',
                outline: isToday ? '2px solid #EF4576' : 'none',
                outlineOffset:1,
              }}>
                <div style={{fontSize:11,fontWeight:isToday?700:500,color:isToday?'#EF4576':'var(--text-primary)',marginBottom:4}}>{day}</div>
                {entries.slice(0,3).map((e,ei)=>(
                  <div key={ei} style={{
                    fontSize:8.5,fontWeight:600,
                    color: getRoleColor(e.role),
                    background:'white',
                    border:`1px solid ${getRoleColor(e.role)}33`,
                    borderRadius:4,padding:'2px 5px',marginBottom:2,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                  }}>{e.name}</div>
                ))}
                {entries.length > 3 && (
                  <div style={{fontSize:8,color:'var(--text-muted)',fontWeight:600}}>+{entries.length-3} more</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:16,padding:'10px 14px',background:'#fef3e2',borderRadius:8,border:'1px solid #d4a84344'}}>
          <div style={{width:14,height:14,background:'#fef3e2',border:'1px solid #d4a843',borderRadius:3,flexShrink:0}} />
          <span style={{fontSize:11,color:'#a06000'}}>Day-off assigned — staff will not appear in scheduling on these dates</span>
        </div>
      </div>
    )
  }

  function renderList() {
    return (
      <div>
        {/* Staff filter */}
        <div style={{marginBottom:16}}>
          <label style={lStyle}>Filter by Staff</label>
          <select value={filterStaff} onChange={e=>setFilterStaff(e.target.value)} style={iStyle}>
            <option value=''>All Staff</option>
            {staff.map(s=>(
              <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}{s.nickname?` (${s.nickname})`:''}</option>
            ))}
          </select>
        </div>

        {filteredDayOffs.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',fontSize:13}}>
            No day-offs recorded yet.
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {filteredDayOffs.map(d => {
              const s = d.staff
              const color = getRoleColor(s?.role)
              const isRange = d.date_from !== d.date_to
              return (
                <div key={d.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                  {/* Avatar */}
                  <div style={{width:38,height:38,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                    {s ? initials(s.first_name,s.last_name) : '?'}
                  </div>
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:'var(--text-primary)'}}>
                      {s ? `${s.first_name} ${s.last_name}${s.nickname?` · ${s.nickname}`:''}` : 'Unknown'}
                    </div>
                    <div style={{fontSize:10,color:color,fontWeight:600,marginTop:1}}>{s?.role||'—'}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
                      📆 {isRange ? `${fmtDate(d.date_from)} – ${fmtDate(d.date_to)}` : fmtDate(d.date_from)}
                    </div>
                    {d.reason && <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2,fontStyle:'italic'}}>"{d.reason}"</div>}
                  </div>
                  {/* Badge */}
                  <div style={{background:'#fef3e2',border:'1px solid #d4a84355',color:'#a06000',borderRadius:6,padding:'4px 10px',fontSize:10,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                    📵 Day-Off
                  </div>
                  {/* Delete */}
                  <button onClick={()=>deleteDayOff(d.id)} disabled={deleting===d.id}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:16,opacity:deleting===d.id?0.4:0.6,padding:'4px',flexShrink:0}}
                    title='Remove day-off'>
                    {deleting===d.id ? '…' : '🗑️'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function renderForm() {
    const selectedStaff = staff.find(s=>s.id===form.staff_id)
    return (
      <div style={{maxWidth:520}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>

          {/* Staff picker */}
          <div>
            <label style={lStyle}>Staff Member *</label>
            <select value={form.staff_id} onChange={fv('staff_id')} style={iStyle}>
              <option value=''>— Select staff —</option>
              {staff.map(s=>(
                <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}{s.nickname?` (${s.nickname})`:''} — {s.role}</option>
              ))}
            </select>
            {selectedStaff && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,padding:'8px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(selectedStaff.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                  {initials(selectedStaff.first_name,selectedStaff.last_name)}
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>{selectedStaff.first_name} {selectedStaff.last_name}</div>
                  <div style={{fontSize:10,color:getRoleColor(selectedStaff.role),fontWeight:600}}>{selectedStaff.role}</div>
                </div>
              </div>
            )}
          </div>

          {/* Date range */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={lStyle}>From *</label>
              <input type='date' value={form.date_from} onChange={fv('date_from')} style={iStyle} />
            </div>
            <div>
              <label style={lStyle}>To *</label>
              <input type='date' value={form.date_to} min={form.date_from} onChange={fv('date_to')} style={iStyle} />
            </div>
          </div>

          {/* Helper note */}
          <div style={{padding:'10px 14px',background:'#eef7e4',border:'1px solid #7ab64844',borderRadius:8,fontSize:11,color:'#4a7a1e',lineHeight:1.5}}>
            📋 <strong>Note:</strong> This staff member will not be assigned to any shift on the selected date(s). They will also not need to submit a leave request — this is managed by you.
          </div>

          {/* Reason */}
          <div>
            <label style={lStyle}>Reason (optional)</label>
            <textarea value={form.reason} onChange={fv('reason')} rows={3} placeholder='e.g. Rest day schedule, family emergency, etc.'
              style={{...iStyle,resize:'vertical'}} />
          </div>

          {/* Actions */}
          <div style={{display:'flex',gap:10}}>
            <button onClick={submit} disabled={saving}
              style={{flex:1,background:'#EF4576',color:'white',border:'none',borderRadius:8,padding:'11px',fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?0.6:1,fontFamily:"'DM Sans',sans-serif"}}>
              {saving ? 'Saving…' : '📆 Assign Day-Off'}
            </button>
            <button onClick={()=>{setForm(EMPTY_FORM);setView('calendar')}}
              style={{background:'var(--surface)',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,padding:'11px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Summary stats
  const totalThisMonth = dayOffs.filter(d => {
    const from = new Date(d.date_from+'T00:00:00')
    return from.getMonth()===today.getMonth() && from.getFullYear()===today.getFullYear()
  }).length

  const upcomingCount = dayOffs.filter(d => new Date(d.date_to+'T00:00:00') >= today).length

  return (
    <AuthShell requiredPermission='schedule'>
      <div style={{padding:'28px 32px',maxWidth:960,margin:'0 auto',fontFamily:"'DM Sans',sans-serif"}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'var(--text-primary)'}}>📆 Day-Off Manager</h1>
            <p style={{margin:'4px 0 0',fontSize:12,color:'var(--text-muted)'}}>Assign scheduled days off · Staff skip the leave form · Blocked from shift scheduling</p>
          </div>
          {view !== 'form' && (
            <button onClick={()=>setView('form')}
              style={{background:'#EF4576',color:'white',border:'none',borderRadius:8,padding:'10px 18px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
              + Assign Day-Off
            </button>
          )}
        </div>

        {/* Stats row */}
        {view !== 'form' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
            {[
              { label:'Total Day-Offs', value: dayOffs.length, icon:'📅', color:'#4a90c4', bg:'#e8f0fb' },
              { label:'This Month',     value: totalThisMonth,  icon:'🗓️', color:'#a06000', bg:'#fef3e2' },
              { label:'Upcoming',       value: upcomingCount,   icon:'🔜', color:'#4a7a1e', bg:'#eef7e4' },
            ].map(stat=>(
              <div key={stat.label} style={{background:stat.bg,border:`1px solid ${stat.color}33`,borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{fontSize:22}}>{stat.icon}</div>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:stat.color,lineHeight:1}}>{stat.value}</div>
                  <div style={{fontSize:10,fontWeight:600,color:stat.color,opacity:0.8,marginTop:2}}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        {view !== 'form' && (
          <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:4,width:'fit-content'}}>
            {[{id:'calendar',label:'📅 Calendar'},{id:'list',label:'📋 List'}].map(tab=>(
              <button key={tab.id} onClick={()=>setView(tab.id)}
                style={{padding:'7px 16px',borderRadius:7,border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:view===tab.id?700:500,
                  background:view===tab.id?'#EF4576':'transparent',color:view===tab.id?'white':'var(--text-secondary)',transition:'all .15s'}}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:24}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',fontSize:13}}>Loading…</div>
          ) : view === 'calendar' ? renderCalendar()
            : view === 'list'     ? renderList()
            : renderForm()}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{position:'fixed',bottom:28,right:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 18px',boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,fontSize:13,fontWeight:600,zIndex:9999}}>
            <span style={{fontSize:16}}>{toast.icon}</span>
            <span style={{color:'var(--text-primary)'}}>{toast.msg}</span>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
