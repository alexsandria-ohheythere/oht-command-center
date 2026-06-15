'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

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
  mid: { label:'MID', bg:'#fef3e2', color:'#a06000',  border:'#d4a843' },
  pm:  { label:'PM',  bg:'#e8f0fb', color:'#2d5a8a',  border:'#4a90c4' },
}

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function DashboardPage() {
  const supabase = createClient()
  const today = toISO(new Date())
  const todayLabel = new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

  // Month range
  const now = new Date()
  const monthStart = toISO(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd   = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const monthLabel = now.toLocaleDateString('en-PH',{month:'long',year:'numeric'})

  const [staffList, setStaffList]         = useState([])
  const [todayShifts, setTodayShifts]     = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading]             = useState(true)

  // Finance state
  const [totalSales, setTotalSales]       = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [financeLoading, setFinanceLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    setLoading(true)
    const [
      { data: staff },
      { data: schedules },
      { data: leaves },
      { data: announceData },
    ] = await Promise.all([
      supabase.from('staff').select('*'),
      supabase.from('schedules').select('*, staff(first_name,last_name,role,nickname)').eq('shift_date', today),
      supabase.from('leave_requests').select('*, staff(first_name,last_name)').eq('status','pending').order('created_at',{ascending:false}).limit(5),
      supabase.from('announcements').select('*').order('created_at',{ascending:false}).limit(3).catch(()=>({data:[]})),
    ])
    setStaffList(staff || [])
    setTodayShifts(schedules || [])
    setPendingLeaves(leaves || [])
    setAnnouncements(announceData || [])
    setLoading(false)

    // Fetch finance separately so it doesn't block main load
    fetchFinance()
  }

  async function fetchFinance() {
    setFinanceLoading(true)
    const [
      { data: salesData },
      { data: expensesData },
    ] = await Promise.all([
      supabase.from('sales').select('gross_sales').gte('sale_date', monthStart).lte('sale_date', monthEnd),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart).lte('expense_date', monthEnd),
    ])
    setTotalSales((salesData||[]).reduce((sum,r)=>sum+(parseFloat(r.gross_sales)||0),0))
    setTotalExpenses((expensesData||[]).reduce((sum,r)=>sum+(parseFloat(r.amount)||0),0))
    setFinanceLoading(false)
  }

  const totalStaff   = staffList.length
  const onShiftToday = [...new Set(todayShifts.map(s=>s.staff_id))].length
  const pendingCount = pendingLeaves.length
  const netProfit    = totalSales - totalExpenses

  const QUICK_ACTIONS = [
    { icon:'📅', label:'Scheduling',    href:'/schedule',  color:'var(--matcha)'  },
    { icon:'✅', label:'Task Board',    href:'/tasks',     color:'var(--sky)'     },
    { icon:'📋', label:'Role Tasks',    href:'/roles',     color:'#8e44ad'        },
    { icon:'✔️', label:'Daily Check-In',href:'/checkin',   color:'var(--gold)'    },
    { icon:'💸', label:'Payroll',       href:'/payroll',   color:'var(--blush)'   },
    { icon:'📣', label:'Announcements', href:'/announce',  color:'#c0392b'        },
    { icon:'🗓️', label:'Leave Requests',href:'/leave',     color:'#2d7a6a'        },
    { icon:'👥', label:'Staff',         href:'/staff',     color:'var(--bark)'    },
  ]

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
        {/* KPI STRIP — Operations */}
        <div className="kpi-grid fade-up" style={{marginBottom:20}}>
          {[
            { label:'Total Staff',      value: loading?'…':totalStaff,           delta:'Active team members',          dir:'neutral', icon:'👥', cls:'c-matcha', href:'/staff'   },
            { label:'On Shift Today',   value: loading?'…':onShiftToday,         delta:`of ${totalStaff} scheduled`,   dir:'neutral', icon:'📅', cls:'c-gold',   href:'/schedule'},
            { label:'Pending Leaves',   value: loading?'…':pendingCount,         delta: pendingCount>0?'Need approval':'All clear', dir:pendingCount>0?'down':'up', icon:'🗓️', cls:'c-blush', href:'/leave' },
            { label:'Shifts Today',     value: loading?'…':todayShifts.length,   delta:'Total assignments today',      dir:'neutral', icon:'🕐', cls:'c-bark',   href:'/schedule'},
          ].map(k => (
            <a key={k.label} href={k.href} style={{textDecoration:'none'}}>
              <div className={`kpi-card ${k.cls}`} style={{cursor:'pointer'}}>
                <div className="kpi-icon">{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
                <div className={`kpi-delta ${k.dir}`}>{k.delta}</div>
              </div>
            </a>
          ))}
        </div>

        {/* FINANCE STRIP — Sales / Expenses / Net Profit */}
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

          {/* Net Profit */}
          <a href="/finance/financial-statement" style={{textDecoration:'none'}}>
            <div className="card fade-up" style={{cursor:'pointer',borderTop:`3px solid ${netProfit>=0?'#4a90c4':'#c0392b'}`,transition:'box-shadow .15s'}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px #4a90c422'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)'}}>Net Profit · {monthLabel}</span>
                <span style={{fontSize:16}}>📊</span>
              </div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:financeLoading?'var(--text-muted)':netProfit>=0?'#2d5a8a':'#c0392b'}}>
                {financeLoading ? '…' : peso(netProfit)}
              </div>
              <div style={{fontSize:10,color:'#4a90c4',marginTop:4,fontWeight:600}}>Full P&L →</div>
            </div>
          </a>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:16}}>
          {/* TODAY'S SHIFTS */}
          <div className="card fade-up">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Today's Shifts</div>
              <a href="/schedule" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>Manage →</a>
            </div>
            {loading ? (
              <div style={{textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
            ) : todayShifts.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>No shifts scheduled for today</div>
                <a href="/schedule" style={{fontSize:11,fontWeight:700,color:'var(--matcha-dark)',textDecoration:'none'}}>+ Go to Scheduler →</a>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {todayShifts.slice(0,6).map(s => {
                  const st = s.staff
                  const badge = SHIFT_BADGE[s.shift_type]
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',background:'var(--surface)',borderRadius:9,border:'1px solid var(--cream-dark)'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:getRoleColor(st?.role||''),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                        {initials(st?.first_name||'',st?.last_name||'')}
                      </div>
                      <span style={{fontSize:12,fontWeight:600,flex:1}}>{st?.first_name} {st?.last_name}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{st?.role}</span>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:badge.bg,color:badge.color,border:`1px solid ${badge.border}`}}>{badge.label}</span>
                    </div>
                  )
                })}
                {todayShifts.length > 6 && (
                  <a href="/schedule" style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'4px',textDecoration:'none'}}>+{todayShifts.length-6} more shifts →</a>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Staff overview */}
            <div className="card fade-up">
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:12}}>Staff Overview</div>
              <div style={{display:'flex',justifyContent:'space-around'}}>
                {[
                  [totalStaff,   'Total',    'var(--espresso)'],
                  [onShiftToday, 'On Shift', 'var(--matcha-dark)'],
                  [pendingCount, 'On Leave', pendingCount>0?'#c0392b':'var(--text-muted)'],
                ].map(([num,lbl,color])=>(
                  <div key={lbl} style={{textAlign:'center'}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:700,color}}>{loading?'…':num}</div>
                    <div style={{fontSize:9,color:'var(--text-muted)',letterSpacing:1,textTransform:'uppercase',marginTop:2}}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending leaves alert */}
            {pendingCount > 0 && (
              <a href="/leave" style={{textDecoration:'none'}}>
                <div className="card fade-up" style={{background:'#fef3e2',border:'1px solid #d4a84366',cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:20}}>⏳</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#a06000'}}>{pendingCount} Leave Request{pendingCount!==1?'s':''}</div>
                      <div style={{fontSize:10,color:'#a06000',opacity:.8}}>Pending your approval</div>
                    </div>
                    <span style={{marginLeft:'auto',fontSize:12,color:'#a06000'}}>→</span>
                  </div>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="card fade-up" style={{marginBottom:16}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Quick Actions</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:8}}>
            {QUICK_ACTIONS.map(qa=>(
              <a key={qa.label} href={qa.href} style={{textDecoration:'none'}}>
                <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 8px',textAlign:'center',transition:'all .15s',cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=qa.color;e.currentTarget.style.borderColor=qa.color;e.currentTarget.querySelectorAll('span').forEach(s=>s.style.color='white')}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--surface)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.querySelectorAll('span').forEach(s=>s.style.color='')}}>
                  <div style={{fontSize:20,marginBottom:4}}>{qa.icon}</div>
                  <span style={{fontSize:9,fontWeight:600,color:'var(--text-primary)',display:'block',lineHeight:1.3}}>{qa.label}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* BOTTOM ROW — Today's check-in progress + announcements */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Check-in progress */}
          <div className="card fade-up">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Daily Check-In</div>
              <a href="/checkin" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>Open →</a>
            </div>
            {loading?(
              <div style={{textAlign:'center',padding:'16px',color:'var(--text-muted)',fontSize:12}}>Loading…</div>
            ):todayShifts.length===0?(
              <div style={{textAlign:'center',padding:'16px',color:'var(--text-muted)',fontSize:12}}>No shifts scheduled today</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {['am','mid','pm'].map(shiftId=>{
                  const shiftStaff = todayShifts.filter(s=>s.shift_type===shiftId)
                  const badge = SHIFT_BADGE[shiftId]
                  if(!shiftStaff.length) return null
                  return (
                    <div key={shiftId} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:badge.bg,borderRadius:9,border:`1px solid ${badge.border}44`}}>
                      <span style={{fontSize:10,fontWeight:700,color:badge.color,minWidth:30}}>{badge.label}</span>
                      <div style={{flex:1,display:'flex',gap:4,flexWrap:'wrap'}}>
                        {shiftStaff.slice(0,4).map(s=>(
                          <div key={s.id} style={{width:22,height:22,borderRadius:'50%',background:getRoleColor(s.staff?.role||''),display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'white'}} title={`${s.staff?.first_name} ${s.staff?.last_name}`}>
                            {initials(s.staff?.first_name||'',s.staff?.last_name||'')}
                          </div>
                        ))}
                        {shiftStaff.length>4&&<span style={{fontSize:10,color:badge.color}}>+{shiftStaff.length-4}</span>}
                      </div>
                      <span style={{fontSize:10,color:badge.color,fontWeight:600}}>{shiftStaff.length} staff</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="card fade-up">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>Announcements</div>
              <a href="/announce" style={{fontSize:11,color:'var(--matcha-dark)',fontWeight:600,textDecoration:'none'}}>View all →</a>
            </div>
            {announcements.length===0?(
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
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {announcements.map((a,i)=>(
                  <div key={i} style={{padding:'11px 13px',borderRadius:9,borderLeft:'3px solid var(--matcha)',background:'#f0f8e8'}}>
                    <div style={{fontSize:12,fontWeight:700}}>{a.title||a.content?.slice(0,50)}</div>
                    <div style={{fontSize:10,color:'#bbb',marginTop:4,fontFamily:"'DM Mono',monospace"}}>
                      {new Date(a.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
