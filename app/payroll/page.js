'use client'
import AuthShell from '../../components/AuthShell'
export default function PayrollPage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Payroll</div><div className="topbar-sub">Compute and export staff payroll</div></div>
      </div>
      <div className="page-content">
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>💸</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Payroll Module</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.7,maxWidth:480,margin:'0 auto'}}>
            Hours × rate auto-calculator, deductions, DTR upload, and CSV/PDF export for all 22 staff — coming next sprint.
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
