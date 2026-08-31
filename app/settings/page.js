'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const supabase = createClient()

const TABS = [
  { id:'business',  icon:'🏢', label:'Business Info'  },
  { id:'sidebar',   icon:'🗂️', label:'Sidebar & Nav'  },
  { id:'payroll',   icon:'💸', label:'Payroll'         },
  { id:'roles',     icon:'👥', label:'Access & Roles'  },
  { id:'notifs',    icon:'🔔', label:'Notifications'   },
]

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }
const lStyle = { display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }
const sectionHead = { fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:14, paddingBottom:8, borderBottom:'1px solid var(--border)' }

// Default sidebar nav config — mirrors Sidebar.js NAV but editable
const DEFAULT_NAV = [
  { id:'dashboard',   icon:'🏠', label:'Dashboard',         href:'/dashboard',        section:'Overview',    locked:true  },
  { id:'schedule',    icon:'📅', label:'Scheduling',        href:'/schedule',         section:'Operations',  locked:false },
  { id:'tasks',       icon:'📋', label:'Job Orders',        href:'/tasks',            section:'Operations',  locked:false },
  { id:'leave',       icon:'🗓️', label:'Leave & Unavail.',  href:'/leave',            section:'Operations',  locked:false },
  { id:'roles',       icon:'📝', label:'Role Tasks',        href:'/roles',            section:'Operations',  locked:false },
  { id:'checkin',     icon:'✔️', label:'Daily Check-In',    href:'/checkin',          section:'Operations',  locked:false },
  { id:'payroll',     icon:'💸', label:'Payroll',           href:'/payroll',          section:'Operations',  locked:false },
  { id:'staff',       icon:'👥', label:'Staff',             href:'/staff',            section:'Operations',  locked:false },
  { id:'contracts',   icon:'📄', label:'Contracts',         href:'/contracts',        section:'Documents',   locked:false },
  { id:'files',       icon:'📁', label:'Files · 201',       href:'/files',            section:'Documents',   locked:false },
  { id:'finance',     icon:'📊', label:'Financial Statement',href:'/finance',         section:'Finance',     locked:false },
  { id:'sales',       icon:'💰', label:'Sales',             href:'/finance/sales',    section:'Finance',     locked:false },
  { id:'expenses',    icon:'🧾', label:'Expenses',          href:'/finance/expenses', section:'Finance',     locked:false },
  { id:'forecast',    icon:'📈', label:'Forecast',          href:'/finance/forecast', section:'Finance',     locked:false },
  { id:'bank',        icon:'🏦', label:'Bank Records',      href:'/finance/bank',     section:'Finance',     locked:false },
  { id:'announce',    icon:'📣', label:'Announcements',     href:'/announce',         section:'Comms',       locked:false },
  { id:'settings',   icon:'⚙️', label:'Settings',          href:'/settings',         section:'Admin',       locked:true  },
]

const SECTION_COLORS = {
  'Overview':'#7ab648','Operations':'#4a90c4','Documents':'#8e44ad',
  'Finance':'#2d7a6a','Comms':'#e8845a','Admin':'#7a6a50',
}

