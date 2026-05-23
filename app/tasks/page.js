'use client'
import AuthShell from '../../components/AuthShell'
export default function TasksPage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Task Board</div><div className="topbar-sub">Assign and track team tasks</div></div>
      </div>
      <div className="page-content">
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>✅</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Task Board Module</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.7,maxWidth:480,margin:'0 auto'}}>
            Full Kanban task board with throw-to-employee, Messenger notifications, department filters, and priority tracking — ready to embed once database is connected.
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
