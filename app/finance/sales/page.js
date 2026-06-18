'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const SOURCES = [
  { id:'storehub', label:'StoreHub', color:'#4a90c4' },
  { id:'utak',     label:'Utak',     color:'#7ab648' },
  { id:'peddler',  label:'Peddler',  color:'#e8845a' },
  { id:'manual',   label:'Manual',   color:'#8e44ad' },
]

const AUTHORIZED_EMAILS = ['ohheythere.matcha@gmail.com','ohheythere.group@gmail.com']

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

// Get the target for a specific date ISO string
// Priority: exact date match > day-of-week default > global daily_target
function getTargetForDate(dateISO, targets) {
  if (!dateISO || !targets) return 0
  // Exact date override
  if (targets.date_overrides && targets.date_overrides[dateISO]) {
    return parseFloat(targets.date_overrides[dateISO]) || 0
  }
  // Day-of-week default (0=Sun … 6=Sat)
  const dow = new Date(dateISO + 'T00:00:00').getDay()
  if (targets.dow_targets && targets.dow_targets[dow] !== undefined && targets.dow_targets[dow] !== '') {
    return parseFloat(targets.dow_targets[dow]) || 0
  }
  // Fallback global daily target
  return parseFloat(targets.daily_target) || 0
}

function TargetBadge({ netSales, target }) {
  if (!target || target <= 0) return null
  const pct = (netSales / target) * 100
  if (pct >= 100) return (
    <span title={`Target: ${peso(target)} · Achieved ${pct.toFixed(0)}%`}
      style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,color:'#1e8449',background:'#eafaf1',border:'1px solid #a9dfbf',borderRadius:20,padding:'1px 7px',marginLeft:6,whiteSpace:'nowrap'}}>
      ✅ {pct.toFixed(0)}%
    </span>
  )
  if (pct >= 80) return (
    <span title={`Target: ${peso(target)} · ${pct.toFixed(0)}% achieved`}
      style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,color:'#856404',background:'#fef9e7',border:'1px solid #f9e79f',borderRadius:20,padding:'1px 7px',marginLeft:6,whiteSpace:'nowrap'}}>
      ⚠️ {pct.toFixed(0)}%
    </span>
  )
  return (
    <span title={`Target: ${peso(target)} · Only ${pct.toFixed(0)}% achieved`}
      style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,color:'#c0392b',background:'#fdeaea',border:'1px solid #f5c6c6',borderRadius:20,padding:'1px 7px',marginLeft:6,whiteSpace:'nowrap'}}>
      ❌ {pct.toFixed(0)}%
    </span>
  )
}

function ProgressBar({ value, target }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const bg = pct >= 100 ? '#2ecc71' : pct >= 80 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{marginTop:6}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-muted)',marginBottom:3}}>
        <span>{peso(value)}</span>
        <span style={{fontWeight:700,color:bg}}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{background:'var(--border)',borderRadius:99,height:7,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:bg,borderRadius:99,transition:'width .4s ease'}}/>
      </div>
      <div style={{fontSize:9,color:'var(--text-muted)',marginTop:3}}>Target: {peso(target)}</div>
    </div>
  )
}

function AlertBanner({ todaySales, todayTarget, monthSales, monthTarget }) {
  const alerts = []

  if (todayTarget > 0) {
    const pct = (todaySales / todayTarget) * 100
    if (pct < 80) {
      alerts.push({ level:'danger', msg:`🚨 Today's sales (${peso(todaySales)}) are critically below the daily target of ${peso(todayTarget)} — only ${pct.toFixed(0)}% achieved.` })
    } else if (pct < 100) {
      alerts.push({ level:'warn', msg:`⚠️ Today's sales are at ${pct.toFixed(0)}% of the daily target. ${peso(todayTarget - todaySales)} more needed.` })
    }
  }

  if (monthTarget > 0) {
    const pct = (monthSales / monthTarget) * 100
    if (pct < 80) {
      alerts.push({ level:'danger', msg:`🚨 This month's sales (${peso(monthSales)}) are critically below the monthly target of ${peso(monthTarget)} — ${pct.toFixed(0)}% achieved.` })
    } else if (pct < 100) {
      alerts.push({ level:'warn', msg:`⚠️ Monthly sales at ${pct.toFixed(0)}% of target. ${peso(monthTarget - monthSales)} still needed.` })
    } else {
      alerts.push({ level:'success', msg:`✅ Monthly sales target achieved! ${peso(monthSales)} vs target ${peso(monthTarget)}.` })
    }
  }

  if (!alerts.length) return null

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
      {alerts.map((a,i) => {
        const styles = {
          danger: { bg:'#fdeaea', border:'#f5c6c6', color:'#c0392b' },
          warn:   { bg:'#fef9e7', border:'#f9e79f', color:'#856404' },
          success:{ bg:'#eafaf1', border:'#a9dfbf', color:'#1e8449' },
        }
        const s = styles[a.level]
        return (
          <div key={i} style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:10,padding:'12px 16px',fontSize:12,fontWeight:600,color:s.color}}>
            {a.msg}
          </div>
        )
      })}
    </div>
  )
}

