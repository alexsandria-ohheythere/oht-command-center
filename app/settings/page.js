'use client'
import AuthShell from '../../components/AuthShell'
export default function SettingsPage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Settings</div><div className="topbar-sub">Configure your command center</div></div>
      </div>
      <div className="page-content">
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>⚙️</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Settings</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.7,maxWidth:480,margin:'0 auto'}}>
            Business info, timezone, payroll cutoff, notification preferences, integrations (Shopify, Google Sheets, Google Calendar).
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
