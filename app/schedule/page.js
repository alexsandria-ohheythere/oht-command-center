'use client'
import AuthShell from '../../components/AuthShell'

export default function SchedulePage() {
  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Scheduling</div>
          <div className="topbar-sub">Manage and publish weekly shifts · Mon–Sun</div>
        </div>
      </div>
      <div className="page-content">
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Scheduler Module
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            The full drag-and-drop scheduler with AM / Mid / PM shifts, staff profile cards,
            and Messenger notifications is ready — it will be embedded here once the database
            tables are connected. Use the standalone HTML prototype in the meantime.
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