export default function SalesPage() {
  const supabase = createClient()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(toISO(new Date(today.getFullYear(),today.getMonth(),1)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [sales, setSales]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({sale_date:toISO(today),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
  const [toast, setToast]       = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [deleteModal, setDeleteModal] = useState(null)
  const fileRef = useRef()

  // Targets
  const [targets, setTargets]         = useState({ daily_target: 0, monthly_target: 0, dow_targets: {}, date_overrides: {} })
  const [showTargets, setShowTargets] = useState(false)
  const [targetTab, setTargetTab]     = useState('global') // 'global' | 'weekly' | 'override'
  const [targetForm, setTargetForm]   = useState({ daily_target: '', monthly_target: '' })
  const [dowForm, setDowForm]         = useState({ 0:'', 1:'', 2:'', 3:'', 4:'', 5:'', 6:'' })
  const [overrideDate, setOverrideDate] = useState(toISO(today))
  const [overrideAmt, setOverrideAmt]   = useState('')
  const [savingTargets, setSavingTargets] = useState(false)
  const [userEmail, setUserEmail]     = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email || null)
    })
    fetchTargets()
  }, [])

  useEffect(()=>{ fetchSales() },[dateFrom,dateTo])

  async function fetchTargets() {
    const { data } = await supabase.from('settings').select('value').eq('key','sales_targets').single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value)
        const full = {
          daily_target:   parsed.daily_target   || 0,
          monthly_target: parsed.monthly_target || 0,
          dow_targets:    parsed.dow_targets    || {},
          date_overrides: parsed.date_overrides || {},
        }
        setTargets(full)
        setTargetForm({ daily_target: full.daily_target || '', monthly_target: full.monthly_target || '' })
        const dows = { 0:'', 1:'', 2:'', 3:'', 4:'', 5:'', 6:'' }
        Object.keys(full.dow_targets).forEach(k => { dows[k] = full.dow_targets[k] || '' })
        setDowForm(dows)
      } catch(e) {}
    }
  }

  async function saveGlobalTargets() {
    setSavingTargets(true)
    const payload = {
      ...targets,
      daily_target:   parseFloat(targetForm.daily_target)   || 0,
      monthly_target: parseFloat(targetForm.monthly_target) || 0,
    }
    const { error } = await supabase.from('settings').upsert({ key:'sales_targets', value: JSON.stringify(payload) }, { onConflict:'key' })
    if (error) { showToast('❌', error.message) }
    else { setTargets(payload); showToast('✅', 'Global targets updated') }
    setSavingTargets(false)
  }

  async function saveWeeklyTargets() {
    setSavingTargets(true)
    const dow = {}
    Object.keys(dowForm).forEach(k => { if (dowForm[k] !== '') dow[k] = parseFloat(dowForm[k]) || 0 })
    const payload = { ...targets, dow_targets: dow }
    const { error } = await supabase.from('settings').upsert({ key:'sales_targets', value: JSON.stringify(payload) }, { onConflict:'key' })
    if (error) { showToast('❌', error.message) }
    else { setTargets(payload); showToast('✅', 'Weekly targets saved') }
    setSavingTargets(false)
  }

  async function saveOverride() {
    if (!overrideDate || overrideAmt === '') { showToast('⚠️','Enter a date and amount'); return }
    setSavingTargets(true)
    const overrides = { ...(targets.date_overrides || {}) }
    if (overrideAmt === '0' || overrideAmt === '') {
      delete overrides[overrideDate]
    } else {
      overrides[overrideDate] = parseFloat(overrideAmt) || 0
    }
    const payload = { ...targets, date_overrides: overrides }
    const { error } = await supabase.from('settings').upsert({ key:'sales_targets', value: JSON.stringify(payload) }, { onConflict:'key' })
    if (error) { showToast('❌', error.message) }
    else {
      setTargets(payload)
      setOverrideAmt('')
      showToast('✅', `Target set for ${fmtDate(overrideDate)}`)
    }
    setSavingTargets(false)
  }

  async function removeOverride(dateISO) {
    const overrides = { ...(targets.date_overrides || {}) }
    delete overrides[dateISO]
    const payload = { ...targets, date_overrides: overrides }
    await supabase.from('settings').upsert({ key:'sales_targets', value: JSON.stringify(payload) }, { onConflict:'key' })
    setTargets(payload)
    showToast('🗑️', 'Override removed')
  }

  async function fetchSales() {
    setLoading(true)
    const { data } = await supabase.from('sales').select('*').gte('sale_date',dateFrom).lte('sale_date',dateTo).order('sale_date',{ascending:false})
    setSales(data||[])
    setSelected(new Set())
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  function parseStoreHubDate(raw) {
    const clean = raw.replace(/\s*\(.*?\)/, '').trim()
    const d = new Date(clean)
    return isNaN(d) ? null : toISO(d)
  }

  function handleCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const text = ev.target.result.replace(/^\uFEFF/, '')
      const lines = text.split('\n').filter(l=>l.trim())
      const rawHeaders = lines[0].split(',').map(h=>h.trim())
      const col = {}
      rawHeaders.forEach((h, i) => {
        const n = h.toLowerCase()
        if (n === 'date / time' || n === 'date')  col.date = i
        if (n === 'total sales')                   col.gross = i
        if (n === 'net sales')                     col.net = i
        if (n === 'total transactions')            col.txns = i
        if (n === 'total discount')                col.discount = i
        if (n === 'tax')                           col.tax = i
      })
      if (col.date === undefined) { showToast('⚠️', 'Date column not found — is this a StoreHub CSV?'); return }
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const rawDate = vals[col.date] || ''
        if (!rawDate) continue
        const saleDate = parseStoreHubDate(rawDate)
        if (!saleDate) continue
        const gross = parseFloat(vals[col.gross] || 0)
        if (!gross) continue
        const notes = [
          col.discount !== undefined && parseFloat(vals[col.discount]||0) ? `Discount: ₱${parseFloat(vals[col.discount]).toFixed(2)}` : '',
          col.tax      !== undefined && parseFloat(vals[col.tax]||0)      ? `Tax: ₱${parseFloat(vals[col.tax]).toFixed(2)}`           : '',
        ].filter(Boolean).join(' · ')
        rows.push({
          sale_date:         saleDate,
          source:            'storehub',
          gross_sales:       gross,
          net_sales:         parseFloat(vals[col.net] || gross),
          transaction_count: parseInt(vals[col.txns]  || 0) || 0,
          notes:             notes || null,
          uploaded_by:       'alex',
        })
      }
      if (!rows.length) { showToast('⚠️', 'No valid rows found'); return }
      setSaving(true)
      const { error } = await supabase.from('sales').insert(rows)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchSales()
      showToast('✅', `${rows.length} StoreHub records imported`)
      setSaving(false)
    }
    reader.readAsText(file); e.target.value = ''
  }

  async function saveSale() {
    if(!form.gross_sales){showToast('⚠️','Enter gross sales');return}
    setSaving(true)
    const {error}=await supabase.from('sales').insert([{...form,gross_sales:parseFloat(form.gross_sales)||0,net_sales:parseFloat(form.net_sales||form.gross_sales)||0,transaction_count:parseInt(form.transaction_count)||0,uploaded_by:'alex'}])
    if(error){showToast('❌',error.message);setSaving(false);return}
    await fetchSales(); setShowForm(false); setForm({sale_date:toISO(today),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
    showToast('✅','Sale added'); setSaving(false)
  }

  async function confirmDeleteAction() {
    if (!deleteModal) return
    setSaving(true)
    if (deleteModal.mode === 'single') {
      await supabase.from('sales').delete().eq('id', deleteModal.id)
      setSales(p=>p.filter(s=>s.id!==deleteModal.id))
      showToast('🗑️','Record deleted')
    } else {
      const ids = [...selected]
      await supabase.from('sales').delete().in('id', ids)
      setSales(p=>p.filter(s=>!ids.includes(s.id)))
      setSelected(new Set())
      showToast('🗑️',`${ids.length} records deleted`)
    }
    setDeleteModal(null)
    setSaving(false)
  }

  function toggleSelect(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleSelectAll() {
    if (selected.size === sales.length) setSelected(new Set())
    else setSelected(new Set(sales.map(s=>s.id)))
  }

  // Group net sales by date for target comparison
  const netByDate = {}
  sales.forEach(s => {
    netByDate[s.sale_date] = (netByDate[s.sale_date] || 0) + (parseFloat(s.net_sales) || 0)
  })

  const totalGross = sales.reduce((a,s)=>a+(parseFloat(s.gross_sales)||0),0)
  const totalNet   = sales.reduce((a,s)=>a+(parseFloat(s.net_sales)||0),0)
  const totalTxns  = sales.reduce((a,s)=>a+(parseInt(s.transaction_count)||0),0)

  const todayISO = toISO(today)
  const todaySales = netByDate[todayISO] || 0
  const todayTarget = getTargetForDate(todayISO, targets)

  const isCurrentMonth = dateFrom === toISO(new Date(today.getFullYear(),today.getMonth(),1)) && dateTo === toISO(today)
  const monthSales = totalNet

  const canEditTargets = AUTHORIZED_EMAILS.includes(userEmail)

  const tabStyle = active => ({
    padding:'7px 14px',fontSize:11,fontWeight:700,cursor:'pointer',borderRadius:7,
    background: active ? 'var(--matcha-dark)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    border: 'none',
    fontFamily:"'DM Sans',sans-serif",
    transition:'all .15s',
  })

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Sales</div><div className="topbar-sub">{sales.length} records · {fmtDate(dateFrom)} – {fmtDate(dateTo)}</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <label style={{display:'flex',alignItems:'center',gap:6,background:'#e8f0fb',border:'1px solid #4a90c4',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'#4a90c4',cursor:'pointer',whiteSpace:'nowrap'}}>
            {saving ? '⏳ Importing…' : '📂 Upload StoreHub CSV'}
            <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV} disabled={saving}/>
          </label>
          {canEditTargets && (
            <button
              onClick={()=>setShowTargets(!showTargets)}
              style={{background:'#fef9e7',border:'1px solid #f9e79f',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'#856404',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
              🎯 Set Targets
            </button>
          )}
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ Add Sale</button>
        </div>
      </div>

      <div className="page-content">

        {/* Alerts */}
        <AlertBanner
          todaySales={todaySales}
          todayTarget={todayTarget}
          monthSales={monthSales}
          monthTarget={targets.monthly_target}
        />

        {/* Targets Panel */}
        {(targets.daily_target > 0 || targets.monthly_target > 0 || Object.keys(targets.dow_targets||{}).length > 0) && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            {(targets.daily_target > 0 || Object.keys(targets.dow_targets||{}).length > 0) && (
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px'}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4}}>Today's Sales vs Daily Target</div>
                <ProgressBar value={todaySales} target={todayTarget} />
              </div>
            )}
            {targets.monthly_target > 0 && (
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px'}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4}}>
                  {isCurrentMonth ? "This Month's Sales vs Monthly Target" : "Period Net Sales vs Monthly Target"}
                </div>
                <ProgressBar value={monthSales} target={targets.monthly_target} />
              </div>
            )}
          </div>
        )}

        {/* Set Targets Form */}
        {showTargets && canEditTargets && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>🎯 Sales Targets</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14}}>Set targets by day of week or for a specific date. Date-specific overrides take priority over day-of-week defaults.</div>

            {/* Tabs */}
            <div style={{display:'flex',gap:4,background:'var(--surface)',borderRadius:9,padding:4,marginBottom:18,width:'fit-content'}}>
              <button style={tabStyle(targetTab==='global')} onClick={()=>setTargetTab('global')}>🌐 Global</button>
              <button style={tabStyle(targetTab==='weekly')} onClick={()=>setTargetTab('weekly')}>📅 By Day of Week</button>
              <button style={tabStyle(targetTab==='override')} onClick={()=>setTargetTab('override')}>📌 Date Override</button>
            </div>

            {/* Global tab */}
            {targetTab === 'global' && (
              <div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>Fallback targets used when no day-of-week or date override is set.</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <div>
                    <label style={lStyle}>Daily Target (₱) — fallback</label>
                    <input style={iStyle} type="number" placeholder="e.g. 15000" value={targetForm.daily_target}
                      onChange={e=>setTargetForm(p=>({...p,daily_target:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lStyle}>Monthly Target (₱)</label>
                    <input style={iStyle} type="number" placeholder="e.g. 350000" value={targetForm.monthly_target}
                      onChange={e=>setTargetForm(p=>({...p,monthly_target:e.target.value}))}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button className="btn btn-secondary" onClick={()=>setShowTargets(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveGlobalTargets} disabled={savingTargets}>
                    {savingTargets ? 'Saving…' : '✓ Save Global Targets'}
                  </button>
                </div>
              </div>
            )}

            {/* Weekly tab */}
            {targetTab === 'weekly' && (
              <div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>Set a different target per day of the week. Leave blank to use the global fallback.</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10,marginBottom:16}}>
                  {[0,1,2,3,4,5,6].map(d => (
                    <div key={d}>
                      <label style={lStyle}>{DOW[d]}</label>
                      <input style={iStyle} type="number" placeholder="—" value={dowForm[d]}
                        onChange={e=>setDowForm(p=>({...p,[d]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button className="btn btn-secondary" onClick={()=>setShowTargets(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveWeeklyTargets} disabled={savingTargets}>
                    {savingTargets ? 'Saving…' : '✓ Save Weekly Targets'}
                  </button>
                </div>
              </div>
            )}

            {/* Date override tab */}
            {targetTab === 'override' && (
              <div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>Override the target for a specific date — e.g. holidays, events, or promo days.</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end',marginBottom:16}}>
                  <div>
                    <label style={lStyle}>Date</label>
                    <input style={iStyle} type="date" value={overrideDate} onChange={e=>setOverrideDate(e.target.value)}/>
                  </div>
                  <div>
                    <label style={lStyle}>Target (₱)</label>
                    <input style={iStyle} type="number" placeholder="e.g. 25000" value={overrideAmt}
                      onChange={e=>setOverrideAmt(e.target.value)}/>
                  </div>
                  <button className="btn btn-primary" onClick={saveOverride} disabled={savingTargets} style={{whiteSpace:'nowrap'}}>
                    {savingTargets ? 'Saving…' : '+ Set Override'}
                  </button>
                </div>

                {/* Existing overrides list */}
                {Object.keys(targets.date_overrides||{}).length > 0 && (
                  <div>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:8}}>Active Date Overrides</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {Object.entries(targets.date_overrides).sort(([a],[b])=>a.localeCompare(b)).map(([date, amt]) => (
                        <div key={date} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px'}}>
                          <span style={{fontSize:12,fontWeight:600}}>{fmtDate(date)}</span>
                          <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:700}}>{peso(amt)}</span>
                          <button onClick={()=>removeOverride(date)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--text-muted)'}}
                            onMouseEnter={e=>e.target.style.color='#c0392b'}
                            onMouseLeave={e=>e.target.style.color='var(--text-muted)'}>🗑</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* KPIs */}
        <div className="kpi-grid" style={{marginBottom:16}}>
          {[
            {label:'Gross Sales',  value:peso(totalGross), cls:'c-matcha', icon:'💰'},
            {label:'Net Sales',    value:peso(totalNet),   cls:'c-gold',   icon:'📈'},
            {label:'Transactions', value:totalTxns,        cls:'c-blush',  icon:'🧾'},
            {label:'Avg per Day',  value:peso(totalNet/Math.max(1,sales.length)), cls:'c-bark', icon:'📅'},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showForm&&(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>Add Sale Record</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
              <div><label style={lStyle}>Date</label><input style={iStyle} type="date" value={form.sale_date} onChange={fv('sale_date')}/></div>
              <div><label style={lStyle}>Gross Sales</label><input style={iStyle} type="number" placeholder="0.00" value={form.gross_sales} onChange={fv('gross_sales')}/></div>
              <div><label style={lStyle}>Net Sales</label><input style={iStyle} type="number" placeholder="Same as gross" value={form.net_sales} onChange={fv('net_sales')}/></div>
              <div><label style={lStyle}>Transactions</label><input style={iStyle} type="number" placeholder="0" value={form.transaction_count} onChange={fv('transaction_count')}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'end'}}>
              <div>
                <label style={lStyle}>Source</label>
                <div style={{display:'flex',gap:7}}>
                  {SOURCES.map(src=>(
                    <div key={src.id} onClick={()=>setForm(p=>({...p,source:src.id}))} style={{padding:'7px 12px',borderRadius:8,border:`1.5px solid ${form.source===src.id?src.color:'var(--border)'}`,background:form.source===src.id?src.color+'22':'var(--surface)',cursor:'pointer',fontSize:11,fontWeight:600,color:form.source===src.id?src.color:'var(--text-muted)',transition:'all .15s'}}>
                      {src.label}
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSale} disabled={saving}>{saving?'Saving…':'✓ Add'}</button>
            </div>
          </div>
        )}

        {/* Bulk delete bar */}
        {selected.size > 0 && (
          <div style={{background:'#fdeaea',border:'1px solid #f5c6c6',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:12,fontWeight:600,color:'#c0392b',flex:1}}>{selected.size} record{selected.size!==1?'s':''} selected</span>
            <button onClick={()=>setSelected(new Set())} style={{background:'none',border:'1px solid #f5c6c6',borderRadius:7,padding:'5px 12px',fontSize:11,color:'#c0392b',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Deselect all</button>
            <button onClick={()=>setDeleteModal({mode:'bulk'})} style={{background:'#c0392b',border:'none',borderRadius:7,padding:'6px 14px',fontSize:11,fontWeight:700,color:'white',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              🗑️ Delete {selected.size} record{selected.size!==1?'s':''}
            </button>
          </div>
        )}

        {/* Table */}
        {loading?(
          <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>
        ):sales.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>💰</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No sales records yet</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Upload a StoreHub CSV or add a record manually</div>
          </div>
        ):(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--espresso)'}}>
                <th style={{padding:'11px 14px',width:36}}>
                  <input type="checkbox" checked={selected.size===sales.length&&sales.length>0} onChange={toggleSelectAll} style={{cursor:'pointer',accentColor:'#EF4576'}}/>
                </th>
                {['Date','Source','Gross Sales','Net Sales','Transactions','Notes',''].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sales.map((s,i)=>{
                  const src=SOURCES.find(x=>x.id===s.source)||SOURCES[0]
                  const isSelected = selected.has(s.id)
                  const dayTarget = getTargetForDate(s.sale_date, targets)
                  const dayNet = netByDate[s.sale_date] || 0
                  // Only show badge on the first row of each date
                  const isFirstOfDate = sales.findIndex(r => r.sale_date === s.sale_date) === i
                  return(
                    <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:isSelected?'#fef3f3':i%2===0?'var(--white)':'var(--surface)',transition:'background .1s'}}>
                      <td style={{padding:'10px 14px'}}>
                        <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(s.id)} style={{cursor:'pointer',accentColor:'#EF4576'}}/>
                      </td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600,whiteSpace:'nowrap'}}>
                        {fmtDate(s.sale_date)}
                        {isFirstOfDate && dayTarget > 0 && (
                          <TargetBadge netSales={dayNet} target={dayTarget} />
                        )}
                      </td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:src.color+'22',color:src.color}}>{src.label}</span></td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{peso(s.gross_sales)}</td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace"}}>{peso(s.net_sales)}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)'}}>{s.transaction_count||'—'}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:11,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.notes||'—'}</td>
                      <td style={{padding:'10px 14px'}}>
                        <button onClick={()=>setDeleteModal({mode:'single',id:s.id})}
                          style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14,transition:'color .15s'}}
                          onMouseEnter={e=>e.target.style.color='#c0392b'}
                          onMouseLeave={e=>e.target.style.color='var(--border)'}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr style={{background:'var(--espresso)'}}>
                <td/>
                <td colSpan={2} style={{padding:'11px 14px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totalGross)}</td>
                <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672'}}>{peso(totalNet)}</td>
                <td style={{padding:'11px 14px',color:'var(--matcha-light)',fontFamily:"'DM Mono',monospace"}}>{totalTxns}</td>
                <td colSpan={2}/>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
          <div style={{background:'var(--white)',borderRadius:16,padding:'28px 32px',maxWidth:380,width:'90%',boxShadow:'0 24px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontSize:28,marginBottom:12,textAlign:'center'}}>🗑️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:8,textAlign:'center'}}>
              {deleteModal.mode==='bulk' ? `Delete ${selected.size} records?` : 'Delete this record?'}
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:24,textAlign:'center',lineHeight:1.6}}>
              {deleteModal.mode==='bulk'
                ? `This will permanently remove ${selected.size} sales record${selected.size!==1?'s':''} from the database.`
                : 'This will permanently remove this sales record from the database.'}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDeleteModal(null)}
                style={{flex:1,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:11,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
              <button onClick={confirmDeleteAction} disabled={saving}
                style={{flex:1,background:'#c0392b',border:'none',borderRadius:9,padding:11,fontSize:12,fontWeight:700,color:'white',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
