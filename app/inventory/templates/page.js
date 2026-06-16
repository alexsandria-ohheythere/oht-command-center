'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const DEPARTMENTS = [
  { key:'bar',        label:'Bar',        icon:'🍵' },
  { key:'commissary', label:'Commissary', icon:'🍳' },
  { key:'utility',    label:'Utility',    icon:'🧹' },
  { key:'operations', label:'Operations', icon:'📋' },
]
const UNITS = ['pcs','kg','g','bottle','bottles','pack','packs','box','boxes','bag','bags','roll','rolls','can','cans','L','ml','liter','sheet','sheets','jar','tub','block','blocks','case','cases']

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, padding:'12px 18px', borderRadius:12, background:type==='error'?'#dc2626':'#111', color:'white', fontSize:13, fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
      {msg}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'success') => setToast({ msg, type })
  const el = toast ? <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, el }
}

const iStyle = {
  border:'1px solid #e5e7eb', borderRadius:8, padding:'7px 10px',
  fontSize:12, outline:'none', fontFamily:"'DM Sans',sans-serif", background:'white',
}

export default function TemplateManagerPage() {
  const [dept, setDept]         = useState('bar')
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd]   = useState(false)
  const [newItem, setNewItem]   = useState({ section:'', item_name:'', unit:'pcs', threshold_qty:'', sort_order:'' })
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('stock_templates').select('*').eq('department', dept).order('sort_order').order('section')
    setItems(data ?? [])
    setLoading(false)
  }, [dept])

  useEffect(() => { load() }, [dept])

  const sections = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const handleSaveEdit = async (id) => {
    setSaving(id)
    const sb = createClient()
    const { error } = await sb.from('stock_templates').update({
      item_name: editForm.item_name,
      unit: editForm.unit,
      threshold_qty: parseFloat(editForm.threshold_qty),
      section: editForm.section,
      sort_order: parseInt(editForm.sort_order) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Item updated'); setEditId(null); load() }
    setSaving(null)
  }

  const handleAdd = async () => {
    if (!newItem.item_name.trim() || !newItem.section.trim()) return showToast('Item name and section are required', 'error')
    setSaving('new')
    const sb = createClient()
    const { error } = await sb.from('stock_templates').insert({
      department: dept,
      section: newItem.section.trim(),
      item_name: newItem.item_name.trim(),
      unit: newItem.unit,
      threshold_qty: parseFloat(newItem.threshold_qty) || 0,
      sort_order: parseInt(newItem.sort_order) || items.length + 1,
    })
    if (error) showToast(error.message, 'error')
    else {
      showToast('Item added')
      setNewItem({ section:'', item_name:'', unit:'pcs', threshold_qty:'', sort_order:'' })
      setShowAdd(false)
      load()
    }
    setSaving(null)
  }

  const handleToggle = async (item) => {
    const sb = createClient()
    await sb.from('stock_templates').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id)
    showToast(item.is_active ? 'Item hidden from staff' : 'Item shown to staff')
    load()
  }

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.item_name}"? This cannot be undone.`)) return
    const sb = createClient()
    await sb.from('stock_templates').delete().eq('id', item.id)
    showToast('Item deleted')
    load()
  }

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Inventory Templates</div>
          <div className="topbar-sub">Manage daily inventory checklists per department</div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          + Add Item
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ maxWidth:860 }}>

          {/* Department tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
            {DEPARTMENTS.map(d => (
              <button key={d.key} onClick={() => setDept(d.key)}
                style={{ padding:'8px 18px', fontSize:13, fontWeight:600, borderRadius:10, border:'none', cursor:'pointer',
                  background: dept === d.key ? '#EF4576' : 'white',
                  color:      dept === d.key ? 'white'   : '#6b7280',
                  boxShadow:  dept === d.key ? 'none' : '0 0 0 1px #e5e7eb',
                }}>
                {d.icon} {d.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total items',  value: items.length, color:'#111' },
              { label:'Active',       value: items.filter(i=>i.is_active).length, color:'#16a34a' },
              { label:'Sections',     value: Object.keys(sections).length, color:'#EF4576' },
            ].map(s => (
              <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:14 }}>
                <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
                <p style={{ fontSize:22, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Add form */}
          {showAdd && (
            <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:12, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:12 }}>Add item to {DEPARTMENTS.find(d=>d.key===dept)?.label}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Section *</label>
                  <input style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={newItem.section} onChange={e => setNewItem(p=>({...p, section:e.target.value}))} placeholder="e.g. Dairy Products" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Item name *</label>
                  <input style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={newItem.item_name} onChange={e => setNewItem(p=>({...p, item_name:e.target.value}))} placeholder="e.g. Oatside Regular" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Unit</label>
                  <select style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={newItem.unit} onChange={e => setNewItem(p=>({...p, unit:e.target.value}))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Running low threshold</label>
                  <input type="number" style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={newItem.threshold_qty} onChange={e => setNewItem(p=>({...p, threshold_qty:e.target.value}))} placeholder="e.g. 20" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Sort order</label>
                  <input type="number" style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={newItem.sort_order} onChange={e => setNewItem(p=>({...p, sort_order:e.target.value}))} placeholder="e.g. 10" />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding:'7px 16px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving==='new'} style={{ padding:'7px 18px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity:saving==='new'?0.5:1 }}>
                  {saving==='new' ? 'Adding…' : 'Add item'}
                </button>
              </div>
            </div>
          )}

          {/* Items grouped by section */}
          {loading ? <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Loading…</p>
            : Object.keys(sections).length === 0
              ? <div style={{ textAlign:'center', padding:60, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}>
                  <p style={{ color:'#9ca3af', fontSize:13 }}>No items yet — add some above</p>
                </div>
              : Object.entries(sections).map(([section, sectionItems]) => (
                <div key={section} style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:10 }}>{section}</div>
                  <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                    {sectionItems.map((item, idx) => (
                      <div key={item.id} style={{ borderBottom: idx < sectionItems.length-1 ? '1px solid #f3f4f6' : 'none', opacity: item.is_active ? 1 : 0.45 }}>
                        {editId === item.id ? (
                          <div style={{ padding:14, background:'#f9fafb' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                              <div>
                                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#6b7280', marginBottom:3 }}>Section</label>
                                <input style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={editForm.section} onChange={e => setEditForm(p=>({...p, section:e.target.value}))} />
                              </div>
                              <div>
                                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#6b7280', marginBottom:3 }}>Item name</label>
                                <input style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={editForm.item_name} onChange={e => setEditForm(p=>({...p, item_name:e.target.value}))} />
                              </div>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                              <div>
                                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#6b7280', marginBottom:3 }}>Unit</label>
                                <select style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={editForm.unit} onChange={e => setEditForm(p=>({...p, unit:e.target.value}))}>
                                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#6b7280', marginBottom:3 }}>Threshold</label>
                                <input type="number" style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={editForm.threshold_qty} onChange={e => setEditForm(p=>({...p, threshold_qty:e.target.value}))} />
                              </div>
                              <div>
                                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#6b7280', marginBottom:3 }}>Sort order</label>
                                <input type="number" style={{ ...iStyle, width:'100%', boxSizing:'border-box' }} value={editForm.sort_order} onChange={e => setEditForm(p=>({...p, sort_order:e.target.value}))} />
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                              <button onClick={() => setEditId(null)} style={{ padding:'6px 14px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
                              <button onClick={() => handleSaveEdit(item.id)} disabled={saving===item.id} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity:saving===item.id?0.5:1 }}>
                                {saving===item.id ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:10 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <span style={{ fontSize:13, fontWeight:500, color:'#1f2937' }}>{item.item_name}</span>
                              {!item.is_active && <span style={{ marginLeft:8, fontSize:10, color:'#9ca3af', background:'#f3f4f6', padding:'1px 6px', borderRadius:4 }}>Hidden</span>}
                              <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                                Threshold: <strong>{item.threshold_qty} {item.unit}</strong>
                                <span style={{ marginLeft:8 }}>Sort: {item.sort_order}</span>
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              <button onClick={() => { setEditId(item.id); setEditForm({ section:item.section, item_name:item.item_name, unit:item.unit, threshold_qty:item.threshold_qty?.toString()??'', sort_order:item.sort_order?.toString()??'' }) }}
                                style={{ padding:'4px 10px', fontSize:11, border:'1px solid #e5e7eb', borderRadius:6, background:'white', cursor:'pointer', color:'#374151' }}>Edit</button>
                              <button onClick={() => handleToggle(item)}
                                style={{ padding:'4px 10px', fontSize:11, border:'1px solid #e5e7eb', borderRadius:6, background:'white', cursor:'pointer', color: item.is_active?'#9ca3af':'#16a34a' }}>
                                {item.is_active ? 'Hide' : 'Show'}
                              </button>
                              <button onClick={() => handleDelete(item)}
                                style={{ padding:'4px 10px', fontSize:11, border:'1px solid #fca5a5', borderRadius:6, background:'white', cursor:'pointer', color:'#dc2626' }}>Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </AuthShell>
  )
}