export default function SettingsPage() {
  const [tab, setTab]       = useState('business')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Business info
  const [biz, setBiz] = useState({
    business_name: 'Oh Hey There Matcha Cafe',
    address: '',
    phone: '',
    email: '',
    tin: '',
    timezone: 'Asia/Manila',
    currency: 'PHP',
    logo_url: '',
  })

  // Payroll settings
  const [payroll, setPayroll] = useState({
    cutoff_day_1: '15',
    cutoff_day_2: '30',
    sss_employee_rate: '4.5',
    philhealth_rate: '5.0',
    pagibig_rate: '2.0',
    overtime_multiplier: '1.25',
    night_diff_rate: '0.10',
  })

  // Rate cards — employment type × role
  const ROLES = ['Cafe Supervisor','Cafe Operations Support','Senior Barista','Junior Barista - Milk Station','Junior Barista - Cashier','Executive Chef','Sous Chef','Kitchen Staff','R&D Specialist']
  const EMP_TYPES = ['Full-time','Part-time','Freelancer']
  const DEFAULT_RATES = {
    'Full-time': {
      'Senior Barista':                { type:'monthly', amount:17000 },
      'Executive Chef':                { type:'monthly', amount:17000 },
      'Junior Barista - Milk Station': { type:'monthly', amount:14000 },
      'Junior Barista - Cashier':      { type:'monthly', amount:14000 },
      'Sous Chef':                     { type:'monthly', amount:15000 },
      'Cafe Supervisor':               { type:'monthly', amount:0 },
      'Cafe Operations Support':       { type:'monthly', amount:0 },
      'Kitchen Staff':                 { type:'monthly', amount:0 },
    },
    'Part-time': {
      'Senior Barista':                { type:'daily', amount:850 },
      'Executive Chef':                { type:'daily', amount:850 },
      'Junior Barista - Milk Station': { type:'daily', amount:700 },
      'Junior Barista - Cashier':      { type:'daily', amount:700 },
      'Sous Chef':                     { type:'daily', amount:700 },
      'Kitchen Staff':                 { type:'daily', amount:700 },
      'Cafe Supervisor':               { type:'daily', amount:0 },
      'Cafe Operations Support':       { type:'daily', amount:0 },
    },
    'Freelancer': {
      'Cafe Supervisor':               { type:'daily', amount:1150 },
      'Cafe Operations Support':       { type:'daily', amount:750 },
      'Senior Barista':                { type:'daily', amount:850 },
      'Executive Chef':                { type:'daily', amount:850 },
      'Junior Barista - Milk Station': { type:'daily', amount:700 },
      'Junior Barista - Cashier':      { type:'daily', amount:700 },
      'Sous Chef':                     { type:'daily', amount:700 },
      'Kitchen Staff':                 { type:'daily', amount:700 },
    },
  }
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [ratesSaving, setRatesSaving] = useState(false)

  // Notifications
  const [notifs, setNotifs] = useState({
    notify_leave_request: true,
    notify_contract_signed: true,
    notify_payroll_generated: true,
    notify_low_shifts: true,
  })

  // Sidebar nav visibility
  const [nav, setNav] = useState(DEFAULT_NAV)

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      data.forEach(row => {
        if (row.key === 'business')   setBiz(prev => ({ ...prev, ...JSON.parse(row.value || '{}') }))
        if (row.key === 'payroll')    setPayroll(prev => ({ ...prev, ...JSON.parse(row.value || '{}') }))
        if (row.key === 'payroll_rates') setRates(prev => ({ ...prev, ...JSON.parse(row.value || '{}') }))
        if (row.key === 'notifs')     setNotifs(prev => ({ ...prev, ...JSON.parse(row.value || '{}') }))
        if (row.key === 'sidebar_nav') {
          const saved = JSON.parse(row.value || '[]')
          if (saved.length) {
            setNav(DEFAULT_NAV.map(item => {
              const s = saved.find(x => x.id === item.id)
              return s ? { ...item, label: s.label, hidden: s.hidden } : item
            }))
          }
        }
      })
    }
    setLoading(false)
  }

  async function save(key, value) {
    setSaving(true)
    await supabase.from('settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' })
    showToast('✅', 'Settings saved')
    setSaving(false)
  }

  async function saveRates() {
    setRatesSaving(true)
    await supabase.from('settings').upsert({ key: 'payroll_rates', value: JSON.stringify(rates) }, { onConflict: 'key' })
    showToast('✅', 'Rate cards saved — takes effect on next payroll run')
    setRatesSaving(false)
  }

  function updateRate(empType, role, field, value) {
    setRates(prev => ({
      ...prev,
      [empType]: {
        ...prev[empType],
        [role]: { ...prev[empType][role], [field]: field === 'amount' ? parseFloat(value) || 0 : value }
      }
    }))
  }

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3000) }

  const bv = k => e => setBiz(p => ({ ...p, [k]: e.target.value }))
  const pv = k => e => setPayroll(p => ({ ...p, [k]: e.target.value }))

  function toggleNav(id) {
    setNav(prev => prev.map(item => item.id === id && !item.locked ? { ...item, hidden: !item.hidden } : item))
  }

  function renameNav(id, label) {
    setNav(prev => prev.map(item => item.id === id ? { ...item, label } : item))
  }

  const sections = [...new Set(nav.map(n => n.section))]

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Settings</div>
          <div className="topbar-sub">Configure your command center</div>
        </div>
      </div>

      <div className="page-content" style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

        {/* Tab sidebar */}
        <div style={{ width:180, flexShrink:0, background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, overflow:'hidden' }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', cursor:'pointer', background:tab===t.id?'var(--espresso)':'transparent', borderLeft:`3px solid ${tab===t.id?'white':'transparent'}`, transition:'all .15s' }}>
              <span style={{ fontSize:16 }}>{t.icon}</span>
              <span style={{ fontSize:12, fontWeight:tab===t.id?700:400, color:tab===t.id?'white':'var(--text-primary)' }}>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex:1, background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'24px 28px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>Loading…</div>
          ) : (

            <>
              {/* ── BUSINESS INFO ── */}
              {tab === 'business' && (
                <>
                  <div style={sectionHead}>🏢 Business Information</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    {[
                      ['business_name','Business Name'],['address','Address'],
                      ['phone','Phone'],['email','Business Email'],
                      ['tin','TIN / Tax ID'],[''],
                    ].map(([k,l]) => !k ? <div key="spacer"/> : (
                      <div key={k}>
                        <label style={lStyle}>{l}</label>
                        <input style={iStyle} value={biz[k]||''} onChange={bv(k)} placeholder={l}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                    <div>
                      <label style={lStyle}>Timezone</label>
                      <select style={iStyle} value={biz.timezone} onChange={bv('timezone')}>
                        {['Asia/Manila','Asia/Singapore','Asia/Tokyo','UTC'].map(tz => <option key={tz}>{tz}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lStyle}>Currency</label>
                      <select style={iStyle} value={biz.currency} onChange={bv('currency')}>
                        {['PHP','USD','SGD'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => save('business', biz)} disabled={saving}
                    style={{ background:'var(--espresso)', color:'white', border:'none', borderRadius:9, padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Saving…' : '✓ Save Business Info'}
                  </button>
                </>
              )}

              {/* ── SIDEBAR & NAV ── */}
              {tab === 'sidebar' && (
                <>
                  <div style={sectionHead}>🗂️ Sidebar Navigation</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:16, lineHeight:1.6 }}>
                    Toggle items on/off or rename them. Locked items (🔒) cannot be hidden. Changes take effect after saving and refreshing.
                  </div>
                  {sections.map(section => (
                    <div key={section} style={{ marginBottom:20 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:SECTION_COLORS[section]||'#999' }}/>
                        <span style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)' }}>{section}</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {nav.filter(n => n.section === section).map(item => (
                          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:item.hidden?'var(--surface)':'var(--white)', border:'1px solid var(--border)', borderRadius:9, opacity:item.hidden?0.5:1, transition:'all .15s' }}>
                            <span style={{ fontSize:16, width:22, textAlign:'center' }}>{item.icon}</span>
                            <input
                              value={item.label}
                              onChange={e => renameNav(item.id, e.target.value)}
                              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:12, fontWeight:500, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)' }}
                            />
                            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:"'DM Mono',monospace" }}>{item.href}</span>
                            {item.locked ? (
                              <span style={{ fontSize:12, opacity:.4 }}>🔒</span>
                            ) : (
                              <div onClick={() => toggleNav(item.id)}
                                style={{ width:36, height:20, borderRadius:10, background:item.hidden?'var(--border)':'var(--matcha)', cursor:'pointer', transition:'background .2s', position:'relative', flexShrink:0 }}>
                                <div style={{ width:14, height:14, borderRadius:'50%', background:'white', position:'absolute', top:3, left:item.hidden?3:19, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:10, marginTop:4 }}>
                    <button onClick={() => { setNav(DEFAULT_NAV); showToast('↩️','Reset to defaults') }}
                      style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text-muted)', borderRadius:9, padding:'9px 18px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                      Reset to Defaults
                    </button>
                    <button onClick={() => save('sidebar_nav', nav.map(n => ({ id:n.id, label:n.label, hidden:!!n.hidden })))} disabled={saving}
                      style={{ background:'var(--espresso)', color:'white', border:'none', borderRadius:9, padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                      {saving ? 'Saving…' : '✓ Save Sidebar'}
                    </button>
                  </div>
                </>
              )}

              {/* ── PAYROLL ── */}
              {tab === 'payroll' && (
                <>
                  <div style={sectionHead}>💸 Payroll Configuration</div>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:4 }}>Rate Cards</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:14, lineHeight:1.6 }}>
                      Set the base pay rate for each role and employment type. Full-time uses monthly salary (÷26 for daily rate). Part-time and Freelancer use daily rates directly.
                    </div>
                    {EMP_TYPES.map(empType => (
                      <div key={empType} style={{ marginBottom:20 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                          <span>{empType === 'Full-time' ? '🏢' : empType === 'Part-time' ? '⏱️' : '🔧'}</span>
                          <span>{empType}</span>
                          <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:400, marginLeft:4 }}>
                            {empType === 'Full-time' ? '— monthly salary' : '— daily rate'}
                          </span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                          {ROLES.map(role => {
                            const entry = rates[empType]?.[role] || { type: empType === 'Full-time' ? 'monthly' : 'daily', amount: 0 }
                            const isEmpty = entry.amount === 0
                            return (
                              <div key={role} style={{ background: isEmpty ? 'var(--surface)' : 'var(--white)', border:`1px solid ${isEmpty ? 'var(--border)' : 'var(--matcha)'}`, borderRadius:9, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-primary)', marginBottom:5 }}>{role}</div>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>₱</span>
                                    <input
                                      type="number"
                                      value={entry.amount || ''}
                                      onChange={e => updateRate(empType, role, 'amount', e.target.value)}
                                      placeholder="0"
                                      style={{ ...iStyle, width:110, padding:'5px 8px', fontSize:12 }}
                                    />
                                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                                      {empType === 'Full-time' ? '/mo' : '/day'}
                                    </span>
                                    {empType === 'Full-time' && entry.amount > 0 && (
                                      <span style={{ fontSize:9, color:'var(--matcha-dark)', background:'var(--matcha-pale)', padding:'2px 6px', borderRadius:5, whiteSpace:'nowrap' }}>
                                        ₱{Math.round(entry.amount / 26).toLocaleString('en-PH')}/day
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <button onClick={saveRates} disabled={ratesSaving}
                      style={{ background:'var(--matcha)', color:'white', border:'none', borderRadius:9, padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginBottom:24 }}>
                      {ratesSaving ? 'Saving…' : '✓ Save Rate Cards'}
                    </button>
                  </div>

                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:20, marginBottom:16 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Cutoff Dates</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                      <div>
                        <label style={lStyle}>First Cutoff (day of month)</label>
                        <input style={iStyle} type="number" min="1" max="31" value={payroll.cutoff_day_1} onChange={pv('cutoff_day_1')}/>
                      </div>
                      <div>
                        <label style={lStyle}>Second Cutoff (day of month)</label>
                        <input style={iStyle} type="number" min="1" max="31" value={payroll.cutoff_day_2} onChange={pv('cutoff_day_2')}/>
                      </div>
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>PH Government Deductions (%)</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
                      {[
                        ['sss_employee_rate','SSS (Employee %)'],
                        ['philhealth_rate','PhilHealth (%)'],
                        ['pagibig_rate','Pag-IBIG (%)'],
                      ].map(([k,l]) => (
                        <div key={k}>
                          <label style={lStyle}>{l}</label>
                          <input style={iStyle} type="number" step="0.1" value={payroll[k]} onChange={pv(k)}/>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Pay Rates</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                      <div>
                        <label style={lStyle}>Overtime Multiplier (e.g. 1.25)</label>
                        <input style={iStyle} type="number" step="0.01" value={payroll.overtime_multiplier} onChange={pv('overtime_multiplier')}/>
                      </div>
                      <div>
                        <label style={lStyle}>Night Differential Rate (e.g. 0.10 = 10%)</label>
                        <input style={iStyle} type="number" step="0.01" value={payroll.night_diff_rate} onChange={pv('night_diff_rate')}/>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => save('payroll', payroll)} disabled={saving}
                    style={{ background:'var(--espresso)', color:'white', border:'none', borderRadius:9, padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Saving…' : '✓ Save Payroll Settings'}
                  </button>
                </>
              )}

              {/* ── ACCESS & ROLES ── */}
              {tab === 'roles' && (
                <>
                  <div style={sectionHead}>👥 Access & Roles</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:16, lineHeight:1.6 }}>
                    Role permissions are defined in <code style={{ background:'var(--surface)', padding:'1px 5px', borderRadius:4, fontSize:11 }}>lib/auth.js</code>. To change access levels for a role, update that file in your repo. Below is a read-only summary of current permissions.
                  </div>
                  {[
                    { role:'admin',  label:'Admin',  color:'#7ab648', users:['Alex (ohheythere.matcha@gmail.com)','CJ (ohheythere.group@gmail.com)'], perms:['Full access to all modules'] },
                    { role:'hr',     label:'HR',     color:'#e8845a', users:['Richelle (hr.ohtgroup@gmail.com)'],  perms:['Operations','Documents','Announcements','No Finance, Payroll, or Settings'] },
                    { role:'staff',  label:'Staff',  color:'#4a90c4', users:['All other staff'],                   perms:['Staff Portal only — no Command Center access'] },
                  ].map(r => (
                    <div key={r.role} style={{ border:'1px solid var(--border)', borderRadius:11, padding:'16px 18px', marginBottom:12, borderLeft:`4px solid ${r.color}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background:r.color+'22', color:r.color }}>{r.label}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{r.users.join(' · ')}</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-primary)' }}>{r.perms.map((p,i) => <span key={i} style={{ display:'inline-block', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 8px', marginRight:6, marginBottom:4, fontSize:10 }}>{p}</span>)}</div>
                    </div>
                  ))}
                  <div style={{ background:'#fef3e2', border:'1px solid #d4a84366', borderRadius:9, padding:'12px 16px', fontSize:11, color:'#a06000', marginTop:8 }}>
                    💡 To add a new admin or HR user, add their email to <code style={{ fontSize:11 }}>components/AuthShell.js</code> under <code style={{ fontSize:11 }}>ADMIN_EMAILS</code> or <code style={{ fontSize:11 }}>HR_EMAILS</code>.
                  </div>
                </>
              )}

              {/* ── NOTIFICATIONS ── */}
              {tab === 'notifs' && (
                <>
                  <div style={sectionHead}>🔔 Notification Preferences</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                    {[
                      ['notify_leave_request',     '🗓️', 'Leave Requests',      'Alert when a staff member files a leave or unavailability'],
                      ['notify_contract_signed',   '📄', 'Contract Signed',     'Alert when a staff member signs a contract'],
                      ['notify_payroll_generated', '💸', 'Payroll Generated',   'Alert when a payroll run is completed'],
                      ['notify_low_shifts',        '⚠️', 'Low Shift Warning',   'Alert when a required staff member is below 5 shifts for the week'],
                    ].map(([k, icon, label, desc]) => (
                      <div key={k} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
                        <span style={{ fontSize:20 }}>{icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{label}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{desc}</div>
                        </div>
                        <div onClick={() => setNotifs(p => ({ ...p, [k]: !p[k] }))}
                          style={{ width:40, height:22, borderRadius:11, background:notifs[k]?'var(--matcha)':'var(--border)', cursor:'pointer', transition:'background .2s', position:'relative', flexShrink:0 }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'white', position:'absolute', top:3, left:notifs[k]?21:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => save('notifs', notifs)} disabled={saving}
                    style={{ background:'var(--espresso)', color:'white', border:'none', borderRadius:9, padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Saving…' : '✓ Save Notification Preferences'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:22, right:22, background:'var(--espresso)', color:'white', borderRadius:12, padding:'12px 16px', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:9, boxShadow:'0 8px 28px rgba(0,0,0,.2)', zIndex:1000 }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
