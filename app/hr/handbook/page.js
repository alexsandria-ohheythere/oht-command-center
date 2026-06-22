'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const CATEGORIES = ['Attendance','Shift Coverage','Conduct','Dress Code','Anti-Discrimination','Workplace Conduct','Operations','Food Safety','Confidentiality','Health & Safety','Negligence']
const SEVERITIES = ['Minor','Moderate','Major','Grave']
const ALL_ROLES  = ['Senior Barista','Junior Barista - Milk Station','Junior Barista - Cashier','Executive Chef','Sous Chef','Cafe Supervisor','Cafe Operations Support']

const SEV_STYLE = {
  Minor:    { bg:'#eef7e4', color:'#4a7a1e' },
  Moderate: { bg:'#fef3e2', color:'#a06000' },
  Major:    { bg:'#fde8ee', color:'#c0392b' },
  Grave:    { bg:'#2d0a0a', color:'#ff6b6b' },
}

const iStyle = { width:'100%', background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', boxSizing:'border-box' }
const labelStyle = { fontSize:12, fontWeight:600, color:'#5a4a3a', marginBottom:5, display:'block' }
const btn = (bg, color='white') => ({ background:bg, color, border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" })

function SeverityBadge({ s }) {
  const st = SEV_STYLE[s] || { bg:'#eee', color:'#333' }
  return <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{s}</span>
}

function EntryModal({ entry, onSave, onClose }) {
  const blank = { violation_code:'', title:'', description:'', category:CATEGORIES[0], severity:'Minor', applies_to:[], sanction_1st:'', sanction_2nd:'', sanction_3rd:'', sanction_4th:'', sanction_5th:'', is_active:true }
  const [form, setForm] = useState(entry ? { ...entry, applies_to: entry.applies_to || [] } : blank)
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleRole(r) { set('applies_to', form.applies_to.includes(r) ? form.applies_to.filter(x => x !== r) : [...form.applies_to, r]) }

  async function save() {
    if (!form.violation_code || !form.title || !form.category || !form.severity) return alert('Code, title, category and severity are required.')
    setSaving(true)
    const supabase = createClient()
    const payload = { violation_code: form.violation_code.toUpperCase(), title: form.title, description: form.description, category: form.category, severity: form.severity, applies_to: form.applies_to, sanction_1st: form.sanction_1st, sanction_2nd: form.sanction_2nd, sanction_3rd: form.sanction_3rd, sanction_4th: form.sanction_4th, sanction_5th: form.sanction_5th, is_active: form.is_active, updated_at: new Date().toISOString() }
    let error
    if (entry) {
      ({ error } = await supabase.from('handbook_entries').update(payload).eq('id', entry.id))
    } else {
      ({ error } = await supabase.from('handbook_entries').insert(payload))
    }
    setSaving(false)
    if (error) return alert('Error saving: ' + error.message)
    onSave()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fffdf9', borderRadius:16, width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto', padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#1a1208' }}>{entry ? 'Edit Violation' : 'Add Violation'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888' }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={labelStyle}>Violation Code *</label>
            <input style={iStyle} value={form.violation_code} onChange={e => set('violation_code', e.target.value)} placeholder="e.g. AT-01" />
          </div>
          <div>
            <label style={labelStyle}>Severity *</label>
            <select style={iStyle} value={form.severity} onChange={e => set('severity', e.target.value)}>
              {SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop:14 }}>
          <label style={labelStyle}>Violation Title *</label>
          <input style={iStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Tardiness (1 min or more)" />
        </div>

        <div style={{ marginTop:14 }}>
          <label style={labelStyle}>Category *</label>
          <select style={iStyle} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginTop:14 }}>
          <label style={labelStyle}>Description / Policy Text</label>
          <textarea style={{ ...iStyle, minHeight:80, resize:'vertical' }} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Explain what this violation covers..." />
        </div>

        <div style={{ marginTop:14 }}>
          <label style={labelStyle}>Applies To (leave empty = all roles)</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {ALL_ROLES.map(r => (
              <button key={r} type="button" onClick={() => toggleRole(r)} style={{ ...btn(form.applies_to.includes(r) ? '#1a1208' : 'white', form.applies_to.includes(r) ? 'white' : '#1a1208'), border:'1px solid #1a1208', fontSize:11, padding:'5px 12px', borderRadius:20 }}>{r}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop:18, background:'#f5f0e8', borderRadius:10, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:10 }}>SANCTION PROGRESSION</div>
          {['sanction_1st','sanction_2nd','sanction_3rd','sanction_4th','sanction_5th'].map((k,i) => (
            <div key={k} style={{ marginBottom:8 }}>
              <label style={{ ...labelStyle, marginBottom:3 }}>{i+1}{['st','nd','rd','th','th'][i]} Offense</label>
              <input style={iStyle} value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={i >= 3 ? '(optional)' : 'e.g. Verbal Warning'} />
            </div>
          ))}
        </div>

        <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
          <label htmlFor="is_active" style={{ fontSize:13, color:'#5a4a3a', fontWeight:600 }}>Active (visible in dropdowns)</label>
        </div>

        <div style={{ marginTop:20, display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btn('#f0ebe3','#5a4a3a')}>Cancel</button>
          <button onClick={save} disabled={saving} style={btn('#1a1208')}>{saving ? 'Saving…' : 'Save Violation'}</button>
        </div>
      </div>
    </div>
  )
}

export default function HandbookPage() {
  const [entries, setEntries]   = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('all')
  const [sevFilter, setSev]     = useState('all')
  const [activeFilter, setActive] = useState('all')
  const [modal, setModal]       = useState(null) // null | 'new' | entry object
  const [toast, setToast]       = useState(null)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('handbook_entries').select('*').order('violation_code')
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let r = entries
    if (catFilter !== 'all') r = r.filter(e => e.category === catFilter)
    if (sevFilter !== 'all') r = r.filter(e => e.severity === sevFilter)
    if (activeFilter !== 'all') r = r.filter(e => activeFilter === 'active' ? e.is_active : !e.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(e => e.title.toLowerCase().includes(q) || e.violation_code.toLowerCase().includes(q) || (e.description||'').toLowerCase().includes(q))
    }
    setFiltered(r)
  }, [entries, catFilter, sevFilter, activeFilter, search])

  async function toggleActive(entry) {
    const supabase = createClient()
    await supabase.from('handbook_entries').update({ is_active: !entry.is_active, updated_at: new Date().toISOString() }).eq('id', entry.id)
    showToast(entry.is_active ? 'Violation archived' : 'Violation activated')
    load()
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(e => e.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <AuthShell>
      <div style={{ padding:'24px 28px', fontFamily:"'DM Sans',sans-serif", maxWidth:1100, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'#1a1208' }}>📖 Handbook</h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#888' }}>{entries.filter(e => e.is_active).length} active violations across {CATEGORIES.length} categories</p>
          </div>
          <button onClick={() => setModal('new')} style={btn('#1a1208')}>+ Add Violation</button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
          <input style={{ ...iStyle, maxWidth:240 }} placeholder="🔍 Search violations…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...iStyle, maxWidth:180 }} value={catFilter} onChange={e => setCat(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={{ ...iStyle, maxWidth:160 }} value={sevFilter} onChange={e => setSev(e.target.value)}>
            <option value="all">All Severities</option>
            {SEVERITIES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={{ ...iStyle, maxWidth:140 }} value={activeFilter} onChange={e => setActive(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Results count */}
        <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>{filtered.length} violation{filtered.length !== 1 ? 's' : ''} shown</div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading handbook…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#888' }}>No violations found.</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom:28 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#5a4a3a', marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>{cat}</div>
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e8ddd0', overflow:'hidden' }}>
                {items.map((e, i) => (
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'90px 1fr auto auto', gap:12, alignItems:'center', padding:'12px 16px', borderBottom: i < items.length - 1 ? '1px solid #f0ebe3' : 'none', opacity: e.is_active ? 1 : 0.5 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#888', fontFamily:'monospace' }}>{e.violation_code}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1208' }}>{e.title}</div>
                      {e.sanction_1st && (
                        <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                          {[e.sanction_1st, e.sanction_2nd, e.sanction_3rd, e.sanction_4th, e.sanction_5th].filter(Boolean).join(' → ')}
                        </div>
                      )}
                    </div>
                    <SeverityBadge s={e.severity} />
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setModal(e)} style={btn('#f0ebe3','#5a4a3a')} title="Edit">✏️</button>
                      <button onClick={() => toggleActive(e)} style={btn(e.is_active ? '#fde8ee' : '#eef7e4', e.is_active ? '#c0392b' : '#4a7a1e')} title={e.is_active ? 'Archive' : 'Restore'}>{e.is_active ? '📦' : '♻️'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <EntryModal
          entry={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load(); showToast('Violation saved!') }}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1a1208', color:'white', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, zIndex:2000 }}>{toast}</div>
      )}
    </AuthShell>
  )
}
