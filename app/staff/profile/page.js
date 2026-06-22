'use client'
export const dynamic = 'force-dynamic'

const HR_EMAIL = 'hr.ohtgroup@gmail.com'
// ─────────────────────────────────────────────
// OHT Admin — Staff Profile
// Place at: app/staff/profile/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'
import { getDailyRate } from '../../../lib/payroll'

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f,l) => ((f||'')[0]||'').toUpperCase()+((l||'')[0]||'').toUpperCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'
const fmtPeso = n => n != null ? `₱ ${Number(n).toLocaleString('en-PH',{minimumFractionDigits:2})}` : '—'

function Section({ title, children }) {
  return (
    <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
        <p style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)', margin:0 }}>{title}</p>
      </div>
      <div style={{ padding:'16px 18px' }}>{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom:12 }}>
      <p style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', margin:'0 0 3px' }}>{label}</p>
      <p style={{ fontSize:13, color:'var(--text-primary)', margin:0, fontWeight:500 }}>{value || '—'}</p>
    </div>
  )
}

function Grid({ children, cols=2 }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:'0 24px' }}>
      {children}
    </div>
  )
}

// ── Messenger Status Section ─────────────────────────────────────────────────
function MessengerSection({ staff, onUnlink }) {
  const [code, setCode]       = useState(null)
  const [expires, setExpires] = useState(null)
  const [loading, setLoading] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id }),
      })
      const data = await res.json()
      if (data.code) { setCode(data.code); setExpires(data.expiresAt) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function unlinkMessenger() {
    if (!confirmed) { setConfirmed(true); return }
    setUnlinking(true)
    const supabase = createClient()
    await supabase.from('staff').update({
      messenger_psid: null,
      messenger_opted_in: false,
      messenger_link_code: null,
      messenger_link_expires_at: null,
    }).eq('id', staff.id)
    setUnlinking(false)
    setConfirmed(false)
    onUnlink()
  }

  function copyCode() {
    navigator.clipboard.writeText(`LINK-${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLinked = staff.messenger_opted_in && staff.messenger_psid

  return (
    <Section title="💬 Messenger Notifications">
      {isLinked ? (
        <div>
          {/* Linked state */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#eef7e4', borderRadius:10, border:'1px solid #7ab648', marginBottom:14 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'#4a7a1e', margin:0 }}>Messenger Linked</p>
              <p style={{ fontSize:11, color:'#4a7a1e', margin:'2px 0 0', opacity:.8 }}>
                {staff.first_name} will receive notifications directly in Messenger.
              </p>
            </div>
          </div>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 10px' }}>
            PSID: <code style={{ fontSize:11, background:'var(--surface)', padding:'1px 6px', borderRadius:4 }}>{staff.messenger_psid}</code>
          </p>
          {/* Unlink button */}
          {confirmed ? (
            <div style={{ display:'flex', gap:8 }}>
              <p style={{ fontSize:12, color:'#c0392b', margin:0, alignSelf:'center' }}>Are you sure?</p>
              <button onClick={unlinkMessenger} disabled={unlinking}
                style={{ padding:'7px 14px', background:'#c0392b', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {unlinking ? 'Unlinking…' : 'Yes, unlink'}
              </button>
              <button onClick={() => setConfirmed(false)}
                style={{ padding:'7px 14px', background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={unlinkMessenger}
              style={{ padding:'7px 14px', background:'var(--surface)', color:'#c0392b', border:'1px solid #f5c6c6', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              🔓 Unlink Messenger
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Not linked state */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--surface)', borderRadius:10, border:'1px solid var(--border)', marginBottom:14 }}>
            <span style={{ fontSize:20 }}>💬</span>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:0 }}>Not linked yet</p>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>
                Generate a code for {staff.first_name} to link their Messenger account.
              </p>
            </div>
          </div>

          {!code ? (
            <button onClick={generateCode} disabled={loading}
              style={{ padding:'9px 16px', background:'#0084ff', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Generating…' : '🔗 Generate Link Code for ' + staff.first_name}
            </button>
          ) : (
            <div>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 8px' }}>
                Share this code with <strong>{staff.first_name}</strong>. They must send it to the <strong>Oh Hey There Matcha</strong> Facebook Page on Messenger:
              </p>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <code style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, letterSpacing:2, color:'var(--text-primary)' }}>LINK-{code}</code>
                <button onClick={copyCode}
                  style={{ padding:'6px 14px', background: copied ? '#7ab648' : '#1a1208', color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'background .2s' }}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <p style={{ fontSize:11, color: timeLeft < 60 ? '#c0392b' : 'var(--text-muted)', margin:0 }}>
                  ⏱ Expires in {timeLeft >= 60 ? `${Math.floor(timeLeft/60)}m ${timeLeft%60}s` : `${timeLeft}s`}
                </p>
                <button onClick={generateCode}
                  style={{ background:'none', border:'none', color:'#0084ff', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

export default function StaffProfilePage() {
  const [id, setId]               = useState(null)
  const [staff, setStaff]         = useState(null)
  const [contracts, setContracts] = useState([])
  const [files, setFiles]         = useState([])
  const [payroll, setPayroll]     = useState([])
  const [schedules, setSchedules] = useState([])
  const [rateOverrides, setRateOverrides] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [userEmail, setUserEmail]   = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const staffId = params.get('id')
    setId(staffId)
    if (staffId) fetchAll(staffId)
    else setLoading(false)
  }, [])

  async function fetchAll(staffId) {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUserEmail(session?.user?.email?.toLowerCase() || '')
      const [
        { data: s },
        { data: c },
        { data: f },
        { data: p },
        { data: sc },
      ] = await Promise.all([
        supabase.from('staff').select('*').eq('id', staffId).single(),
        supabase.from('contracts').select('*').eq('staff_id', staffId).order('created_at', { ascending:false }),
        supabase.from('staff_files').select('*').eq('staff_id', staffId).order('created_at', { ascending:false }),
        supabase.from('payroll_runs').select('*').eq('staff_id', staffId).order('created_at', { ascending:false }).limit(12),
        supabase.from('schedules').select('*').eq('staff_id', staffId).order('shift_date', { ascending:false }).limit(30),
      ])
      setStaff(s)
      setContracts(c || [])
      setFiles(f || [])
      setPayroll(p || [])
      setSchedules(sc || [])

      const { data: rateRow } = await supabase.from('settings').select('value').eq('key', 'payroll_rates').single()
      if (rateRow?.value) { try { setRateOverrides(JSON.parse(rateRow.value)) } catch(e) {} }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function refreshStaff() {
    if (!id) return
    const supabase = createClient()
    const { data: s } = await supabase.from('staff').select('*').eq('id', id).single()
    if (s) setStaff(s)
  }

  const isHR = userEmail === HR_EMAIL
  const TABS = ['overview','personal','payroll','contracts','files','schedule'].filter(t => !(isHR && t === 'files'))

  if (loading) return (
    <AuthShell>
      <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
    </AuthShell>
  )

  if (!staff) return (
    <AuthShell>
      <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Staff member not found.</div>
    </AuthShell>
  )

  const roleColor = getRoleColor(staff.role)
  const shiftsThisMonth = schedules.filter(s => {
    const d = new Date(s.shift_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const latestPayroll = payroll[0]
  const pendingContracts = contracts.filter(c => c.status === 'pending_signature').length

  return (
    <AuthShell>
      <div className="topbar">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <a href="/staff" style={{ color:'var(--text-muted)', fontSize:13, textDecoration:'none' }}>← Staff</a>
          <span style={{ color:'var(--border)' }}>/</span>
          <span style={{ fontSize:13, fontWeight:600 }}>{staff.first_name} {staff.last_name}</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>

        {/* Profile header */}
        <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:16, padding:'24px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:roleColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'white', flexShrink:0 }}>
            {initials(staff.first_name, staff.last_name)}
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:800, margin:0, color:'var(--text-primary)' }}>
                {staff.first_name} {staff.last_name}
              </h1>
              {staff.nickname && <span style={{ fontSize:12, color:'var(--text-muted)' }}>"{staff.nickname}"</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:8, background:roleColor+'22', color:roleColor }}>{staff.role}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--surface)', padding:'3px 10px', borderRadius:8, border:'1px solid var(--border)' }}>{staff.employment_type || 'Full-time'}</span>
              {staff.status && <span style={{ fontSize:11, padding:'3px 10px', borderRadius:8, background: staff.status==='active'?'#eef7e4':'#fff0f0', color: staff.status==='active'?'#4a7a1e':'#c0392b', fontWeight:600 }}>{staff.status}</span>}
              {/* Messenger badge in header */}
              {staff.messenger_opted_in
                ? <span style={{ fontSize:11, padding:'3px 10px', borderRadius:8, background:'#e8f4ff', color:'#0084ff', fontWeight:600 }}>💬 Messenger ✓</span>
                : <span style={{ fontSize:11, padding:'3px 10px', borderRadius:8, background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>💬 Not linked</span>
              }
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
              {staff.email && <span style={{ fontSize:12, color:'var(--text-muted)' }}>✉ {staff.email}</span>}
              {staff.phone && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📱 {staff.phone}</span>}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, minWidth:300 }}>
            {[
              { label:'Shifts this month', value: shiftsThisMonth },
              { label:'Pending contracts', value: pendingContracts, alert: pendingContracts > 0 },
              { label:'Latest net pay', value: latestPayroll ? fmtPeso(latestPayroll.net_pay) : '—' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--surface)', borderRadius:10, padding:'12px', border:`1px solid ${s.alert?'#f5c6c6':'var(--border)'}` }}>
                <p style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color: s.alert?'#c0392b':'var(--text-muted)', margin:'0 0 4px' }}>{s.label}</p>
                <p style={{ fontSize:18, fontWeight:700, color: s.alert?'#c0392b':'var(--text-primary)', margin:0, fontFamily:"'Montserrat',sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--border)' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding:'8px 16px', fontSize:12, fontWeight: activeTab===tab?700:400, border:'none', background:'transparent', cursor:'pointer', color: activeTab===tab?'var(--text-primary)':'var(--text-muted)', borderBottom: activeTab===tab?'2px solid #EF4576':'2px solid transparent', fontFamily:"'DM Sans',sans-serif", textTransform:'capitalize', marginBottom:-1 }}>
              {tab}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {/* Messenger section — hidden from HR */}
            {!isHR && (
              <MessengerSection staff={staff} onUnlink={refreshStaff} />
            )}
            <Grid>
              <Section title="Employment">
                <Field label="Role" value={staff.role} />
                <Field label="Employment type" value={staff.employment_type} />
                <Field label="Status" value={staff.status} />
                <Field label="Min shifts / week" value={staff.min_shifts_per_week} />
                <Field label="Hours assigned" value={staff.hours_assigned} />
              </Section>
              <Section title="Compensation">
                {(staff.employment_type === 'Part-time' || staff.employment_type === 'Freelancer') ? (
                  <Field label="Daily rate" value={fmtPeso(getDailyRate(staff.employment_type, staff.role, rateOverrides))} />
                ) : (
                  <Field label="Monthly pay" value={
                    staff.monthly_pay
                      ? fmtPeso(staff.monthly_pay)
                      : (() => { const r = rateOverrides?.[staff.employment_type]?.[staff.role]; return r?.type === 'monthly' && r.amount ? fmtPeso(r.amount) : '—' })()
                  } />
                )}
                <Field label="Service charge eligible" value={staff.service_charge_eligible ? 'Yes' : 'No'} />
              </Section>
            </Grid>
            <Grid>
              <Section title="Government IDs">
                <Field label="SSS" value={staff.sss} />
                <Field label="PhilHealth" value={staff.philhealth} />
                <Field label="Pag-IBIG" value={staff.pagibig} />
                <Field label="TIN" value={staff.tin} />
              </Section>
              <Section title="Attendance">
                <Field label="Late minutes" value={staff.late_minutes} />
                <Field label="Absent days" value={staff.absent_days} />
                <Field label="Late count this month" value={staff.late_count_this_month} />
                <Field label="Violation count" value={staff.violation_count} />
              </Section>
            </Grid>
          </div>
        )}

        {/* PERSONAL */}
        {activeTab === 'personal' && (
          <div>
            <Grid>
              <Section title="Basic info">
                <Field label="First name" value={staff.first_name} />
                <Field label="Last name" value={staff.last_name} />
                <Field label="Middle name" value={staff.middle_name} />
                <Field label="Nickname" value={staff.nickname} />
                <Field label="Birthday" value={fmtDate(staff.birthday)} />
                <Field label="Age" value={staff.age} />
                <Field label="Birthplace" value={staff.birthplace} />
              </Section>
              <Section title="Contact">
                <Field label="Email" value={staff.email} />
                <Field label="Phone" value={staff.phone} />
                <Field label="Mobile" value={staff.mobile} />
              </Section>
            </Grid>
            <Section title="Address">
              <Grid cols={3}>
                <Field label="House no." value={staff.house_no} />
                <Field label="Street" value={staff.street} />
                <Field label="Village" value={staff.village} />
                <Field label="Barangay" value={staff.barangay} />
                <Field label="City" value={staff.city} />
                <Field label="ZIP code" value={staff.zipcode} />
              </Grid>
            </Section>
            <Grid>
              <Section title="Father">
                <Field label="Last name" value={staff.father_last} />
                <Field label="First name" value={staff.father_first} />
                <Field label="Middle name" value={staff.father_middle} />
              </Section>
              <Section title="Mother">
                <Field label="Maiden name" value={staff.mother_maiden} />
                <Field label="First name" value={staff.mother_first} />
                <Field label="Middle name" value={staff.mother_middle} />
              </Section>
            </Grid>
            <Section title="Emergency contact">
              <Grid cols={3}>
                <Field label="Name" value={staff.emergency_name} />
                <Field label="Contact no." value={staff.emergency_contact} />
                <Field label="Relationship" value={staff.emergency_relationship} />
              </Grid>
            </Section>
          </div>
        )}

        {/* PAYROLL */}
        {activeTab === 'payroll' && (
          <Section title="Payroll history">
            {payroll.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'24px 0' }}>No payroll records yet.</p>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Period','Gross','Deductions','Net Pay','Status'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:1, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom:'1px solid var(--border)', background: i%2===0?'var(--surface)':'var(--white)' }}>
                      <td style={{ padding:'10px 12px', fontWeight:500 }}>{fmtDate(p.period_start)} – {fmtDate(p.period_end)}</td>
                      <td style={{ padding:'10px 12px' }}>{fmtPeso(p.gross_pay)}</td>
                      <td style={{ padding:'10px 12px', color:'#c0392b' }}>{fmtPeso(p.total_deductions)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700 }}>{fmtPeso(p.net_pay)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background: p.status==='paid'?'#eef7e4':'#fef3e2', color: p.status==='paid'?'#4a7a1e':'#a06000' }}>
                          {p.status || 'draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {/* CONTRACTS */}
        {activeTab === 'contracts' && (
          <Section title="Contracts">
            {contracts.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'24px 0' }}>No contracts yet.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {contracts.map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--surface)' }}>
                    <span style={{ fontSize:24 }}>📄</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:13, fontWeight:600, margin:0 }}>{c.title || 'Contract'}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>Created {fmtDate(c.created_at)}</p>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6,
                      background: c.status==='active'?'#eef7e4':c.status==='pending_signature'?'#fef3e2':'var(--surface)',
                      color: c.status==='active'?'#4a7a1e':c.status==='pending_signature'?'#a06000':'var(--text-muted)' }}>
                      {c.status || 'draft'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* FILES */}
        {activeTab === 'files' && !isHR && (
          <Section title="Files · 201">
            {files.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'24px 0' }}>No files uploaded yet.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {files.map(f => (
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--surface)' }}>
                    <span style={{ fontSize:20 }}>📎</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:13, fontWeight:500, margin:0 }}>{f.file_name || f.name || 'File'}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>{fmtDate(f.created_at)}</p>
                    </div>
                    {f.file_url && (
                      <a href={f.file_url} target="_blank" rel="noreferrer"
                        style={{ fontSize:11, color:'#4a90c4', fontWeight:600, textDecoration:'none' }}>View →</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* SCHEDULE */}
        {activeTab === 'schedule' && (
          <Section title="Recent shifts">
            {schedules.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'24px 0' }}>No scheduled shifts yet.</p>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Date','Shift','Published'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:1, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s, i) => {
                    const SHIFT_COLORS = { am:'#4a7a1e', ops:'#7a3a8a', mid:'#a06000', pm:'#2d5a8a' }
                    const color = SHIFT_COLORS[s.shift_type] || '#7a6a50'
                    return (
                      <tr key={s.id} style={{ borderBottom:'1px solid var(--border)', background: i%2===0?'var(--surface)':'var(--white)' }}>
                        <td style={{ padding:'10px 12px', fontWeight:500 }}>{fmtDate(s.shift_date)}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background:color+'22', color }}>{s.shift_type?.toUpperCase()}</span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, color: s.published?'#4a7a1e':'var(--text-muted)', fontWeight: s.published?600:400 }}>
                            {s.published ? '✓ Published' : 'Draft'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Section>
        )}
      </div>
    </AuthShell>
  )
}
