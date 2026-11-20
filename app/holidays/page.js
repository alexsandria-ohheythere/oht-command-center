'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import { HOLIDAY_TYPES, getHolidayType, fetchHolidays, fmtHolidayDate } from '../../lib/holidays'

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }
const lbl = { fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5 }

const emptyForm = { date:'', name:'', type:'regular', notes:'' }

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const daysUntil = iso => {
  const [y,m,d] = iso.split('-').map(Number)
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((new Date(y,m-1,d) - t) / 86400000)
}

export default function HolidaysPage() {
  const supabase = createClient()
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [year, setYear]         = useState(new Date().getFullYear())
  const [form, setForm]         = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const list = await fetchHolidays(supabase)
    setTableMissing(list === null)
    setHolidays(list || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3000) }

  function startEdit(h) {
    setEditingId(h.id)
    setForm({ date:h.date, name:h.name, type:h.type, notes:h.notes||'' })
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm) }

  async function save() {
    if (!form.date) { showToast('⚠️','Pick a date'); return }
    if (!form.name.trim()) { showToast('⚠️','Holiday name is required'); return }
    const clash = holidays.find(h => h.date === form.date && h.id !== editingId)
    if (clash) { showToast('⚠️', `${fmtHolidayDate(form.date)} already has "${clash.name}" — edit that one instead`); return }
    setSaving(true)
    const payload = { date:form.date, name:form.name.trim(), type:form.type, notes:form.notes.trim()||null, updated_at:new Date().toISOString() }
    if (editingId) {
      const { data, error } = await supabase.from('holidays').update(payload).eq('id', editingId).select().single()
      if (error) { showToast('❌', error.message); setSaving(false); return }
      setHolidays(prev => prev.map(h => h.id === editingId ? { ...data, date:String(data.date).slice(0,10) } : h).sort((a,b)=>a.date.localeCompare(b.date)))
      showToast('✅','Holiday updated')
    } else {
      const { data, error } = await supabase.from('holidays').insert([payload]).select().single()
      if (error) { showToast('❌', error.message); setSaving(false); return }
      setHolidays(prev => [...prev, { ...data, date:String(data.date).slice(0,10) }].sort((a,b)=>a.date.localeCompare(b.date)))
      showToast('✅','Holiday added')
    }
    setYear(Number(form.date.slice(0,4)))
    setSaving(false)
    cancelEdit()
  }

  async function remove(h) {
    if (!confirm(`Delete "${h.name}" (${fmtHolidayDate(h.date)})?`)) return
    const { error } = await supabase.from('holidays').delete().eq('id', h.id)
    if (error) { showToast('❌', error.message); return }
    setHolidays(prev => prev.filter(x => x.id !== h.id))
    if (editingId === h.id) cancelEdit()
    showToast('🗑️','Holiday removed')
  }

  const years = [...new Set([new Date().getFullYear(), new Date().getFullYear()+1, ...holidays.map(h => Number(h.date.slice(0,4)))])].sort()
  const yearList = holidays.filter(h => h.date.startsWith(String(year)))
  const today = todayISO()
  const upcoming = holidays.filter(h => h.date >= today).slice(0, 3)
  const counts = Object.keys(HOLIDAY_TYPES).reduce((m,k) => ({ ...m, [k]: yearList.filter(h => h.type === k).length }), {})

  // Group the year's list by month
  const byMonth = {}
  yearList.forEach(h => {
    const key = h.date.slice(0,7)
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(h)
  })

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Holidays</div>
          <div className="topbar-sub">Holidays flag the Scheduling grid and feed holiday pay in Payroll · {yearList.length} in {year}</div>
        </div>
      </div>

      <div className="page-content" style={{maxWidth:960, margin:'0 auto'}}>

        {tableMissing && (
          <div style={{background:'#fff0f0', border:'1px solid #f5c6c6', borderRadius:11, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#c0392b'}}>
            <b>Holidays table not found.</b> Run the setup SQL in Supabase first, then refresh this page. Until then, Payroll keeps using the built-in 2026 list.
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:`repeat(${upcoming.length},1fr)`, gap:10, marginBottom:18}}>
            {upcoming.map(h => {
              const t = getHolidayType(h.type)
              const n = daysUntil(h.date)
              return (
                <div key={h.id} style={{background:t.bg, border:`1.5px solid ${t.border}`, borderRadius:12, padding:'12px 14px'}}>
                  <div style={{fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:t.color}}>
                    {n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`} · {t.short}
                  </div>
                  <div style={{fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:800, color:'var(--espresso)', marginTop:4}}>{h.name}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>{fmtHolidayDate(h.date)}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add / Edit form */}
        <div style={{background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px', marginBottom:20}}>
          <div style={{fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:14}}>
            {editingId ? '✏️ Edit Holiday' : '+ Add Holiday'}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'160px 2fr 1.3fr', gap:12, marginBottom:12}}>
            <div>
              <div style={lbl}>Date</div>
              <input type="date" style={iStyle} value={form.date} onChange={e=>setForm(f=>({...f, date:e.target.value}))}/>
            </div>
            <div>
              <div style={lbl}>Holiday Name</div>
              <input style={iStyle} placeholder="e.g. Bonifacio Day" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
            </div>
            <div>
              <div style={lbl}>Type</div>
              <select style={iStyle} value={form.type} onChange={e=>setForm(f=>({...f, type:e.target.value}))}>
                {Object.entries(HOLIDAY_TYPES).map(([k,t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{fontSize:11, color:getHolidayType(form.type).color, background:getHolidayType(form.type).bg, borderRadius:7, padding:'6px 10px', marginBottom:12, display:'inline-block'}}>
            💸 {getHolidayType(form.type).pay}
          </div>
          <div style={{marginBottom:16}}>
            <div style={lbl}>Notes (optional)</div>
            <input style={iStyle} placeholder="e.g. Proclamation No. 1006 · cafe opens 10AM" value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))}/>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={save} disabled={saving}
              style={{background:'var(--matcha)', color:'white', border:'none', borderRadius:8, padding:'9px 18px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Add Holiday'}
            </button>
            {editingId && (
              <button onClick={cancelEdit}
                style={{background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 16px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Year tabs + counts */}
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:12, flexWrap:'wrap'}}>
          {years.map(y => (
            <button key={y} onClick={()=>setYear(y)}
              style={{padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
                border:`1.5px solid ${year===y?'var(--matcha)':'var(--border)'}`, background:year===y?'var(--matcha)':'var(--surface)', color:year===y?'white':'var(--text-muted)'}}>
              {y}
            </button>
          ))}
          <div style={{flex:1}}/>
          {Object.entries(HOLIDAY_TYPES).map(([k,t]) => counts[k] > 0 && (
            <span key={k} style={{fontSize:10, fontWeight:700, color:t.color, background:t.bg, border:`1px solid ${t.border}`, borderRadius:20, padding:'3px 10px'}}>
              {counts[k]} {t.short}
            </span>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>Loading…</div>
        ) : yearList.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'var(--text-muted)', background:'var(--white)', border:'1px dashed var(--border)', borderRadius:13, fontSize:12}}>
            No holidays entered for {year} yet. Add them above once the Proclamation is out.
          </div>
        ) : (
          Object.keys(byMonth).sort().map(mk => {
            const [y,m] = mk.split('-').map(Number)
            return (
              <div key={mk} style={{marginBottom:14}}>
                <div style={{fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)', margin:'0 0 6px 4px'}}>
                  {new Date(y, m-1, 1).toLocaleDateString('en-PH', { month:'long' })}
                </div>
                <div style={{background:'var(--white)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden'}}>
                  {byMonth[mk].map((h, i) => {
                    const t = getHolidayType(h.type)
                    const past = h.date < today
                    return (
                      <div key={h.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderTop:i?'1px solid var(--border)':'none', opacity:past?.55:1}}>
                        <div style={{width:44, textAlign:'center', flexShrink:0}}>
                          <div style={{fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:900, color:t.color, lineHeight:1}}>{Number(h.date.slice(8,10))}</div>
                          <div style={{fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase'}}>{fmtHolidayDate(h.date).split(',')[0]}</div>
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:13, fontWeight:700, color:'var(--espresso)'}}>{h.name}</div>
                          {h.notes && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>{h.notes}</div>}
                        </div>
                        <span style={{fontSize:10, fontWeight:700, color:t.color, background:t.bg, border:`1px solid ${t.border}`, borderRadius:20, padding:'3px 10px', whiteSpace:'nowrap'}}>{t.label}</span>
                        <button onClick={()=>startEdit(h)} title="Edit"
                          style={{background:'transparent', border:'1px solid var(--border)', borderRadius:7, padding:'5px 9px', fontSize:11, cursor:'pointer'}}>✏️</button>
                        <button onClick={()=>remove(h)} title="Delete"
                          style={{background:'transparent', border:'1px solid #f5c6c6', borderRadius:7, padding:'5px 9px', fontSize:11, cursor:'pointer', color:'#c0392b'}}>🗑️</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {toast && (
        <div style={{position:'fixed', bottom:24, right:24, background:'var(--espresso)', color:'white', borderRadius:10, padding:'11px 18px', fontSize:12, fontWeight:600, zIndex:999, display:'flex', gap:8, alignItems:'center', boxShadow:'0 6px 20px rgba(0,0,0,.2)'}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
