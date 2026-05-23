'use client'
import AuthShell from '../../components/AuthShell'
export default function AnnouncePage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Announcements</div><div className="topbar-sub">Post updates to the whole team</div></div>
      </div>
      <div className="page-content">
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>📣</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Announcements</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.7,maxWidth:480,margin:'0 auto'}}>
            Post team-wide announcements with Messenger delivery, read receipts per staff member, and pinned notices.
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
