'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../components/AuthShell'
import { createClient } from '../../lib/supabase'

const CATEGORIES = ['Dairy','Coffee','Packaging','Cleaning','Food','Beverage','Equipment','Other']
const UNITS = ['pcs','kg','g','bottle','sleeve','pack','roll','box','bag','liter','ml']

const blank = () => ({
  name: '', sku: '', category: 'Other', unit: 'pcs',
  avg_price: '', preferred_store: '', notes: '', is_active: true,
})

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
  width:'100%', border:'1px solid #e5e7eb', borderRadius:8,
  padding:'8px 12px', fontSize:13, outline:'none', boxSizing:'border-box',
  fontFamily:"'DM Sans',sans-serif",
}

function ItemForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:12, padding:20, marginBottom:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Item name *</label>
          <input style={iStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fresh Whole Milk" />
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>SKU</label>
          <input style={iStyle} value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. DAIRY-001" />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Category *</label>
          <select style={iStyle} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Unit *</label>
          <select style={iStyle} value={form.unit} onChange={e => set('unit', e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Avg price (₱)</label>
          <input style={iStyle} type="number" value={form.avg_price} onChange={e => set('avg_price', e.target.value)} placeholder="0.00" />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Preferred supplier / store</label>
          <input style={iStyle} value={form.preferred_store} onChange={e => set('preferred_store', e.target.value)} placeholder="e.g. S&R, Puregold" />
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Notes</label>
          <input style={iStyle} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Brand preference, specs, etc." />
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
          Active (visible to staff)
        </label>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onCancel} style={{ padding:'8px 16px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} style={{ padding:'8px 18px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, background:'#EF4576', color:'white', cursor:'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [editId, setEditId]       = useState(null)
  const [search, setSearch]       = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [filterActive, setFilterActive] = useState('active')
  const { show: showToast, el: toastEl } = useToast()

  const load = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.from('inventory_catalog').select('*').order('category').order('name')
    if (!error) setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  const handleAdd = async (form) => {
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_catalog').insert({
      ...form,
      avg_price: form.avg_price ? parseFloat(form.avg_price) : null,
      updated_at: new Date().toISOString(),
    })
    if (error) { showToast(error.message, 'error') }
    else { showToast('Item added to catalog'); setShowAdd(false); load() }
    setSaving(false)
  }

  const handleEdit = async (form) => {
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_catalog').update({
      ...form,
      avg_price: form.avg_price ? parseFloat(form.avg_price) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) { showToast(error.message, 'error') }
    else { showToast('Item updated'); setEditId(null); load() }
    setSaving(false)
  }

  const toggleActive = async (item) => {
    const sb = createClient()
    await sb.from('inventory_catalog').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id)
    showToast(item.is_active ? 'Item deactivated' : 'Item reactivated')
    load()
  }

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.preferred_store ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'All' || i.category === filterCat
    const matchActive = filterActive === 'all' || (filterActive === 'active' ? i.is_active : !i.is_active)
    return matchSearch && matchCat && matchActive
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  return (
    <AuthShell>
      {toastEl}
      <div className="topbar">
        <div>
          <div className="topbar-title">Inventory Catalog</div>
          <div className="topbar-sub">Manage items, suppliers, and pricing for purchase requests</div>
        </div>
        <button onClick={() => { setShowAdd(true); setEditId(null) }}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          + Add Item
        </button>
      </div>

      <div style={{ padding:'24px', maxWidth:900 }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Total items',  value: items.length,                      color:'#111'    },
            { label:'Active',       value: items.filter(i => i.is_active).length,  color:'#16a34a' },
            { label:'Inactive',     value: items.filter(i => !i.is_active).length, color:'#9ca3af' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
              <p style={{ fontSize:11, color:'#6b7280', margin:0 }}>{s.label}</p>
              <p style={{ fontSize:24, fontWeight:700, color:s.color, margin:'4px 0 0' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showAdd && (
          <ItemForm initial={blank()} onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, suppliers…"
            style={{ ...iStyle, width:220, fontSize:12 }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...iStyle, width:140, fontSize:12 }}>
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display:'flex', gap:6 }}>
            {[['active','Active'],['inactive','Inactive'],['all','All']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterActive(val)}
                style={{ padding:'6px 14px', fontSize:11, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer',
                  background: filterActive === val ? '#EF4576' : 'white',
                  color:      filterActive === val ? 'white'   : '#6b7280',
                  boxShadow:  filterActive === val ? 'none' : '0 0 0 1px #e5e7eb',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, background:'#f9fafb', borderRadius:12, border:'1px dashed #e5e7eb' }}>
            <p style={{ color:'#9ca3af', fontSize:13 }}>No items found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} style={{ marginBottom:28 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#9ca3af', marginBottom:10 }}>{cat}</p>
              <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                {catItems.map((item, idx) => (
                  <div key={item.id}>
                    {editId === item.id ? (
                      <div style={{ padding:16 }}>
                        <ItemForm initial={{ ...item, avg_price: item.avg_price?.toString() ?? '' }} onSave={handleEdit} onCancel={() => setEditId(null)} saving={saving} />
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom: idx < catItems.length - 1 ? '1px solid #f3f4f6' : 'none', opacity: item.is_active ? 1 : 0.5 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{item.name}</span>
                            {item.sku && <span style={{ fontSize:10, fontFamily:'monospace', color:'#9ca3af', background:'#f3f4f6', padding:'1px 6px', borderRadius:4 }}>{item.sku}</span>}
                            {!item.is_active && <span style={{ fontSize:10, fontWeight:600, color:'#9ca3af', background:'#f3f4f6', padding:'1px 8px', borderRadius:20 }}>Inactive</span>}
                          </div>
                          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                            <span style={{ fontSize:11, color:'#6b7280' }}>Unit: <strong>{item.unit}</strong></span>
                            {item.avg_price != null && <span style={{ fontSize:11, color:'#6b7280' }}>Avg: <strong>₱ {Number(item.avg_price).toLocaleString('en-PH', { minimumFractionDigits:2 })}</strong></span>}
                            {item.preferred_store && <span style={{ fontSize:11, color:'#6b7280' }}>Store: <strong>{item.preferred_store}</strong></span>}
                            {item.notes && <span style={{ fontSize:11, color:'#9ca3af', fontStyle:'italic' }}>{item.notes}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:12 }}>
                          <button onClick={() => { setEditId(item.id); setShowAdd(false) }}
                            style={{ padding:'5px 12px', fontSize:11, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer', color:'#374151' }}>
                            Edit
                          </button>
                          <button onClick={() => toggleActive(item)}
                            style={{ padding:'5px 12px', fontSize:11, border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer', color: item.is_active ? '#9ca3af' : '#16a34a' }}>
                            {item.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AuthShell>
  )
}
