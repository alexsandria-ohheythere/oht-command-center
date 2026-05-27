'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const peso = n => '₱' + (parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'

const TABS = [
  { id:'overview',   label:'Financial Statement', icon:'📊' },
  { id:'sales',      label:'Sales',               icon:'💰' },
  { id:'expenses',   label:'Expenses',             icon:'🧾' },
  { id:'forecast',   label:'Forecast',             icon:'📈' },
  { id:'bank',       label:'Bank Records',         icon:'🏦' },
]

const PERIODS = ['Weekly','Monthly','Cutoff']
const SOURCES = [
  { id:'storehub', label:'StoreHub', color:'#4a90c4' },
  { id:'utak',     label:'Utak',     color:'#7ab648' },
  { id:'peddler',  label:'Peddler',  color:'#e8845a' },
  { id:'manual',   label:'Manual',   color:'#8e44ad' },
]

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }
const lStyle = { display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(26,18,8,.6)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--white)',borderRadius:18,padding:28,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>{title}</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',color:'var(--text-muted)',lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function FinancePage() {
  const supabase = createClient()
  const [tab, setTab]                   = useState('overview')
  const [period, setPeriod]             = useState('Monthly')
  const [dateFrom, setDateFrom]         = useState(toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [dateTo, setDateTo]             = useState(toISO(new Date()))
  const [sales, setSales]               = useState([])
  const [expenses, setExpenses]         = useState([])
  const [categories, setCategories]     = useState([])
  const [bankRecords, setBankRecords]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [toast, setToast]               = useState(null)
  const [saving, setSaving]             = useState(false)

  // Modals
  const [showSaleForm, setShowSaleForm]       = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showCatForm, setShowCatForm]         = useState(false)

  // Forms
  const [saleForm, setSaleForm] = useState({ sale_date: toISO(new Date()), source:'storehub', gross_sales:'', net_sales:'', transaction_count:'', notes:'' })
  const [expForm, setExpForm]   = useState({ expense_date: toISO(new Date()), category_id:'', description:'', amount:'', paid_by:'alex', notes:'', receipt_url:'' })
  const [catForm, setCatForm]   = useState({ name:'', color:'#7ab648', icon:'📦' })

  const salesFileRef = useRef()
  const bankFileRef  = useRef()

  useEffect(() => { fetchAll() }, [dateFrom, dateTo])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: e }, { data: c }, { data: b }] = await Promise.all([
      supabase.from('sales').select('*').gte('sale_date', dateFrom).lte('sale_date', dateTo).order('sale_date', {ascending:false}),
      supabase.from('expenses').select('*, expense_categories(name,color,icon)').gte('expense_date', dateFrom).lte('expense_date', dateTo).order('expense_date', {ascending:false}),
      supabase.from('expense_categories').select('*').eq('is_active', true).order('name'),
      supabase.from('bank_records').select('*').gte('transaction_date', dateFrom).lte('transaction_date', dateTo).order('transaction_date', {ascending:false}),
    ])
    setSales(s||[])
    setExpenses(e||[])
    setCategories(c||[])
    setBankRecords(b||[])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }

  // ── PERIOD SHORTCUTS ──
  function applyPeriod(p) {
    const now = new Date()
    if (p==='Weekly') {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate()-(day===0?6:day-1))
      setDateFrom(toISO(mon)); setDateTo(toISO(now))
    } else if (p==='Monthly') {
      setDateFrom(toISO(new Date(now.getFullYear(),now.getMonth(),1)))
      setDateTo(toISO(now))
    } else if (p==='Cutoff') {
      const day = now.getDate()
      if (day<=14) { setDateFrom(toISO(new Date(now.getFullYear(),now.getMonth()-1,31))); setDateTo(toISO(new Date(now.getFullYear(),now.getMonth(),14))) }
      else { setDateFrom(toISO(new Date(now.getFullYear(),now.getMonth(),15))); setDateTo(toISO(new Date(now.getFullYear(),now.getMonth(),30))) }
    }
    setPeriod(p)
  }

  // ── TOTALS ──
  const totalGross    = sales.reduce((a,s)=>a+(parseFloat(s.gross_sales)||0),0)
  const totalNet      = sales.reduce((a,s)=>a+(parseFloat(s.net_sales)||0),0)
  const totalExpenses = expenses.reduce((a,e)=>a+(parseFloat(e.amount)||0),0)
  const netIncome     = totalNet - totalExpenses

  // ── SALES CSV UPLOAD ──
  function handleSalesCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const lines = ev.target.result.split('\n').filter(l=>l.trim())
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))
      const rows = []
      for (let i=1;i<lines.length;i++) {
        const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        const obj = {}; headers.forEach((h,idx)=>{obj[h]=vals[idx]||''})
        // Try to parse date
        const rawDate = obj.date||obj.sale_date||obj.transaction_date||''
        let saleDate = null
        if (rawDate) {
          const d = new Date(rawDate)
          if (!isNaN(d)) saleDate = toISO(d)
        }
        if (!saleDate) continue
        const gross = parseFloat(obj.gross_sales||obj.gross||obj.total||obj.amount||0)
        const net   = parseFloat(obj.net_sales||obj.net||obj.net_amount||gross)
        const txns  = parseInt(obj.transactions||obj.transaction_count||obj.orders||0)
        if (gross > 0) rows.push({ sale_date:saleDate, source:'storehub', gross_sales:gross, net_sales:net, transaction_count:txns, uploaded_by:'alex' })
      }
      if (!rows.length) { showToast('⚠️','No valid rows found in CSV'); return }
      setSaving(true)
      const { error } = await supabase.from('sales').insert(rows)
      if (error) { showToast('❌',error.message); setSaving(false); return }
      await fetchAll()
      showToast('✅',`${rows.length} sales records imported`)
      setSaving(false)
    }
    reader.readAsText(file)
    e.target.value=''
  }

  // ── BANK CSV UPLOAD ──
  // Supports UnionBank format (header block rows 1-15, transactions from row 16)
  function handleBankCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const allLines = ev.target.result.split('\n')
      const rows = []

      // ── UNIONBANK DETECTION ──
      // UnionBank CSVs have "ACCOUNT DETAILS:" on line 1 and
      // "TRANSACTIONS LIST:" somewhere before the header row
      const isUnionBank = allLines[0]?.includes('ACCOUNT DETAILS')

      if (isUnionBank) {
        // Find the header row (contains "Transaction Date")
        let headerIdx = allLines.findIndex(l => l.includes('Transaction Date'))
        if (headerIdx === -1) { showToast('⚠️', 'Could not find transaction headers in UnionBank CSV'); return }
        const headers = allLines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))

        for (let i = headerIdx + 1; i < allLines.length; i++) {
          const line = allLines[i].trim()
          if (!line) continue
          // Split carefully — values may have commas inside
          const vals = line.split(',')
          const obj = {}; headers.forEach((h, idx) => { obj[h] = (vals[idx]||'').trim().replace(/^"|"$/g,'') })

          // Parse date — format: 2026-04-30T00:00:00.000
          const rawDate = obj.transaction_date || ''
          if (!rawDate) continue
          const d = new Date(rawDate)
          if (isNaN(d)) continue
          const txDate = toISO(d)

          // UnionBank: debits and credits can be " " (space) when empty
          const debit  = parseFloat(obj.debits?.trim()  || '0') || 0
          const credit = parseFloat(obj.credits?.trim() || '0') || 0
          const balance = parseFloat(obj.ending_balance?.trim() || '0') || 0
          const desc = obj.transaction_description || ''
          const ref  = obj.transaction_id || obj.reference_number || ''
          const remarks = [obj.remarks, obj.remarks_1].filter(Boolean).join(' · ')

          rows.push({
            transaction_date: txDate,
            description: desc + (remarks ? ' — ' + remarks : ''),
            debit, credit, balance,
            reference: ref,
            bank_name: 'UnionBank',
          })
        }
      } else {
        // ── GENERIC BANK FORMAT ──
        const lines = allLines.filter(l=>l.trim())
        const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))
        for (let i=1;i<lines.length;i++) {
          const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
          const obj = {}; headers.forEach((h,idx)=>{obj[h]=vals[idx]||''})
          const rawDate = obj.date||obj.transaction_date||obj.value_date||''
          let txDate = null
          if (rawDate) { const d=new Date(rawDate); if(!isNaN(d)) txDate=toISO(d) }
          if (!txDate) continue
          rows.push({
            transaction_date: txDate,
            description: obj.description||obj.details||obj.narration||'',
            debit:  parseFloat(obj.debit||obj.debits||obj.withdrawal||0)||0,
            credit: parseFloat(obj.credit||obj.credits||obj.deposit||0)||0,
            balance: parseFloat(obj.balance||obj.ending_balance||obj.running_balance||0)||0,
            reference: obj.reference||obj.transaction_id||obj.ref||'',
            bank_name: 'Bank',
          })
        }
      }

      if (!rows.length) { showToast('⚠️','No valid rows found in CSV'); return }
      setSaving(true)
      const { error } = await supabase.from('bank_records').insert(rows)
      if (error) { showToast('❌',error.message); setSaving(false); return }
      await fetchAll()
      showToast('✅',`${rows.length} UnionBank transactions imported`)
      setSaving(false)
    }
    reader.readAsText(file)
    e.target.value=''
  }

  // ── SAVE SALE ──
  async function saveSale() {
    if (!saleForm.gross_sales) { showToast('⚠️','Enter gross sales amount'); return }
    setSaving(true)
    const { error } = await supabase.from('sales').insert([{
      ...saleForm,
      gross_sales: parseFloat(saleForm.gross_sales)||0,
      net_sales: parseFloat(saleForm.net_sales||saleForm.gross_sales)||0,
      transaction_count: parseInt(saleForm.transaction_count)||0,
      uploaded_by:'alex'
    }])
    if (error) { showToast('❌',error.message); setSaving(false); return }
    await fetchAll(); setShowSaleForm(false); setSaleForm({sale_date:toISO(new Date()),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
    showToast('✅','Sale record added'); setSaving(false)
  }

  // ── SAVE EXPENSE ──
  async function saveExpense() {
    if (!expForm.description||!expForm.amount) { showToast('⚠️','Fill in description and amount'); return }
    setSaving(true)
    const { error } = await supabase.from('expenses').insert([{
      ...expForm, amount: parseFloat(expForm.amount)||0,
      category_id: expForm.category_id||null
    }])
    if (error) { showToast('❌',error.message); setSaving(false); return }
    await fetchAll(); setShowExpenseForm(false)
    setExpForm({expense_date:toISO(new Date()),category_id:'',description:'',amount:'',paid_by:'alex',notes:'',receipt_url:''})
    showToast('✅','Expense added'); setSaving(false)
  }

  // ── SAVE CATEGORY ──
  async function saveCategory() {
    if (!catForm.name) { showToast('⚠️','Enter category name'); return }
    const { error } = await supabase.from('expense_categories').insert([catForm])
    if (error) { showToast('❌',error.message); return }
    await fetchAll(); setShowCatForm(false); setCatForm({name:'',color:'#7ab648',icon:'📦'})
    showToast('✅','Category added')
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id',id)
    setExpenses(prev=>prev.filter(e=>e.id!==id))
    showToast('🗑️','Expense deleted')
  }

  async function deleteSale(id) {
    if (!confirm('Delete this sale record?')) return
    await supabase.from('sales').delete().eq('id',id)
    setSales(prev=>prev.filter(s=>s.id!==id))
    showToast('🗑️','Sale deleted')
  }

  // ── FORECAST ──
  function buildForecast() {
    const days = Math.max(1, Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1)
    const dailyAvgSales    = totalNet / days
    const dailyAvgExpenses = totalExpenses / days
    return [7,14,30].map(d=>({
      days: d,
      projSales: dailyAvgSales * d,
      projExpenses: dailyAvgExpenses * d,
      projNet: (dailyAvgSales - dailyAvgExpenses) * d,
    }))
  }

  const forecast = buildForecast()

  // ── EXPENSE BREAKDOWN BY CATEGORY ──
  const catBreakdown = categories.map(c=>{
    const total = expenses.filter(e=>e.category_id===c.id).reduce((a,e)=>a+(parseFloat(e.amount)||0),0)
    return { ...c, total }
  }).filter(c=>c.total>0).sort((a,b)=>b.total-a.total)

  // ── SALES BY SOURCE ──
  const salesBySource = SOURCES.map(src=>({
    ...src,
    total: sales.filter(s=>s.source===src.id).reduce((a,s)=>a+(parseFloat(s.net_sales)||0),0),
    count: sales.filter(s=>s.source===src.id).length,
  })).filter(s=>s.count>0)

  const sf = k => e => setSaleForm(prev=>({...prev,[k]:e.target.value}))
  const ef = k => e => setExpForm(prev=>({...prev,[k]:e.target.value}))
  const cf = k => e => setCatForm(prev=>({...prev,[k]:e.target.value}))

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Finance</div>
          <div className="topbar-sub">{fmtDate(dateFrom)} – {fmtDate(dateTo)}</div>
        </div>
        {/* Period selector */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',gap:5}}>
            {PERIODS.map(p=>(
              <button key={p} onClick={()=>applyPeriod(p)}
                style={{padding:'6px 12px',borderRadius:7,border:`1px solid ${period===p?'var(--espresso)':'var(--border)'}`,background:period===p?'var(--espresso)':'transparent',color:period===p?'var(--cream)':'var(--text-muted)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                {p}
              </button>
            ))}
          </div>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPeriod('')}} style={{...iStyle,width:'auto',padding:'6px 10px'}} />
          <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPeriod('')}} style={{...iStyle,width:'auto',padding:'6px 10px'}} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',gap:4}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'12px 16px',border:'none',borderBottom:`2px solid ${tab===t.id?'var(--espresso)':'transparent'}`,background:'transparent',color:tab===t.id?'var(--espresso)':'var(--text-muted)',fontSize:12,fontWeight:tab===t.id?700:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,transition:'all .15s'}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="page-content">

        {/* ── OVERVIEW / FINANCIAL STATEMENT ── */}
        {tab==='overview'&&(
          <div>
            {/* KPIs */}
            <div className="kpi-grid" style={{marginBottom:16}}>
              {[
                {label:'Gross Sales',  value:peso(totalGross),   cls:'c-matcha', icon:'💰', sub:`${sales.length} records`},
                {label:'Net Sales',    value:peso(totalNet),     cls:'c-gold',   icon:'📈', sub:'After discounts'},
                {label:'Expenses',     value:peso(totalExpenses),cls:'c-blush',  icon:'🧾', sub:`${expenses.length} entries`},
                {label:'Net Income',   value:peso(netIncome),    cls:netIncome>=0?'c-matcha':'c-bark', icon:netIncome>=0?'✅':'⚠️', sub:netIncome>=0?'Profitable':'Review expenses'},
              ].map(k=>(
                <div key={k.label} className={`kpi-card ${k.cls}`}>
                  <div className="kpi-icon">{k.icon}</div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
                  <div className="kpi-delta neutral">{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              {/* P&L Summary */}
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>Profit & Loss Summary</div>
                <PRow label="Gross Sales"        value={peso(totalGross)}    />
                <PRow label="Net Sales"          value={peso(totalNet)}      />
                <div style={{borderTop:'1px solid var(--border)',margin:'10px 0'}}/>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>Expenses by Category</div>
                {catBreakdown.length===0?(
                  <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No expenses recorded</div>
                ):catBreakdown.map(c=>(
                  <PRow key={c.id} label={`${c.icon} ${c.name}`} value={`-${peso(c.total)}`} red />
                ))}
                <div style={{borderTop:'2px solid var(--espresso)',marginTop:10,paddingTop:10}}>
                  <PRow label="TOTAL EXPENSES" value={`-${peso(totalExpenses)}`} bold red />
                  <PRow label="NET INCOME"      value={peso(netIncome)}           bold big color={netIncome>=0?'var(--matcha-dark)':'#c0392b'} />
                </div>
              </div>

              {/* Sales by source + expense breakdown */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Sales by Source</div>
                  {salesBySource.length===0?(
                    <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No sales data</div>
                  ):salesBySource.map(s=>(
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                      <span style={{fontSize:12,flex:1}}>{s.label}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>{s.count} records</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:s.color}}>{peso(s.total)}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Expense Breakdown</div>
                  {catBreakdown.length===0?(
                    <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No expenses yet</div>
                  ):catBreakdown.map(c=>{
                    const pct = totalExpenses>0?Math.round((c.total/totalExpenses)*100):0
                    return (
                      <div key={c.id} style={{marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                          <span style={{fontWeight:500}}>{c.icon} {c.name}</span>
                          <span style={{fontFamily:"'DM Mono',monospace",color:c.color,fontWeight:600}}>{peso(c.total)} <span style={{color:'var(--text-muted)',fontWeight:400}}>({pct}%)</span></span>
                        </div>
                        <div style={{height:5,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:c.color,borderRadius:4}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SALES ── */}
        {tab==='sales'&&(
          <div>
            <div style={{display:'flex',gap:9,marginBottom:16,flexWrap:'wrap'}}>
              <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
                📂 Upload StoreHub CSV
                <input type="file" accept=".csv" ref={salesFileRef} style={{display:'none'}} onChange={handleSalesCSV}/>
              </label>
              <button className="btn btn-primary" onClick={()=>setShowSaleForm(true)}>+ Add Manual Sale</button>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--matcha-dark)',fontWeight:700}}>{peso(totalNet)} net</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text-muted)'}}>{sales.length} records</div>
              </div>
            </div>

            {sales.length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>💰</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No sales records yet</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>Upload a StoreHub CSV or add a manual entry</div>
              </div>
            ):(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--espresso)'}}>
                      {['Date','Source','Gross Sales','Net Sales','Transactions','Notes',''].map(h=>(
                        <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s,i)=>{
                      const src = SOURCES.find(x=>x.id===s.source)||SOURCES[0]
                      return (
                        <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                          <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(s.sale_date)}</td>
                          <td style={{padding:'10px 14px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:src.color+'22',color:src.color}}>{src.label}</span></td>
                          <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{peso(s.gross_sales)}</td>
                          <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace"}}>{peso(s.net_sales)}</td>
                          <td style={{padding:'10px 14px',color:'var(--text-muted)'}}>{s.transaction_count||'—'}</td>
                          <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:11}}>{s.notes||'—'}</td>
                          <td style={{padding:'10px 14px'}}><button onClick={()=>deleteSale(s.id)} style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>🗑</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--espresso)'}}>
                      <td colSpan={2} style={{padding:'11px 14px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                      <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totalGross)}</td>
                      <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672'}}>{peso(totalNet)}</td>
                      <td colSpan={3}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab==='expenses'&&(
          <div>
            <div style={{display:'flex',gap:9,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              <button className="btn btn-primary" onClick={()=>setShowExpenseForm(true)}>+ Add Expense</button>
              <button onClick={()=>setShowCatForm(true)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:600,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>⚙️ Manage Categories</button>
              <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:12,color:'#c0392b',fontWeight:700}}>{peso(totalExpenses)} total</div>
            </div>

            {expenses.length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>🧾</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No expenses yet</div>
                <button className="btn btn-primary" onClick={()=>setShowExpenseForm(true)}>+ Add First Expense</button>
              </div>
            ):(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--espresso)'}}>
                      {['Date','Category','Description','Amount','Paid By','Receipt',''].map(h=>(
                        <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e,i)=>{
                      const cat = e.expense_categories
                      return (
                        <tr key={e.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                          <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(e.expense_date)}</td>
                          <td style={{padding:'10px 14px'}}>
                            {cat?<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:cat.color+'22',color:cat.color}}>{cat.icon} {cat.name}</span>:<span style={{color:'var(--text-muted)',fontSize:11}}>Uncategorized</span>}
                          </td>
                          <td style={{padding:'10px 14px',fontWeight:500}}>{e.description}</td>
                          <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#c0392b'}}>{peso(e.amount)}</td>
                          <td style={{padding:'10px 14px',color:'var(--text-muted)',textTransform:'capitalize'}}>{e.paid_by||'—'}</td>
                          <td style={{padding:'10px 14px'}}>
                            {e.receipt_url?<a href={e.receipt_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:'var(--sky)',fontWeight:600,textDecoration:'none'}}>📎 View</a>:<span style={{color:'var(--border)',fontSize:11}}>—</span>}
                          </td>
                          <td style={{padding:'10px 14px'}}><button onClick={()=>deleteExpense(e.id)} style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>🗑</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--espresso)'}}>
                      <td colSpan={3} style={{padding:'11px 14px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                      <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#f5a0a0'}}>{peso(totalExpenses)}</td>
                      <td colSpan={3}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── FORECAST ── */}
        {tab==='forecast'&&(
          <div>
            <div style={{background:'var(--sky-pale)',border:'1px solid #4a90c444',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:12,color:'var(--sky)'}}>
              💡 Forecast is based on your average daily sales and expenses from the selected period ({fmtDate(dateFrom)} – {fmtDate(dateTo)}).
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16}}>
              {forecast.map(f=>(
                <div key={f.days} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',borderTop:`3px solid ${f.projNet>=0?'var(--matcha)':'#c0392b'}`}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:10}}>Next {f.days} Days</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:2}}>PROJECTED SALES</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:'var(--matcha-dark)'}}>{peso(f.projSales)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:2}}>PROJECTED EXPENSES</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,color:'#c0392b'}}>-{peso(f.projExpenses)}</div>
                    </div>
                    <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
                      <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:2}}>PROJECTED NET</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,color:f.projNet>=0?'var(--matcha-dark)':'#c0392b'}}>{peso(f.projNet)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:12}}>Daily Averages (Based on Selected Period)</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {[
                  ['Avg Daily Sales',    peso(totalNet/Math.max(1,Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1)),    'var(--matcha-dark)'],
                  ['Avg Daily Expenses', peso(totalExpenses/Math.max(1,Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1)), '#c0392b'],
                  ['Avg Daily Net',      peso((totalNet-totalExpenses)/Math.max(1,Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1)), netIncome>=0?'var(--matcha-dark)':'#c0392b'],
                ].map(([label,value,color])=>(
                  <div key={label} style={{background:'var(--surface)',borderRadius:10,padding:'14px'}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>{label}</div>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,color}}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BANK RECORDS ── */}
        {tab==='bank'&&(
          <div>
            <div style={{display:'flex',gap:9,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
                📂 Upload Bank Statement CSV
                <input type="file" accept=".csv" ref={bankFileRef} style={{display:'none'}} onChange={handleBankCSV}/>
              </label>
              <div style={{fontSize:11,color:'var(--text-muted)',background:'var(--surface)',border:'1px solid var(--border)',padding:'7px 12px',borderRadius:8}}>
                ✅ UnionBank format supported · Also works with BDO, BPI, Metrobank CSV exports
              </div>
              <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text-muted)'}}>{bankRecords.length} transactions</div>
            </div>

            {bankRecords.length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>🏦</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No bank records yet</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>Upload your bank statement CSV to get started</div>
              </div>
            ):(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--espresso)'}}>
                      {['Date','Description','Reference','Debit','Credit','Balance','Bank'].map(h=>(
                        <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bankRecords.map((r,i)=>(
                      <tr key={r.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                        <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(r.transaction_date)}</td>
                        <td style={{padding:'10px 14px',fontWeight:500,maxWidth:200}}>{r.description||'—'}</td>
                        <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:11}}>{r.reference||'—'}</td>
                        <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:r.debit>0?'#c0392b':'var(--text-muted)',fontWeight:r.debit>0?600:400}}>{r.debit>0?peso(r.debit):'—'}</td>
                        <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:r.credit>0?'var(--matcha-dark)':'var(--text-muted)',fontWeight:r.credit>0?600:400}}>{r.credit>0?peso(r.credit):'—'}</td>
                        <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{peso(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <Modal open={showSaleForm} onClose={()=>setShowSaleForm(false)} title="Add Sale Record">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
          <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Date *</label><input style={iStyle} type="date" value={saleForm.sale_date} onChange={sf('sale_date')}/></div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lStyle}>Source *</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
              {SOURCES.map(src=>(
                <div key={src.id} onClick={()=>setSaleForm(p=>({...p,source:src.id}))}
                  style={{padding:'8px',borderRadius:8,border:`1.5px solid ${saleForm.source===src.id?src.color:'var(--border)'}`,background:saleForm.source===src.id?src.color+'22':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:saleForm.source===src.id?src.color:'var(--text-muted)',transition:'all .15s'}}>
                  {src.label}
                </div>
              ))}
            </div>
          </div>
          <div><label style={lStyle}>Gross Sales *</label><input style={iStyle} type="number" placeholder="0.00" value={saleForm.gross_sales} onChange={sf('gross_sales')}/></div>
          <div><label style={lStyle}>Net Sales</label><input style={iStyle} type="number" placeholder="Same as gross if no discount" value={saleForm.net_sales} onChange={sf('net_sales')}/></div>
          <div><label style={lStyle}>Transactions</label><input style={iStyle} type="number" placeholder="0" value={saleForm.transaction_count} onChange={sf('transaction_count')}/></div>
          <div><label style={lStyle}>Notes</label><input style={iStyle} placeholder="Optional" value={saleForm.notes} onChange={sf('notes')}/></div>
        </div>
        <div style={{display:'flex',gap:9}}>
          <button className="btn btn-secondary" onClick={()=>setShowSaleForm(false)}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={saveSale} disabled={saving}>{saving?'Saving…':'✓ Add Sale'}</button>
        </div>
      </Modal>

      <Modal open={showExpenseForm} onClose={()=>setShowExpenseForm(false)} title="Add Expense">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
          <div><label style={lStyle}>Date *</label><input style={iStyle} type="date" value={expForm.expense_date} onChange={ef('expense_date')}/></div>
          <div>
            <label style={lStyle}>Category</label>
            <select style={iStyle} value={expForm.category_id} onChange={ef('category_id')}>
              <option value="">Uncategorized</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Description *</label><input style={iStyle} placeholder="What was this expense for?" value={expForm.description} onChange={ef('description')}/></div>
          <div><label style={lStyle}>Amount *</label><input style={iStyle} type="number" placeholder="0.00" value={expForm.amount} onChange={ef('amount')}/></div>
          <div>
            <label style={lStyle}>Paid By</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
              {[['alex','Alex'],['cj','CJ']].map(([val,label])=>(
                <div key={val} onClick={()=>setExpForm(p=>({...p,paid_by:val}))}
                  style={{padding:'8px',borderRadius:8,border:`1.5px solid ${expForm.paid_by===val?'var(--matcha)':'var(--border)'}`,background:expForm.paid_by===val?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:expForm.paid_by===val?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Receipt URL (Google Drive link)</label><input style={iStyle} placeholder="https://drive.google.com/..." value={expForm.receipt_url} onChange={ef('receipt_url')}/></div>
          <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Notes</label><input style={iStyle} placeholder="Optional" value={expForm.notes} onChange={ef('notes')}/></div>
        </div>
        <div style={{display:'flex',gap:9}}>
          <button className="btn btn-secondary" onClick={()=>setShowExpenseForm(false)}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={saveExpense} disabled={saving}>{saving?'Saving…':'✓ Add Expense'}</button>
        </div>
      </Modal>

      <Modal open={showCatForm} onClose={()=>setShowCatForm(false)} title="Manage Expense Categories">
        <div style={{marginBottom:16}}>
          {categories.map(c=>(
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:'var(--surface)',borderRadius:9,marginBottom:6,border:'1px solid var(--border)'}}>
              <span style={{fontSize:16}}>{c.icon}</span>
              <span style={{flex:1,fontSize:12,fontWeight:600}}>{c.name}</span>
              <div style={{width:14,height:14,borderRadius:'50%',background:c.color}}/>
            </div>
          ))}
        </div>
        <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Add New Category</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,marginBottom:10}}>
            <input style={iStyle} placeholder="Category name" value={catForm.name} onChange={cf('name')}/>
            <input style={{...iStyle,width:50,padding:'9px 6px'}} placeholder="📦" value={catForm.icon} onChange={cf('icon')}/>
            <input type="color" value={catForm.color} onChange={cf('color')} style={{width:42,height:38,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
          </div>
          <button className="btn btn-primary" style={{width:'100%'}} onClick={saveCategory}>+ Add Category</button>
        </div>
      </Modal>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

function PRow({ label, value, bold, big, red, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:big?14:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:bold?700:400}}>{label}</span>
      <span style={{fontWeight:bold?700:500,color:color||(red?'#c0392b':bold?'var(--espresso)':'var(--text-primary)'),fontFamily:"'DM Mono',monospace"}}>{value}</span>
    </div>
  )
}
