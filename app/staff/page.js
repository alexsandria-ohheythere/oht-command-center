'use client'
import AuthShell from '../../components/AuthShell'
export default function StaffPage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Staff Directory</div><div className="topbar-sub">Manage your team of 22</div></div>
      </div>
      <div className="page-content">
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>👥</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Staff Directory</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.7,maxWidth:480,margin:'0 auto'}}>
            Full staff directory with invite-by-email, role assignment, Messenger connection status, and employee portal login management.
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
