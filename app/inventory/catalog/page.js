'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const CATEGORIES = ['Dairy','Coffee','Packaging','Cleaning','Food','Beverage','Equipment','Other']
const UNITS = ['pcs','kg','g','bottle','sleeve','pack','roll','box','bag','liter','ml']

const blank = () => ({
  name: '', sku: '', category: 'Other', unit: 'pcs',
  cost_per_item: '', net_volume: '', avg_price: '',
  preferred_store: '', notes: '', is_active: true,
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
      </div>

      {/* Cost calculation row */}
      <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#9ca3af', marginBottom:10 }}>Unit Cost Calculation</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr auto 1fr', gap:10, alignItems:'center' }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Cost per Item (₱)</label>
            <input style={iStyle} type="number" min="0" step="0.01"
              value={form.cost_per_item}
              onChange={e => {
                const cost = e.target.value
                const vol = parseFloat(form.net_volume) || 0
                const unitCost = vol > 0 && cost ? (parseFloat(cost) / vol).toFixed(4) : ''
                set('cost_per_item', cost)
                set('avg_price', unitCost)
              }}
              placeholder="e.g. 500.00" />
            <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>Price you pay per bottle/pack/bag</div>
          </div>
          <div style={{ fontSize:18, color:'#d1d5db', fontWeight:300, paddingTop:14 }}>÷</div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Net Volume per Item</label>
            <input style={iStyle} type="number" min="0" step="any"
              value={form.net_volume}
              onChange={e => {
                const vol = e.target.value
                const cost = parseFloat(form.cost_per_item) || 0
                const unitCost = vol && cost ? (cost / parseFloat(vol)).toFixed(4) : ''
                set('net_volume', vol)
                set('avg_price', unitCost)
              }}
              placeholder="e.g. 100" />
            <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>Total {form.unit} in that item</div>
          </div>
          <div style={{ fontSize:18, color:'#d1d5db', fontWeight:300, paddingTop:14 }}>=</div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Cost per {form.unit} (₱)</label>
            <div style={{ padding:'8px 12px', background: form.avg_price ? '#d1fae5' : '#f3f4f6', border:`1px solid ${form.avg_price ? '#a7f3d0' : '#e5e7eb'}`, borderRadius:8, fontSize:15, fontWeight:700, color: form.avg_price ? '#065f46' : '#9ca3af', minHeight:38, display:'flex', alignItems:'center' }}>
              {form.avg_price ? `₱${parseFloat(form.avg_price).toFixed(4)}` : '—'}
            </div>
            <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>Auto-calculated · used by COGS</div>
          </div>
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

      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
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
  const [recipeCounts, setRecipeCounts] = useState({}) // catalog_id → recipe count
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
    const [{ data: catalogData }, { data: recipeData }] = await Promise.all([
      sb.from('inventory_catalog').select('*').order('category').order('name'),
      sb.from('recipes').select('ingredients, packaging').eq('is_active', true),
    ])
    setItems(catalogData ?? [])

    // Count how many recipes each catalog item appears in
    const counts = {}
    for (const recipe of (recipeData || [])) {
      const allRows = [...(recipe.ingredients || []), ...(recipe.packaging || [])]
      for (const row of allRows) {
        if (row.catalog_id) {
          counts[row.catalog_id] = (counts[row.catalog_id] || 0) + 1
        }
      }
    }
    setRecipeCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  const handleAdd = async (form) => {
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('inventory_catalog').insert({
      ...form,
      avg_price: form.avg_price ? parseFloat(form.avg_price) : null,
      cost_per_item: form.cost_per_item ? parseFloat(form.cost_per_item) : null,
      net_volume: form.net_volume ? parseFloat(form.net_volume) : null,
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
      cost_per_item: form.cost_per_item ? parseFloat(form.cost_per_item) : null,
      net_volume: form.net_volume ? parseFloat(form.net_volume) : null,
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
          <div className="topbar-sub">Single source of truth for Recipes and COGS. Set unit cost here.</div>
        </div>
        <button onClick={() => { setShowAdd(true); setEditId(null) }}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          + Add Item
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ maxWidth:960 }}>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'Total items',     value: items.length,                                    color:'#111'    },
              { label:'Active',          value: items.filter(i => i.is_active).length,           color:'#16a34a' },
              { label:'Used in recipes', value: Object.keys(recipeCounts).length,                color:'#ef4576' },
              { label:'No unit cost',    value: items.filter(i => !i.avg_price).length,          color:'#d97706' },
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
                          <ItemForm initial={{ ...item, avg_price: item.avg_price?.toString() ?? '', cost_per_item: item.cost_per_item?.toString() ?? '', net_volume: item.net_volume?.toString() ?? '' }} onSave={handleEdit} onCancel={() => setEditId(null)} saving={saving} />
                        </div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom: idx < catItems.length - 1 ? '1px solid #f3f4f6' : 'none', opacity: item.is_active ? 1 : 0.5 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{item.name}</span>
                              {item.sku && <span style={{ fontSize:10, fontFamily:'monospace', color:'#9ca3af', background:'#f3f4f6', padding:'1px 6px', borderRadius:4 }}>{item.sku}</span>}
                              {!item.is_active && <span style={{ fontSize:10, fontWeight:600, color:'#9ca3af', background:'#f3f4f6', padding:'1px 8px', borderRadius:20 }}>Inactive</span>}
                              {/* Recipe usage badge */}
                              {recipeCounts[item.id] ? (
                                <span style={{ fontSize:10, fontWeight:600, padding:'1px 8px', borderRadius:20, background:'#fdf2f5', color:'#ef4576', border:'1px solid #fbcfe8' }}>
                                  📒 {recipeCounts[item.id]} recipe{recipeCounts[item.id] !== 1 ? 's' : ''}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                              <span style={{ fontSize:11, color:'#6b7280' }}>Unit: <strong>{item.unit}</strong></span>
                              {item.avg_price != null ? (
                                <span style={{ fontSize:11, color:'#065f46', fontWeight:600 }}>
                                  ₱{Number(item.avg_price).toLocaleString('en-PH', { minimumFractionDigits:4, maximumFractionDigits:4 })} / {item.unit}
                                  {item.cost_per_item && item.net_volume && (
                                    <span style={{ fontWeight:400, color:'#9ca3af', marginLeft:6 }}>
                                      (₱{Number(item.cost_per_item).toFixed(2)} ÷ {item.net_volume} {item.unit})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ fontSize:11, color:'#d97706', fontWeight:600 }}>⚠️ No unit cost</span>
                              )}
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
                            <button onClick={async () => {
                              if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
                              const sb = createClient()
                              await sb.from('inventory_catalog').delete().eq('id', item.id)
                              showToast('Item deleted')
                              load()
                            }}
                              style={{ padding:'5px 12px', fontSize:11, border:'1px solid #fca5a5', borderRadius:8, background:'white', cursor:'pointer', color:'#dc2626' }}>
                              Delete
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
      </div>
    </AuthShell>
  )
}
