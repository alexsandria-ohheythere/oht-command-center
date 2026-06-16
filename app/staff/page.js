'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Admin — Staff Profile
// Place at: app/staff/[id]/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

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

export default function StaffProfilePage() {
  const { id } = useParams()
  const [staff, setStaff]         = useState(null)
  const [contracts, setContracts] = useState([])
  const [files, setFiles]         = useState([])
  const [payroll, setPayroll]     = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    const supabase = createClient()
    try {
      const [
        { data: s },
        { data: c },
        { data: f },
        { data: p },
        { data: sc },
      ] = await Promise.all([
        supabase.from('staff').select('*').eq('id', id).single(),
        supabase.from('contracts').select('*').eq('staff_id', id).order('created_at', { ascending:false }),
        supabase.from('staff_files').select('*').eq('staff_id', id).order('created_at', { ascending:false }),
        supabase.from('payroll_runs').select('*').eq('staff_id', id).order('created_at', { ascending:false }).limit(12),
        supabase.from('schedules').select('*').eq('staff_id', id).order('shift_date', { ascending:false }).limit(30),
      ])
      setStaff(s)
      setContracts(c || [])
      setFiles(f || [])
      setPayroll(p || [])
      setSchedules(sc || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const TABS = ['overview','personal','payroll','contracts','files','schedule']

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
  const totalShifts = schedules.length
  const shiftsThisMonth = schedules.filter(s => {
    const d = new Date(s.shift_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const latestPayroll = payroll[0]
  const pendingContracts = contracts.filter(c => c.status === 'pending_signature').length
  const activeContracts  = contracts.filter(c => c.status === 'active').length

  return (
    <AuthShell>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <a href="/staff" style={{ color:'var(--text-muted)', fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
            ← Staff
          </a>
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
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
              {staff.email && <span style={{ fontSize:12, color:'var(--text-muted)' }}>✉ {staff.email}</span>}
              {staff.phone && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📱 {staff.phone}</span>}
            </div>
          </div>

          {/* Quick stats */}
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
        <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding:'8px 16px', fontSize:12, fontWeight: activeTab===tab?700:400, border:'none', background:'transparent', cursor:'pointer', color: activeTab===tab?'var(--text-primary)':'var(--text-muted)', borderBottom: activeTab===tab?'2px solid #EF4576':'2px solid transparent', fontFamily:"'DM Sans',sans-serif", textTransform:'capitalize', marginBottom:-1 }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div>
            <Grid>
              <Section title="Employment">
                <Field label="Role" value={staff.role} />
                <Field label="Employment type" value={staff.employment_type} />
                <Field label="Status" value={staff.status} />
                <Field label="Min shifts / week" value={staff.min_shifts_per_week || '—'} />
                <Field label="Hours assigned" value={staff.hours_assigned} />
              </Section>
              <Section title="Compensation">
                <Field label="Daily rate" value={fmtPeso(staff.daily_rate)} />
                <Field label="Monthly rate" value={fmtPeso(staff.monthly_rate)} />
                <Field label="Monthly pay" value={fmtPeso(staff.monthly_pay)} />
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

        {/* ── PERSONAL ── */}
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

        {/* ── PAYROLL ── */}
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

        {/* ── CONTRACTS ── */}
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

        {/* ── FILES ── */}
        {activeTab === 'files' && (
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
                        style={{ fontSize:11, color:'#4a90c4', fontWeight:600, textDecoration:'none' }}>
                        View →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── SCHEDULE ── */}
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
