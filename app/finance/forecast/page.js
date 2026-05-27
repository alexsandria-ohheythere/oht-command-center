'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}

export default function ForecastPage() {
  const supabase = createClient()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(toISO(new Date(today.getFullYear(),today.getMonth(),1)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [sales, setSales]       = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(()=>{ fetchData() },[dateFrom,dateTo])

  async function fetchData() {
    setLoading(true)
    const [{data:s},{data:e}] = await Promise.all([
      supabase.from('sales').select('*').gte('sale_date',dateFrom).lte('sale_date',dateTo),
      supabase.from('expenses').select('*').gte('expense_date',dateFrom).lte('expense_date',dateTo),
    ])
    setSales(s||[]); setExpenses(e||[]); setLoading(false)
  }

  const totalNet      = sales.reduce((a,s)=>a+(parseFloat(s.net_sales)||0),0)
  const totalExpenses = expenses.reduce((a,e)=>a+(parseFloat(e.amount)||0),0)
  const days = Math.max(1, Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1)
  const dailySales    = totalNet / days
  const dailyExpenses = totalExpenses / days
  const dailyNet      = dailySales - dailyExpenses

  const projections = [7,14,30,60,90].map(d=>({
    days: d,
    sales:    dailySales * d,
    expenses: dailyExpenses * d,
    net:      dailyNet * d,
  }))

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Forecast</div><div className="topbar-sub">Based on data from {fmtDate(dateFrom)} – {fmtDate(dateTo)}</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
        </div>
      </div>
      <div className="page-content">
        {/* Daily averages */}
        <div className="kpi-grid" style={{marginBottom:20}}>
          {[
            {label:'Daily Avg Sales',    value:peso(dailySales),    cls:'c-matcha', icon:'📈'},
            {label:'Daily Avg Expenses', value:peso(dailyExpenses), cls:'c-blush',  icon:'📉'},
            {label:'Daily Avg Net',      value:peso(dailyNet),      cls:dailyNet>=0?'c-gold':'c-bark', icon:dailyNet>=0?'✅':'⚠️'},
            {label:'Days in Sample',     value:days+' days',        cls:'c-bark',   icon:'📅'},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{background:'var(--sky-pale)',border:'1px solid #4a90c444',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:12,color:'var(--sky)'}}>
          💡 Projections are based on your average daily sales of <strong>{peso(dailySales)}</strong> and daily expenses of <strong>{peso(dailyExpenses)}</strong> from the selected period.
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
          {projections.map(p=>(
            <div key={p.days} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',borderTop:`3px solid ${p.net>=0?'var(--matcha)':'#c0392b'}`}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:14}}>Next {p.days} Days</div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:3}}>PROJECTED SALES</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,color:'var(--matcha-dark)'}}>{peso(p.sales)}</div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:3}}>PROJECTED EXPENSES</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:'#c0392b'}}>-{peso(p.expenses)}</div>
              </div>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
                <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:3}}>PROJECTED NET</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,color:p.net>=0?'var(--matcha-dark)':'#c0392b'}}>{peso(p.net)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}
