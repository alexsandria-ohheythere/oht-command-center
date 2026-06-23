'use client'
import { useState, useEffect } from 'react'
import React from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

// ── Admin Messenger Link Card ────────────────────────────────────────────────
function AdminMessengerCard({ staffId, onLinked }) {
  const [code, setCode]       = React.useState(null)
  const [expires, setExpires] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [copied, setCopied]   = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState(null)

  React.useEffect(() => {
    if (!expires) return
    const interval = setInterval(() => {
      const secs = Math.round((new Date(expires) - Date.now()) / 1000)
      if (secs <= 0) { setCode(null); setExpires(null); setTimeLeft(null); clearInterval(interval) }
      else setTimeLeft(secs)
    }, 1000)
    return () => clearInterval(interval)
  }, [expires])

  async function generateCode() {
    setLoading(true)
    try {
      const res = await fetch('/api/messenger/generate-code', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ staffId })
      })
      const data = await res.json()
      if (data.code) { setCode(data.code); setExpires(data.expiresAt) }
    } catch(e) {}
    setLoading(false)
  }

  function copyCode() {
    navigator.clipboard.writeText('LINK-' + code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{background:'white',border:'1.5px solid #d8cebb',borderRadius:13,padding:'16px 18px',marginBottom:16,borderTop:'3px solid #0084ff'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:22}}>💬</span>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Link Your Messenger</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Get shift updates, job orders & alerts sent directly to your Messenger.</div>
        </div>
      </div>
      {!code ? (
        <button onClick={generateCode} disabled={loading}
          style={{padding:'9px 16px',background:'#0084ff',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',opacity:loading?0.7:1,fontFamily:"'DM Sans',sans-serif"}}>
          {loading ? 'Generating…' : '🔗 Get My Link Code'}
        </button>
      ) : (
        <div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>
            Send this to the <strong>Oh Hey There Matcha</strong> Facebook Page on Messenger:
          </div>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <code style={{fontFamily:'monospace',fontSize:18,fontWeight:700,letterSpacing:2,color:'var(--text-primary)'}}>LINK-{code}</code>
            <button onClick={copyCode}
              style={{padding:'6px 14px',background:copied?'#7ab648':'#1a1208',color:'white',border:'none',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',transition:'background .2s',fontFamily:"'DM Sans',sans-serif"}}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{fontSize:11,color:timeLeft < 60?'#c0392b':'var(--text-muted)'}}>
            ⏱ Expires in {timeLeft >= 60 ? Math.floor(timeLeft/60)+'m '+timeLeft%60+'s' : timeLeft+'s'}
            <button onClick={generateCode} style={{marginLeft:12,background:'none',border:'none',color:'#0084ff',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}


const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()

const SHIFT_BADGE = {
  am:  { label:'AM',  bg:'#eef7e4', color:'#4a7a1e', border:'#7ab648' },
  ops: { label:'OPS', bg:'#f5eeff', color:'#7a3a8a', border:'#b06af5' },
  mid: { label:'MID', bg:'#fef3e2', color:'#a06000',  border:'#d4a843' },
  pm:  { label:'PM',  bg:'#e8f0fb', color:'#2d5a8a',  border:'#4a90c4' },
}

// Daily rate lookup (mirrors lib/payroll.js RATES)
const RATES = {
  'Full-time': {
    'Senior Barista':                { monthly: 17000 },
    'Executive Chef':                { monthly: 17000 },
    'Junior Barista - Milk Station': { monthly: 14000 },
    'Junior Barista - Cashier':      { monthly: 14000 },
    'Sous Chef':                     { monthly: 15000 },
  },
  'Part-time': {
    'Senior Barista':                { daily: 850 },
    'Executive Chef':                { daily: 850 },
    'Junior Barista - Milk Station': { daily: 700 },
    'Junior Barista - Cashier':      { daily: 700 },
    'Sous Chef':                     { daily: 700 },
    'Kitchen Staff':                 { daily: 700 },
  },
  'Freelancer': {
    'Cafe Supervisor':               { daily: 1150 },
    'Cafe Operations Support':       { daily: 750  },
    'Senior Barista':                { daily: 850  },
    'Executive Chef':                { daily: 850  },
    'Junior Barista - Milk Station': { daily: 700  },
    'Junior Barista - Cashier':      { daily: 700  },
    'Sous Chef':                     { daily: 700  },
    'Kitchen Staff':                 { daily: 700  },
  },
}
function getDailyRate(employment_type, role) {
  const typeRates = RATES[employment_type]
  if (!typeRates) return 0
  const r = typeRates[role]
  if (!r) return 0
  if (r.daily) return r.daily
  if (r.monthly) return r.monthly / 26
  return 0
}

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})

// Mini bar chart for daily sales
function SalesBarChart({ data, loading }) {
  if (loading) return <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
  if (!data.length) return <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:12}}>No sales data this month</div>
  const max = Math.max(...data.map(d=>d.total), 1)
  const barW = Math.max(8, Math.floor(540 / data.length) - 4)
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:3,height:110,paddingBottom:24,paddingTop:8,overflowX:'auto'}}>
      {data.map((d,i) => {
        const pct = d.total / max
        const h = Math.max(4, Math.round(pct * 90))
        const isToday = d.date === toISO(new Date())
        return (
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flexShrink:0,width:barW+4}}>
            <div title={`${d.label}: ${peso(d.total)}`}
              style={{width:barW,height:h,borderRadius:'4px 4px 0 0',
                background:isToday?'var(--matcha-dark)':'#7ab64866',
                cursor:'pointer',transition:'background .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background=isToday?'#2d5a1e':'#7ab648'}
              onMouseLeave={e=>e.currentTarget.style.background=isToday?'var(--matcha-dark)':'#7ab64866'}
            />
            <span style={{fontSize:8,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace",transform:'rotate(-45deg)',transformOrigin:'top left',whiteSpace:'nowrap',marginTop:2}}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const today = toISO(new Date())
  const todayLabel = new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

  const now = new Date()
  const monthStart = toISO(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd   = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const monthLabel = now.toLocaleDateString('en-PH',{month:'long',year:'numeric'})

  const [loading, setLoading]                 = useState(true)
  const [userRole, setUserRole]               = useState('admin')
  const [userEmail, setUserEmail]             = useState('')
  const [messengerProfile, setMessengerProfile] = useState(null)

  // KPI data
  const [incidentCount, setIncidentCount]     = useState(0)
  const [pendingInventory, setPendingInventory] = useState(0)
  const [pendingLeaves, setPendingLeaves]     = useState(0)
  const [manpowerCost, setManpowerCost]       = useState(0)
  const [todayShifts, setTodayShifts]         = useState([])

  // Finance
  const [totalSales, setTotalSales]           = useState(0)
  const [totalExpenses, setTotalExpenses]     = useState(0)
  const [financeLoading, setFinanceLoading]   = useState(true)

  // Daily sales chart
  const [dailySales, setDailySales]           = useState([])
  const [chartLoading, setChartLoading]       = useState(true)

  // Targets
  const [salesTargets, setSalesTargets]       = useState({ daily_target: 0, monthly_target: 0 })
  const [todaySalesTotal, setTodaySalesTotal] = useState(0)

  // Check-in data
  const [taskAssignments, setTaskAssignments]  = useState([])
  const [staffMap, setStaffMap]               = useState({})

  // Job orders
  const [jobOrders, setJobOrders]             = useState([])

  // Announcements
  const [announcements, setAnnouncements]     = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const email = session?.user?.email?.toLowerCase() || ''
      setUserEmail(email)
      setUserRole(email === 'hr.ohtgroup@gmail.com' ? 'hr' : 'admin')
      if (email) {
        const supabaseInner = createClient()
        const { data: mp } = await supabaseInner.from('staff').select('id,messenger_psid,messenger_opted_in').eq('email', email).single()
        setMessengerProfile(mp || null)
      }
    })
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    setLoading(true)
    const [
      { data: schedules },
      { data: leaves },
      { data: incidents },
      { data: inventoryPending },
      { data: staffAll },
      { data: checkinData },
      { data: jobData },
      { data: announceData },
    ] = await Promise.all([
      supabase.from('schedules').select('*, staff(first_name,last_name,role,nickname,employment_type)').eq('shift_date', today),
      supabase.from('leave_requests').select('id').eq('status','pending'),
      supabase.from('incident_reports').select('id').eq('status','pending'),
      supabase.from('inventory_reports').select('id').eq('status','pending'),
      supabase.from('staff').select('id,first_name,last_name,role,employment_type'),
      supabase.from('shift_task_assignments').select('*').eq('shift_date', today),
      supabase.from('job_orders').select('*, staff(first_name,last_name)').in('status',['todo','inprogress']).order('created_at',{ascending:false}).limit(6),
      supabase.from('announcements').select('*').order('created_at',{ascending:false}).limit(3),
    ])

    const shifts = schedules || []
    setTodayShifts(shifts)
    setPendingLeaves((leaves||[]).length)
    setIncidentCount((incidents||[]).length)
    setPendingInventory((inventoryPending||[]).length)
    setTaskAssignments(checkinData || [])
    setJobOrders(jobData || [])
    setAnnouncements(announceData || [])

    // Build staff lookup
    const sMap = {}
    ;(staffAll||[]).forEach(s => { sMap[s.id] = s })
    setStaffMap(sMap)

    // Compute today's manpower cost from scheduled shifts
    let cost = 0
    shifts.forEach(s => {
      const st = s.staff
      if (st) cost += getDailyRate(st.employment_type, st.role)
    })
    setManpowerCost(cost)

    setLoading(false)
    fetchFinance()
  }

  async function fetchFinance() {
    setFinanceLoading(true)
    setChartLoading(true)
    const [
      { data: salesData },
      { data: expensesData },
      { data: allSalesData },
      { data: todaySalesData },
      { data: targetsData },
    ] = await Promise.all([
      supabase.from('sales').select('gross_sales').gte('sale_date', monthStart).lte('sale_date', monthEnd),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('sales').select('sale_date,gross_sales').gte('sale_date', monthStart).lte('sale_date', monthEnd).order('sale_date',{ascending:true}),
      supabase.from('sales').select('gross_sales').eq('sale_date', today),
      supabase.from('settings').select('value').eq('key','sales_targets').single(),
    ])
    const sales = (salesData||[]).reduce((sum,r)=>sum+(parseFloat(r.gross_sales)||0),0)
    const expenses = (expensesData||[]).reduce((sum,r)=>sum+(parseFloat(r.amount)||0),0)
    const todayTotal = (todaySalesData||[]).reduce((sum,r)=>sum+(parseFloat(r.gross_sales)||0),0)
    setTotalSales(sales)
    setTotalExpenses(expenses)
    setTodaySalesTotal(todayTotal)
    if (targetsData?.value) {
      try { setSalesTargets(JSON.parse(targetsData.value)) } catch(e) {}
    }
    setFinanceLoading(false)

    // Aggregate daily sales for chart
    const byDate = {}
    ;(allSalesData||[]).forEach(r => {
      byDate[r.sale_date] = (byDate[r.sale_date]||0) + (parseFloat(r.gross_sales)||0)
    })
    const chartData = Object.entries(byDate).map(([date, total]) => ({
      date,
      total,
      label: new Date(date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}),
    }))
    setDailySales(chartData)
    setChartLoading(false)
  }

  const netSales = totalSales - totalExpenses
  const pendingCount = pendingLeaves

  const JO_STATUS = {
    todo:       { label:'To Do',       color:'#7a6a50', bg:'#f5f0e8' },
    inprogress: { label:'In Progress', color:'#a06000', bg:'#fef3e2' },
    done:       { label:'Done',        color:'#4a7a1e', bg:'#eef7e4' },
  }
  const JO_PRIORITY = {
    urgent: { color:'#c0392b' },
    high:   { color:'#e8845a' },
    normal: { color:'#4a90c4' },
    low:    { color:'#7a6a50' },
  }

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Good morning ☀️</div>
          <div className="topbar-sub">{todayLabel} · Oh Hey There Command Center</div>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',background:'var(--surface)',border:'1px solid var(--border)',padding:'5px 11px',borderRadius:7}}>
          {new Date().toLocaleDateString('en-PH',{weekday:'short'})}
        </div>
      </div>

      <div className="page-content">

        {/* MESSENGER LINK CARD */}
        {userRole !== 'hr' && messengerProfile && !messengerProfile.messenger_opted_in && (
          <AdminMessengerCard staffId={messengerProfile.id} onLinked={() => setMessengerProfile(p=>({...p,messenger_opted_in:true}))} />
        )}
        {userRole !== 'hr' && messengerProfile?.messenger_opted_in && (
          <div style={{background:'#eef7e4',border:'1.5px solid #7ab648',borderRadius:13,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:20}}>💬</span>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color:'#4a7a1e'}}>Messenger Linked ✅ <span style={{fontSize:11,fontWeight:400}}>— You'll receive OHT notifications in Messenger.</span></div>
          </div>
        )}

        {/* FINANCE STRIP — hidden for HR */}
        {userRole !== 'hr' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          {/* Sales This Month */}
          <a href="/finance/sales" style={{textDecoration:'none'}}>
            <div className="card fade-up" style={{cursor:'pointer',borderTop:'3px solid #7ab648',transition:'box-shadow .15s'}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px #7ab64822'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)'}}>Sales · {monthLabel}</span>
                <span style={{fontSize:16}}>💰</span>
              </div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:'#4a7a1e'}}>
                {financeLoading ? '…' : peso(totalSales)}
              </div>
              <div style={{fontSize:10,color:'var(--matcha-dark)',marginTop:4,fontWeight:600}}>View Sales →</div>
            </div>
          </a>

          {/* Expenses This Month */}
          <a href="/finance/expenses" style={{textDecoration:'none'}}>
            <div className="card fade-up" style={{cursor:'pointer',borderTop:'3px solid #e8845a',transition:'box-shadow .15s'}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px #e8845a22'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)'}}>Expenses · {monthLabel}</span>
                <span style={{fontSize:16}}>📋</span>
              </div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:'#c0392b'}}>
                {financeLoading ? '…' : peso(totalExpenses)}
              </div>
              <div style={{fontSize:10,color:'#e8845a',marginTop:4,fontWeight:600}}>View Expenses →</div>
            </div>
          </a>

          {/* Net Sales */}
          <a href="/finance/financial-statement" style={{textDecoration:'none'}}>
            <div className="card fade-up" style={{cursor:'pointer',borderTop:`3px solid ${netSales>=0?'#4a90c4':'#c0392b'}`,transition:'box-shadow .15s'}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px #4a90c422'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)'}}>Net Sales · {monthLabel}</span>
                <span style={{fontSize:16}}>📊</span>
              </div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:financeLoading?'var(--text-muted)':netSales>=0?'#2d5a8a':'#c0392b'}}>
                {financeLoading ? '…' : peso(netSales)}
              </div>
              <div style={{fontSize:10,color:'#4a90c4',marginTop:4,fontWeight:600}}>Full P&L →</div>
            </div>
          </a>
        </div>
        )}

        {/* TARGET ALERTS — hidden for HR */}
        {userRole !== 'hr' && !financeLoading && (salesTargets.daily_target > 0 || salesTargets.monthly_target > 0) && (() => {
          const dailyPct  = salesTargets.daily_target  > 0 ? (todaySalesTotal  / salesTargets.daily_target)  * 100 : null
          const monthlyPct = salesTargets.monthly_target > 0 ? (totalSales / salesTargets.monthly_target) * 100 : null
          const items = []
          if (dailyPct !== null) items.push({
            label: "Today's Sales vs Daily Target",
            actual: todaySalesTotal,
            target: salesTargets.daily_target,
            pct: dailyPct,
          })
          if (monthlyPct !== null) items.push({
            label: `${monthLabel} Sales vs Monthly Target`,
            actual: totalSales,
            target: salesTargets.monthly_target,
            pct: monthlyPct,
          })
          return (
            <div style={{display:'grid',gridTemplateColumns:`repeat(${items.length},1fr)`,gap:12,marginBottom:16}}>
              {items.map((item,i) => {
                const color = item.pct >= 100 ? '#2ecc71' : item.pct >= 80 ? '#e67e22' : '#e74c3c'
                const bg    = item.pct >= 100 ? '#eafaf1' : item.pct >= 80 ? '#fef9e7' : '#fdeaea'
                const border= item.pct >= 100 ? '#a9dfbf' : item.pct >= 80 ? '#f9e79f' : '#f5c6c6'
                const icon  = item.pct >= 100 ? '✅' : item.pct >= 80 ? '⚠️' : '🚨'
                const statusText = item.pct >= 100
                  ? 'Target reached!'
                  : `${peso(item.target - item.actual)} more needed`
                return (
                  <div key={i} className="card fade-up" style={{borderTop:`3px solid ${color}`,background:bg,border:`1px solid ${border}`,padding:'16px 20px'}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6}}>{icon} {item.label}</div>
                    <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
                      <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color}}>{peso(item.actual)}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)'}}>of {peso(item.target)}</span>
                    </div>
                    <div style={{background:'rgba(0,0,0,.07)',borderRadius:99,height:7,overflow:'hidden',marginBottom:6}}>
                      <div style={{height:'100%',width:`${Math.min(100,item.pct)}%`,background:color,borderRadius:99,transition:'width .4s ease'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color}}>
                      <span style={{fontWeight:700}}>{item.pct.toFixed(1)}% achieved</span>
                      <span>{statusText}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* KPI STRIP */}
        <div className="kpi-grid fade-up" style={{marginBottom:20}}>
          {[
            {
              label:'Incident Reports',
              value: loading?'…':incidentCount,
              delta: incidentCount>0?'Pending review':'All clear',
              dir: incidentCount>0?'down':'up',
              icon:'⚠️', cls:'c-blush', href:'/reports'
            },
            {
              label:'Inventory Approval',
              value: loading?'…':pendingInventory,
              delta: pendingInventory>0?'Awaiting approval':'Queue clear',
              dir: pendingInventory>0?'down':'up',
              icon:'📦', cls:'c-bark', href:'/inventory/inventory-approvals'
            },
            {
              label:'Pending Leaves',
              value: loading?'…':pendingCount,
              delta: pendingCount>0?'Need approval':'All clear',
              dir: pendingCount>0?'down':'up',
              icon:'🗓️', cls:'c-gold', href:'/leave'
            },
            {
              label:'Manpower Cost Today',
              value: loading?'…':peso(manpowerCost),
              delta: loading?'…':`${todayShifts.length} shift${todayShifts.length!==1?'s':''} scheduled`,
              dir:'neutral', icon:'💸', cls:'c-matcha', href:'/schedule'
            },
          ].map(k => (
            <a key={k.label} href={k.href} style={{textDecoration:'none'}}>
              <div className={`kpi-card ${k.cls}`} style={{cursor:'pointer'}}>
                <div className="kpi-icon">{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{fontSize:'clamp(16px,2vw,26px)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{k.value}</div>
                <div className={`kpi-delta ${k.dir}`}>{k.delta}</div>
              </div>
            </a>
          ))}
        </div>

        {/* DAILY SALES CHART */}
        {userRole !== 'hr' && (
        <div className="card fade-up" style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Daily Sales — {monthLabel}</div>
            <a href="/finance/sales" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>View All →</a>
          </div>
          <SalesBarChart data={dailySales} loading={chartLoading} />
        </div>
        )}

        {/* DAILY CHECK-IN + JOB ORDERS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

          {/* Daily Check-In Data */}
          <div className="card fade-up">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Daily Check-In</div>
              <a href="/checkin" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>Open →</a>
            </div>
            {loading ? (
              <div style={{textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
            ) : todayShifts.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:12}}>No shifts scheduled today</div>
            ) : (() => {
              const shiftGroups = ['am','ops','mid','pm']
              return (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {shiftGroups.map(shiftId => {
                    const shiftStaff = todayShifts.filter(s => s.shift_type === shiftId)
                    if (!shiftStaff.length) return null
                    const badge = SHIFT_BADGE[shiftId]
                    // Count staff with at least one completed task (= active in shift)
                    const checkedIn = shiftStaff.filter(s =>
                      taskAssignments.some(t => t.staff_id === s.staff_id && t.shift_type === shiftId && t.completed)
                    ).length
                    const pct = Math.round((checkedIn / shiftStaff.length) * 100)
                    return (
                      <div key={shiftId} style={{padding:'10px 12px',background:badge.bg,borderRadius:10,border:`1px solid ${badge.border}44`}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:11,fontWeight:700,color:badge.color}}>{badge.label} Shift</span>
                          <span style={{fontSize:10,color:badge.color,fontWeight:600}}>{checkedIn}/{shiftStaff.length} in</span>
                        </div>
                        {/* Progress bar */}
                        <div style={{height:5,background:'white',borderRadius:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:badge.border,borderRadius:4,transition:'width .4s ease'}}/>
                        </div>
                        {/* Avatars */}
                        <div style={{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}}>
                          {shiftStaff.slice(0,6).map(s => {
                            const isIn = taskAssignments.some(t => t.staff_id === s.staff_id && t.shift_type === shiftId && t.completed)
                            return (
                              <div key={s.id}
                                title={`${s.staff?.first_name} ${s.staff?.last_name}${isIn?' ✔':' – not in'}`}
                                style={{width:24,height:24,borderRadius:'50%',
                                  background:isIn?getRoleColor(s.staff?.role||''):'#ccc',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:8,fontWeight:700,color:'white',
                                  border:`2px solid ${isIn?badge.border:'#ddd'}`}}>
                                {initials(s.staff?.first_name||'',s.staff?.last_name||'')}
                              </div>
                            )
                          })}
                          {shiftStaff.length > 6 && <span style={{fontSize:10,color:badge.color,alignSelf:'center'}}>+{shiftStaff.length-6}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Job Orders */}
          <div className="card fade-up">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Job Orders</div>
              <a href="/tasks" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>View All →</a>
            </div>
            {loading ? (
              <div style={{textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
            ) : jobOrders.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:12}}>No active job orders</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {jobOrders.map(jo => {
                  const st = JO_STATUS[jo.status] || JO_STATUS.todo
                  const pr = JO_PRIORITY[jo.priority] || JO_PRIORITY.normal
                  return (
                    <div key={jo.id} style={{padding:'9px 11px',background:'var(--surface)',borderRadius:9,border:'1px solid var(--cream-dark)',borderLeft:`3px solid ${pr.color}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'space-between'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{jo.title}</div>
                          {jo.ticket_no && <div style={{fontSize:9,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace",marginTop:2}}>{jo.ticket_no}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                          {jo.staff && <span style={{fontSize:9,color:'var(--text-muted)'}}>{jo.staff.first_name}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ANNOUNCEMENTS */}
        <div className="card fade-up">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Announcements</div>
            <a href="/announce" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>View all →</a>
          </div>
          {announcements.length === 0 ? (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {title:'🌿 New Matcha Menu Drop — This Friday!',body:"We're launching 3 new menu items. All baristas must complete recipe training by Thursday.",time:'Posted by CJ · Today',cls:'var(--matcha)',bg:'#f0f8e8'},
                {title:'⚠️ Payroll Processing — Sunday 5PM Cutoff',body:'Please submit DTR corrections before Sunday 5PM.',time:'Posted by Alex · Yesterday',cls:'var(--gold)',bg:'#fef8ec'},
              ].map((a,i)=>(
                <div key={i} style={{padding:'11px 13px',borderRadius:9,borderLeft:`3px solid ${a.cls}`,background:a.bg}}>
                  <div style={{fontSize:12,fontWeight:700}}>{a.title}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3,lineHeight:1.5}}>{a.body}</div>
                  <div style={{fontSize:10,color:'#bbb',marginTop:5,fontFamily:"'DM Mono',monospace"}}>{a.time}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {announcements.map((a,i)=>(
                <div key={i} style={{padding:'11px 13px',borderRadius:9,borderLeft:'3px solid var(--matcha)',background:'#f0f8e8'}}>
                  <div style={{fontSize:12,fontWeight:700}}>{a.title||a.content?.slice(0,60)}</div>
                  <div style={{fontSize:10,color:'#bbb',marginTop:4,fontFamily:"'DM Mono',monospace"}}>
                    {new Date(a.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AuthShell>
  )
}
