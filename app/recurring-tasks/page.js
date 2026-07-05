'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const ROLES = [
  'Cafe Supervisor','Cafe Operations Support','Senior Barista',
  'Junior Barista - Milk Station','Junior Barista - Cashier',
  'Executive Chef','Sous Chef','Kitchen Staff',
]

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'

const SHIFT_OPTIONS = [
  { id:'',    label:'Any shift' },
  { id:'am',  label:'AM' },
  { id:'ops', label:'OPS' },
  { id:'mid', label:'Mid' },
  { id:'pm',  label:'PM' },
]

const DAYS = [
  { id:'monday',    label:'Mon' },
  { id:'tuesday',   label:'Tue' },
  { id:'wednesday', label:'Wed' },
  { id:'thursday',  label:'Thu' },
  { id:'friday',    label:'Fri' },
  { id:'saturday',  label:'Sat' },
  { id:'sunday',    label:'Sun' },
]

const iStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none' }

const emptyForm = { task_name:'', description:'', category:'Maintenance', role:ROLES[0], shift_type:'', days_of_week:[] }

export default function RecurringTasksPage() {
  const supabase = createClient()
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedRole, setSelectedRole] = useState('all')
  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [toast, setToast]           = useState(null)

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase.from('recurring_tasks').select('*').order('role').order('sort_order')
    setTasks(data || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3000) }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter(d => d !== day)
        : [...f.days_of_week, day]
    }))
  }

  function startEdit(task) {
    setEditingId(task.id)
    setForm({
      task_name: task.task_name, description: task.description || '',
      category: task.category || 'Maintenance', role: task.role,
      shift_type: task.shift_type || '', days_of_week: task.days_of_week || [],
    })
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm) }

  async function saveTask() {
    if (!form.task_name.trim()) { showToast('⚠️','Task name is required'); return }
    if (form.days_of_week.length === 0) { showToast('⚠️','Pick at least one day'); return }
    setSaving(true)

    const payload = {
      task_name: form.task_name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || 'Maintenance',
      role: form.role,
      shift_type: form.shift_type || null,
      days_of_week: form.days_of_week,
      updated_at: new Date().toISOString(),
    }

    if (editingId) {
      const { data, error } = await supabase.from('recurring_tasks').update(payload).eq('id', editingId).select().single()
      if (error) { showToast('❌', error.message); setSaving(false); return }
      setTasks(prev => prev.map(t => t.id === editingId ? data : t))
      showToast('✅','Task updated')
    } else {
      const order = tasks.filter(t => t.role === form.role).length
      const { data, error } = await supabase.from('recurring_tasks').insert([{ ...payload, sort_order: order, is_active: true }]).select().single()
      if (error) { showToast('❌', error.message); setSaving(false); return }
      setTasks(prev => [...prev, data])
      showToast('✅','Recurring task added')
    }
    setSaving(false)
    cancelEdit()
  }

  async function toggleActive(task) {
    const { data } = await supabase.from('recurring_tasks').update({ is_active: !task.is_active }).eq('id', task.id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  async function deleteTask(id) {
    await supabase.from('recurring_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    showToast('🗑️','Recurring task removed')
  }

  const visibleTasks = selectedRole === 'all' ? tasks : tasks.filter(t => t.role === selectedRole)

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Recurring Tasks</div>
          <div className="topbar-sub">Weekly maintenance & upkeep tasks that auto-appear on Daily Check-In · {tasks.filter(t=>t.is_active).length} active</div>
        </div>
      </div>

      <div className="page-content" style={{maxWidth:960, margin:'0 auto'}}>

        {/* Add / Edit form */}
        <div style={{background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px', marginBottom:20}}>
          <div style={{fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:14}}>
            {editingId ? '✏️ Edit Recurring Task' : '+ New Recurring Task'}
          </div>

          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginBottom:12}}>
            <div>
              <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5}}>Task Name</div>
              <input style={iStyle} placeholder="e.g. Clean aircon filter" value={form.task_name}
                onChange={e=>setForm(f=>({...f, task_name:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5}}>Category</div>
              <input style={iStyle} placeholder="Maintenance" value={form.category}
                onChange={e=>setForm(f=>({...f, category:e.target.value}))}/>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5}}>Description (optional)</div>
            <input style={iStyle} placeholder="Any extra detail for staff" value={form.description}
              onChange={e=>setForm(f=>({...f, description:e.target.value}))}/>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
            <div>
              <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5}}>Assigned Role</div>
              <select style={iStyle} value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5}}>Shift</div>
              <select style={iStyle} value={form.shift_type} onChange={e=>setForm(f=>({...f, shift_type:e.target.value}))}>
                {SHIFT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:7, textTransform:'uppercase', letterSpacing:.5}}>Repeats On</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {DAYS.map(d => {
                const active = form.days_of_week.includes(d.id)
                return (
                  <button key={d.id} type="button" onClick={()=>toggleDay(d.id)}
                    style={{
                      padding:'7px 14px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                      fontFamily:"'DM Sans',sans-serif", transition:'all .15s',
                      border:`1.5px solid ${active?'var(--matcha)':'var(--border)'}`,
                      background: active?'var(--matcha)':'var(--surface)',
                      color: active?'white':'var(--text-muted)',
                    }}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{display:'flex', gap:8}}>
            <button onClick={saveTask} disabled={saving}
              style={{background:'var(--matcha)', color:'white', border:'none', borderRadius:8, padding:'9px 18px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Add Recurring Task'}
            </button>
            {editingId && (
              <button onClick={cancelEdit}
                style={{background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 16px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Role filter */}
        <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
          <button onClick={()=>setSelectedRole('all')}
            style={{padding:'6px 14px', borderRadius:8, border:`1.5px solid ${selectedRole==='all'?'var(--matcha)':'var(--border)'}`, background:selectedRole==='all'?'var(--matcha-pale)':'var(--white)', color:selectedRole==='all'?'var(--matcha-dark)':'var(--text-muted)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
            All Roles
          </button>
          {ROLES.map(r => (
            <button key={r} onClick={()=>setSelectedRole(r)}
              style={{padding:'6px 14px', borderRadius:8, border:`1.5px solid ${selectedRole===r?getRoleColor(r):'var(--border)'}`, background:selectedRole===r?getRoleColor(r)+'22':'var(--white)', color:selectedRole===r?getRoleColor(r):'var(--text-muted)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
              {r}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, overflow:'hidden'}}>
          {loading ? (
            <div style={{padding:'30px', textAlign:'center', color:'var(--text-muted)', fontSize:12}}>Loading…</div>
          ) : visibleTasks.length === 0 ? (
            <div style={{padding:'30px', textAlign:'center', color:'var(--text-muted)', fontSize:12}}>No recurring tasks yet — add one above</div>
          ) : (
            visibleTasks.map((t, idx) => (
              <div key={t.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom: idx < visibleTasks.length-1 ? '1px solid var(--cream-dark)' : 'none', background: t.is_active ? 'var(--white)' : 'var(--surface)', opacity: t.is_active ? 1 : .55}}>
                <div style={{width:6, height:36, borderRadius:3, background:getRoleColor(t.role), flexShrink:0}}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, color:'var(--espresso)'}}>{t.task_name}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                    <span style={{color:getRoleColor(t.role), fontWeight:600}}>{t.role}</span>
                    <span>·</span>
                    <span>{t.category}</span>
                    <span>·</span>
                    <span>{t.shift_type ? t.shift_type.toUpperCase() : 'Any shift'}</span>
                    <span>·</span>
                    <span style={{fontFamily:"'DM Mono',monospace"}}>
                      {(t.days_of_week||[]).map(d => DAYS.find(x=>x.id===d)?.label || d).join(', ')}
                    </span>
                  </div>
                  {t.description && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:4, fontStyle:'italic'}}>{t.description}</div>}
                </div>
                <div style={{display:'flex', gap:6, flexShrink:0}}>
                  <button onClick={()=>toggleActive(t)}
                    style={{background:'transparent', color: t.is_active ? 'var(--matcha-dark)' : 'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
                    {t.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={()=>startEdit(t)}
                    style={{background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 9px', fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>✏️</button>
                  <button onClick={()=>deleteTask(t.id)}
                    style={{background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 9px', fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {toast && (
        <div style={{position:'fixed', bottom:22, right:22, background:'var(--espresso)', color:'var(--cream)', border:'1px solid #3d3020', borderRadius:12, padding:'12px 16px', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:9, boxShadow:'0 8px 28px rgba(0,0,0,.2)', zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </AuthShell>
  )
}
