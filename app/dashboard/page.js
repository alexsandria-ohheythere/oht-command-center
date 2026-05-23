'use client'
import AuthShell from '../../components/AuthShell'

const SHIFTS_TODAY = [
  { name: 'Maria Santos',   time: '6:30–3:30',  type: 'AM',  color: '#7ab648' },
  { name: 'Josie Reyes',    time: '6:30–3:30',  type: 'AM',  color: '#d4a843' },
  { name: 'Karl Bautista',  time: '11:00–8:00', type: 'MID', color: '#4a90c4' },
  { name: 'Trisha Lim',     time: '3:00–11:00', type: 'PM',  color: '#b06af5' },
  { name: 'Ryan Cruz',      time: '3:00–11:00', type: 'PM',  color: '#5c3d1e' },
]

const BADGE_STYLE = {
  AM:  { background: '#eef7e4', color: '#4a7a1e', border: '1px solid #7ab648' },
  MID: { background: '#fef3e2', color: '#a06000', border: '1px solid #d4a843' },
  PM:  { background: '#e8f0fb', color: '#2d5a8a', border: '1px solid #4a90c4' },
}

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <AuthShell>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Good morning ☀️</div>
          <div className="topbar-sub">{today} · Oh Hey There Command Center</div>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 7 }}>
          {today.split(',')[0]}
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid fade-up">
          {[
            { label: "Today's Revenue", value: '₱12,480', delta: '↑ 14% vs yesterday', dir: 'up',     icon: '💰', cls: 'c-matcha' },
            { label: 'Orders Today',    value: '84',       delta: '↑ 9 more than avg',  dir: 'up',     icon: '🧋', cls: 'c-gold'   },
            { label: 'Staff On Shift',  value: '6 / 8',    delta: '2 shifts uncovered', dir: 'neutral', icon: '👥', cls: 'c-blush'  },
            { label: 'Open Tasks',      value: '5',        delta: '↑ 2 overdue',        dir: 'down',   icon: '✅', cls: 'c-bark'   },
          ].map(k => (
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className={`kpi-delta ${k.dir}`}>{k.delta}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          {/* Today's shifts */}
          <div className="card fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 700 }}>Today's Shifts</div>
              <a href="/schedule" style={{ fontSize: 11, color: 'var(--matcha-dark)', fontWeight: 600, textDecoration: 'none' }}>View all →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {SHIFTS_TODAY.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'var(--surface)', borderRadius: 9, border: '1px solid var(--cream-dark)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>{s.time}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, ...BADGE_STYLE[s.type] }}>{s.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions + staff overview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card fade-up">
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Staff Overview</div>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[['22','Total'],['6','On Shift'],['2','Absent']].map(([num, lbl], i) => (
                  <div key={lbl} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 26, fontWeight: 700, color: i===1?'var(--matcha-dark)':i===2?'#c0392b':'var(--espresso)' }}>{num}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card fade-up">
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Quick Actions</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[['📅','Scheduling','/schedule'],['✅','New Task','/tasks'],['📣','Announce','/announce'],['💸','Payroll','/payroll']].map(([icon, label, href]) => (
                  <a key={label} href={href} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 10, textAlign: 'center', textDecoration: 'none', transition: 'all .15s', display: 'block' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--espresso)';e.currentTarget.querySelectorAll('span').forEach(s=>s.style.color='var(--cream)')}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--surface)';e.currentTarget.querySelectorAll('span').forEach(s=>s.style.color='')}}>
                    <div style={{ fontSize: 18 }}>{icon}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3, display: 'block' }}>{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div className="card fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 700 }}>Announcements</div>
            <a href="/announce" style={{ fontSize: 11, color: 'var(--matcha-dark)', fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              { title: '🌿 New Matcha Menu Drop — This Friday!', body: "We're launching 3 new menu items. All baristas must complete the new recipe training by Thursday.", time: 'Posted by CJ · Today, 8:14 AM', cls: 'var(--matcha)', bg: '#f0f8e8' },
              { title: '⚠️ Payroll Processing — Sunday 5PM Cutoff', body: 'Please submit DTR corrections before Sunday 5PM. Late submissions will be processed next cycle.', time: 'Posted by Alex · Yesterday, 3:00 PM', cls: 'var(--gold)', bg: '#fef8ec' },
            ].map(a => (
              <div key={a.title} style={{ padding: '11px 13px', borderRadius: 9, borderLeft: `3px solid ${a.cls}`, background: a.bg }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{a.body}</div>
                <div style={{ fontSize: 10, color: '#bbb', marginTop: 5, fontFamily: "'DM Mono', monospace" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
