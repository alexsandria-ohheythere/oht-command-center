'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'
import {
  CUTOFF_PERIODS, getCurrentCutoff,
  parseTimesheetCSV, filterShiftsByPeriod, matchStaff,
  computeCutoffPayroll, getDailyRate,
} from '../../lib/payroll'

const peso = n => '₱' + (Math.round(n || 0)).toLocaleString('en-PH')
const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()

export default function PayrollPage() {
  const supabase = createClient()
  const [staff, setStaff]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [timesheetData, setTimesheetData]   = useState(null)
  const [savedRuns, setSavedRuns]           = useState([]) // saved payroll_runs for this cutoff
  const [selectedCutoff, setSelectedCutoff] = useState(getCurrentCutoff())
  const [view, setView]                     = useState('summary')
  const [selectedStaff, setSelectedStaff]   = useState(null)
  const [unmatchedTs, setUnmatchedTs]       = useState([])
  const [toast, setToast]                   = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetchStaff() }, [])
  useEffect(() => { fetchSavedRuns() }, [selectedCutoff])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('last_name')
    setStaff(data || [])
    setLoading(false)
  }

  async function fetchSavedRuns() {
    const { data } = await supabase
      .from('payroll_runs')
      .select('*, staff(first_name, last_name, nickname, role, employment_type)')
      .eq('cutoff_id', selectedCutoff.id)
    setSavedRuns(data || [])
  }

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleTimesheetUpload(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseTimesheetCSV(ev.target.result)
      setTimesheetData(parsed)
      const unmatched = Object.values(parsed).filter(ts => !matchStaff(staff, ts.lastName, ts.firstName))
      setUnmatchedTs(unmatched)
      showToast('✅', `Timesheet loaded · ${Object.keys(parsed).length} employees found`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Build payroll rows — from timesheet if uploaded, else from saved runs
  function buildPayrollRows() {
    return staff.map(s => {
      // Check if we have a saved run for this staff + cutoff
      const saved = savedRuns.find(r => r.staff_id === s.id)

      if (timesheetData) {
        // Live computation from timesheet
        const tsKey = Object.keys(timesheetData).find(k => {
          const ts = timesheetData[k]
          return matchStaff([s], ts.lastName, ts.firstName) !== undefined
        })
        const ts = tsKey ? timesheetData[tsKey] : null
        const periodShifts = ts ? filterShiftsByPeriod(ts.shifts, selectedCutoff.start, selectedCutoff.end) : []
        const pay = computeCutoffPayroll(s, periodShifts)
        return { staff: s, ts, periodShifts, pay, hasTimesheet: !!ts, saved, isLive: true }
      } else if (saved) {
        // Show saved data
        const pay = {
          daysWorked: saved.days_worked,
          paidHours: parseFloat(saved.paid_hours),
          totalLateMins: saved.total_late_mins,
          lateCount: saved.late_count,
          gross: parseFloat(saved.gross),
          lateDeduction: parseFloat(saved.late_deduction),
          sss: parseFloat(saved.sss),
          philhealth: parseFloat(saved.philhealth),
          pagibig: parseFloat(saved.pagibig),
          tax: parseFloat(saved.tax),
          totalDeductions: parseFloat(saved.total_deductions),
          netPay: parseFloat(saved.net_pay),
          eligible: saved.service_charge_eligible,
          hourlyRate: getDailyRate(s.employment_type||'Full-time', s.role) / 8,
        }
        return { staff: s, ts: null, periodShifts: [], pay, hasTimesheet: false, saved, isLive: false }
      } else {
        // No data
        const pay = computeCutoffPayroll(s, [])
        return { staff: s, ts: null, periodShifts: [], pay, hasTimesheet: false, saved: null, isLive: false }
      }
    })
  }

  async function savePayroll() {
    if (!timesheetData) { showToast('⚠️', 'Upload a timesheet first'); return }
    setSaving(true)
    const rows = buildPayrollRows()
    const upsertData = rows.map(r => ({
      cutoff_id: selectedCutoff.id,
      cutoff_label: selectedCutoff.label,
      cutoff_start: selectedCutoff.start,
      cutoff_end: selectedCutoff.end,
      staff_id: r.staff.id,
      days_worked: r.pay.daysWorked,
      paid_hours: r.pay.paidHours,
      total_late_mins: r.pay.totalLateMins,
      late_count: r.pay.lateCount,
      gross: r.pay.gross,
      late_deduction: r.pay.lateDeduction,
      sss: r.pay.sss,
      philhealth: r.pay.philhealth,
      pagibig: r.pay.pagibig,
      tax: r.pay.tax,
      total_deductions: r.pay.totalDeductions,
      net_pay: r.pay.netPay,
      service_charge_eligible: r.pay.eligible,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('payroll_runs')
      .upsert(upsertData, { onConflict: 'cutoff_id,staff_id' })

    if (error) { showToast('❌', error.message); setSaving(false); return }
    await fetchSavedRuns()
    setTimesheetData(null)
    setSaving(false)
    showToast('💾', `Payroll saved for ${selectedCutoff.label}`)
  }

  function exportCSV() {
    const rows = buildPayrollRows()
    const data = [
      ['Name','Nickname','Role','Type','Days','Paid Hours','Late (mins)','Gross','Late Deduction','SSS','PhilHealth','Pag-IBIG','Tax','Total Deductions','Net Pay','Service Charge'],
      ...rows.map(r => [
        `${r.staff.first_name} ${r.staff.last_name}`,
        r.staff.nickname || '',
        r.staff.role, r.staff.employment_type || 'Full-time',
        r.pay.daysWorked, r.pay.paidHours.toFixed(2),
        r.pay.totalLateMins,
        r.pay.gross, r.pay.lateDeduction,
        r.pay.sss, r.pay.philhealth, r.pay.pagibig, r.pay.tax,
        r.pay.totalDeductions, r.pay.netPay,
        r.pay.eligible ? 'Yes' : 'No',
      ])
    ]
    const csv = data.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OHT-Payroll-${selectedCutoff.label.replace(/\s/g,'-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('📥', 'Payroll exported')
  }

  const payrollRows = buildPayrollRows()
  const totals = payrollRows.reduce((acc, r) => {
    acc.gross         += r.pay.gross
    acc.deductions    += r.pay.totalDeductions
    acc.net           += r.pay.netPay
    acc.lateDeduction += r.pay.lateDeduction
    acc.sss           += r.pay.sss
    acc.philhealth    += r.pay.philhealth
    acc.pagibig       += r.pay.pagibig
    acc.tax           += r.pay.tax
    return acc
  }, { gross:0, deductions:0, net:0, lateDeduction:0, sss:0, philhealth:0, pagibig:0, tax:0 })

  const hasSavedData  = savedRuns.length > 0
  const hasLiveData   = !!timesheetData

  const iStyle = {
    background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
    padding:'8px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif",
    color:'var(--text-primary)', outline:'none', cursor:'pointer'
  }

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Payroll</div>
          <div className="topbar-sub">
            {selectedCutoff.label} · {staff.length} staff
            {hasLiveData && <span style={{color:'var(--matcha-dark)',fontWeight:600}}> · Timesheet loaded ✓</span>}
            {!hasLiveData && hasSavedData && <span style={{color:'var(--sky)',fontWeight:600}}> · Saved payroll ✓</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {unmatchedTs.length > 0 && (
            <button onClick={() => setView('unmatched')} style={{background:'#fdeaea',border:'1px solid #f5c6c644',borderRadius:8,padding:'7px 13px',fontSize:11,fontWeight:700,color:'#c0392b',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              ⚠️ {unmatchedTs.length} Unmatched
            </button>
          )}
          {view !== 'summary' && <button className="btn btn-secondary" onClick={() => setView('summary')}>← Back</button>}
          <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
            📂 Upload Timesheet
            <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleTimesheetUpload} />
          </label>
          {hasLiveData && (
            <button className="btn btn-primary" onClick={savePayroll} disabled={saving}
              style={{background:'var(--matcha)',display:'flex',alignItems:'center',gap:6}}>
              {saving ? '💾 Saving…' : '💾 Save Payroll'}
            </button>
          )}
          {(hasLiveData || hasSavedData) && (
            <button className="btn btn-secondary" onClick={exportCSV}>↓ Export CSV</button>
          )}
        </div>
      </div>

      <div className="page-content">

        {/* CUTOFF SELECTOR */}
        <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)'}}>Cutoff Period:</span>
          <select style={iStyle} value={selectedCutoff.id}
            onChange={e => { setSelectedCutoff(CUTOFF_PERIODS.find(p => p.id === parseInt(e.target.value))); setTimesheetData(null) }}>
            {CUTOFF_PERIODS.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}{savedRuns.find ? '' : ''}
              </option>
            ))}
          </select>

          {/* Status chip */}
          {hasLiveData ? (
            <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'var(--matcha-dark)',fontWeight:600}}>
              ✓ Timesheet loaded — review and Save Payroll to lock it in
            </div>
          ) : hasSavedData ? (
            <div style={{background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'var(--sky)',fontWeight:600}}>
              ✓ Saved payroll — upload new timesheet to recompute
            </div>
          ) : (
            <div style={{background:'var(--gold-pale)',border:'1px solid var(--gold)',borderRadius:8,padding:'6px 12px',fontSize:11,color:'#a06000',fontWeight:500}}>
              💡 Upload a StoreHub timesheet to compute payroll for this period
            </div>
          )}
        </div>

        {/* SUMMARY VIEW */}
        {view === 'summary' && <>
          {/* KPI Cards */}
          <div className="kpi-grid" style={{marginBottom:16}}>
            {[
              { label:'Total Gross',      value: peso(totals.gross),      cls:'c-matcha', icon:'💰' },
              { label:'Total Deductions', value: peso(totals.deductions), cls:'c-blush',  icon:'📉' },
              { label:'Total Net Pay',    value: peso(totals.net),        cls:'c-gold',   icon:'💸' },
              { label:'Staff on Payroll', value: `${payrollRows.filter(r=>r.pay.daysWorked>0).length} / ${staff.length}`, cls:'c-bark', icon:'👥' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.cls}`}>
                <div className="kpi-icon">{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Deduction breakdown */}
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px',marginBottom:16,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {[
              ['Late Deductions', totals.lateDeduction, '#c0392b'],
              ['SSS',             totals.sss,           '#2d5a8a'],
              ['PhilHealth',      totals.philhealth,    '#2d7a6a'],
              ['Pag-IBIG + Tax',  totals.pagibig + totals.tax, '#8e44ad'],
            ].map(([label, val, color]) => (
              <div key={label} style={{textAlign:'center',padding:'10px',background:'var(--surface)',borderRadius:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color}}>{peso(val)}</div>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginTop:3}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'var(--espresso)'}}>
                  {['Employee','Role','Type','Days','Hrs','Late','Gross','Deductions','Net Pay','SVC',''].map(h => (
                    <th key={h} style={{padding:'11px 12px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((r, i) => (
                  <tr key={r.staff.id}
                    onClick={() => { setSelectedStaff(r); setView('detail') }}
                    style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)',cursor:'pointer',transition:'background .1s'}}
                    onMouseEnter={e => e.currentTarget.style.background='var(--matcha-pale)'}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--white)':'var(--surface)'}>
                    <td style={{padding:'9px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:getRoleColor(r.staff.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>
                          {initials(r.staff.first_name,r.staff.last_name)}
                        </div>
                        <div>
                          <div style={{fontWeight:600,fontSize:11}}>{r.staff.first_name} {r.staff.last_name}</div>
                          {r.staff.nickname&&<div style={{fontSize:9,color:'var(--text-muted)'}}>"{r.staff.nickname}"</div>}
                        </div>
                        {!r.hasTimesheet && !r.saved && <span style={{fontSize:8,background:'#fef3e2',color:'#a06000',border:'1px solid #d4a84344',padding:'1px 4px',borderRadius:4,fontWeight:600}}>No TS</span>}
                        {r.saved && !r.isLive && <span style={{fontSize:8,background:'var(--sky-pale)',color:'var(--sky)',border:'1px solid #4a90c444',padding:'1px 4px',borderRadius:4,fontWeight:600}}>Saved</span>}
                      </div>
                    </td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5,background:getRoleColor(r.staff.role)+'22',color:getRoleColor(r.staff.role)}}>{r.staff.role}</span>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:10,color:'var(--text-muted)'}}>{r.staff.employment_type||'Full-time'}</td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{r.pay.daysWorked}</td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontSize:11}}>{r.pay.paidHours.toFixed(1)}h</td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontSize:11,color:r.pay.totalLateMins>0?'#c0392b':'var(--text-muted)'}}>
                      {r.pay.totalLateMins>0?`${r.pay.totalLateMins}m`:'—'}
                    </td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--matcha-dark)',fontSize:11}}>{peso(r.pay.gross)}</td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",color:'#c0392b',fontSize:11}}>-{peso(r.pay.totalDeductions)}</td>
                    <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12}}>{peso(r.pay.netPay)}</td>
                    <td style={{padding:'9px 12px',fontSize:13}}>{r.pay.eligible?'✅':'❌'}</td>
                    <td style={{padding:'9px 12px',fontSize:10,color:'var(--text-muted)'}}>→</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--espresso)',borderTop:'2px solid var(--matcha)'}}>
                  <td colSpan={6} style={{padding:'11px 12px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                  <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totals.gross)}</td>
                  <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#f5a0a0'}}>-{peso(totals.deductions)}</td>
                  <td style={{padding:'11px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672',fontSize:13}}>{peso(totals.net)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>}

        {/* DETAIL VIEW */}
        {view === 'detail' && selectedStaff && (() => {
          const { staff: s, periodShifts, pay } = selectedStaff
          return (
            <div>
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 22px',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:getRoleColor(s.role),display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'white',flexShrink:0}}>
                  {initials(s.first_name,s.last_name)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700}}>{s.first_name} {s.last_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{s.role} · {s.employment_type||'Full-time'} · {selectedCutoff.label}</div>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                {/* Pay breakdown */}
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:10,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
                    Pay Computation
                  </div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:10}}>
                    {pay.daysWorked} days · {pay.paidHours.toFixed(2)} paid hrs · {peso(Math.round(pay.hourlyRate||0))}/hr
                  </div>
                  <PayRow label="Gross Pay" value={peso(pay.gross)} bold />
                  <div style={{margin:'8px 0 4px',fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)'}}>Deductions</div>
                  <PayRow label={`Late (${pay.totalLateMins} mins)`} value={`-${peso(pay.lateDeduction)}`} red={pay.lateDeduction>0} />
                  {(s.employment_type||'Full-time')==='Full-time' && <>
                    <PayRow label="SSS"             value={`-${peso(pay.sss)}`}        red />
                    <PayRow label="PhilHealth"      value={`-${peso(pay.philhealth)}`} red />
                    <PayRow label="Pag-IBIG"        value={`-${peso(pay.pagibig)}`}    red />
                    <PayRow label="Withholding Tax" value={`-${peso(pay.tax)}`}        red={pay.tax>0} />
                  </>}
                  <div style={{borderTop:'2px solid var(--border)',marginTop:10,paddingTop:10}}>
                    <PayRow label="NET PAY" value={peso(pay.netPay)} bold big />
                  </div>
                  <div style={{marginTop:12,background:pay.eligible?'var(--matcha-pale)':'#fdeaea',borderRadius:8,padding:'9px 12px',fontSize:12,fontWeight:600,color:pay.eligible?'var(--matcha-dark)':'#c0392b',textAlign:'center'}}>
                    {pay.eligible ? '✅ Eligible for Service Charge' : `❌ Not eligible — ${pay.lateCount} late(s) this cutoff`}
                  </div>
                </div>

                {/* Shift log */}
                <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px 20px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:10,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
                    Shift Log · {periodShifts.length} shifts
                  </div>
                  {periodShifts.length === 0 ? (
                    <div style={{textAlign:'center',padding:20,color:'var(--text-muted)',fontSize:12}}>
                      {selectedStaff.saved ? 'Shift details not stored — re-upload timesheet to view' : 'No shifts in this cutoff period'}
                    </div>
                  ) : (
                    <div style={{maxHeight:340,overflowY:'auto'}}>
                      {periodShifts.map((shift, i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:11}}>
                          <div style={{width:28,height:28,borderRadius:6,background:shift.lateMinutes>0?'#fdeaea':'var(--matcha-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:shift.lateMinutes>0?'#c0392b':'var(--matcha-dark)',flexShrink:0}}>
                            {shift.date?.split('/')[1]}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:600}}>{shift.timeIn?.split(' ')[2]} → {shift.timeOut?.split(' ')[2]}</div>
                            <div style={{fontSize:10,color:'var(--text-muted)'}}>{shift.paidHours.toFixed(1)} paid hrs{shift.rawHours>9?' (capped)':''}</div>
                          </div>
                          {shift.lateMinutes>0 && (
                            <span style={{fontSize:9,fontWeight:700,background:'#fdeaea',color:'#c0392b',padding:'2px 6px',borderRadius:6}}>+{shift.lateMinutes}m late</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* UNMATCHED VIEW */}
        {view === 'unmatched' && (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:20}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>⚠️ Unmatched Timesheet Entries</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>These employees appear in the timesheet but couldn't be matched to a staff profile. They are excluded from payroll.</div>
            {unmatchedTs.map((ts, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:12,background:'#fef3e2',border:'1px solid #d4a84344',borderRadius:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#d4a843',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white'}}>
                  {((ts.firstName||'')[0]||'').toUpperCase()}{((ts.lastName||'')[0]||'').toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600}}>{ts.firstName} {ts.lastName}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{ts.email} · {ts.shifts?.length||0} shifts · {ts.totalHours}h total</div>
                </div>
                <div style={{fontSize:11,color:'#a06000',fontWeight:600}}>Add to Staff Directory to include in payroll</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}

function PayRow({ label, value, bold, big, red }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:big?14:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:bold?700:400}}>{label}</span>
      <span style={{fontWeight:bold?700:500,color:red?'#c0392b':bold?'var(--espresso)':'var(--text-primary)',fontFamily:"'DM Mono',monospace"}}>{value}</span>
    </div>
  )
}
