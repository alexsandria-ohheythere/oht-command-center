'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']

const peso = n => '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const iStyle = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13,
  fontFamily: "'DM Sans',sans-serif", color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box',
}
const lStyle = {
  display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
  textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5,
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 18px', borderRadius: 12, background: type === 'error' ? '#dc2626' : '#111', color: 'white', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,.2)' }}>
      {msg}
    </div>
  )
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--white)', borderRadius: 18, padding: 28, width: '100%', maxWidth: wide ? 720 : 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const MENU_CATEGORIES = ['Drinks', 'Food', 'Pastry', 'Add-on', 'Other']

const blank = () => ({
  item_name: '', menu_category: 'Drinks', selling_price: '', recipe_id: '',
  labor_cost: '', packaging_cost: '', overhead_cost: '', notes: '', is_active: true,
  cost_breakdown: [],
})

function CostBreakdownRow({ row, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <input style={iStyle} placeholder="Label (e.g. Matcha powder)" value={row.label} onChange={e => onChange({ ...row, label: e.target.value })} />
      <input style={iStyle} placeholder="₱ cost" type="number" min="0" step="0.01" value={row.cost} onChange={e => onChange({ ...row, cost: e.target.value })} />
      <button onClick={onRemove} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 14, width: 28, height: 28 }}>×</button>
    </div>
  )
}

export default function CogsPage() {
  const supabase = createClient()
  const [authorized, setAuthorized] = useState(null)
  const [cogsItems, setCogsItems] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !ADMIN_EMAILS.includes(session.user.email)) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      setAuthorized(true)
      await Promise.all([loadCogs(), loadRecipes()])
      setLoading(false)
    }
    init()
  }, [])

  async function loadCogs() {
    const { data, error } = await supabase
      .from('cogs')
      .select('*, recipes(id, name, category, ingredients, steps, serving_size, prep_time)')
      .order('menu_category')
      .order('item_name')
    if (error) showToast('Failed to load COGS', 'error')
    else setCogsItems(data || [])
  }

  async function loadRecipes() {
    const { data } = await supabase.from('recipes').select('id, name, category').eq('is_active', true).order('category').order('name')
    setRecipes(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm(blank())
    setShowForm(true)
  }

  function openEdit(item) {
    setEditing(item.id)
    setForm({
      item_name: item.item_name || '',
      menu_category: item.menu_category || 'Drinks',
      selling_price: item.selling_price ?? '',
      recipe_id: item.recipe_id || '',
      labor_cost: item.labor_cost ?? '',
      packaging_cost: item.packaging_cost ?? '',
      overhead_cost: item.overhead_cost ?? '',
      notes: item.notes || '',
      is_active: item.is_active !== false,
      cost_breakdown: Array.isArray(item.cost_breakdown) ? item.cost_breakdown : [],
    })
    setShowForm(true)
  }

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function addBreakdownRow() {
    setF('cost_breakdown', [...form.cost_breakdown, { label: '', cost: '' }])
  }
  function updateBreakdownRow(i, val) {
    const arr = [...form.cost_breakdown]; arr[i] = val; setF('cost_breakdown', arr)
  }
  function removeBreakdownRow(i) {
    setF('cost_breakdown', form.cost_breakdown.filter((_, idx) => idx !== i))
  }

  function calcTotalCost(f) {
    const rows = (f.cost_breakdown || []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
    return rows + (parseFloat(f.labor_cost) || 0) + (parseFloat(f.packaging_cost) || 0) + (parseFloat(f.overhead_cost) || 0)
  }

  function calcMargin(f) {
    const sp = parseFloat(f.selling_price) || 0
    const tc = calcTotalCost(f)
    if (!sp) return null
    return ((sp - tc) / sp * 100).toFixed(1)
  }

  async function handleSave() {
    if (!form.item_name.trim()) return showToast('Item name required', 'error')
    setSaving(true)
    const payload = {
      item_name: form.item_name.trim(),
      menu_category: form.menu_category,
      selling_price: parseFloat(form.selling_price) || null,
      recipe_id: form.recipe_id || null,
      labor_cost: parseFloat(form.labor_cost) || 0,
      packaging_cost: parseFloat(form.packaging_cost) || 0,
      overhead_cost: parseFloat(form.overhead_cost) || 0,
      notes: form.notes.trim(),
      is_active: form.is_active,
      cost_breakdown: form.cost_breakdown.filter(r => r.label.trim()),
      total_cost: calcTotalCost(form),
    }
    let error
    if (editing) {
      ({ error } = await supabase.from('cogs').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('cogs').insert(payload))
    }
    setSaving(false)
    if (error) return showToast('Save failed: ' + error.message, 'error')
    showToast(editing ? 'COGS entry updated!' : 'COGS entry added!')
    setShowForm(false)
    loadCogs()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('cogs').delete().eq('id', id)
    if (error) return showToast('Delete failed', 'error')
    showToast('Entry deleted')
    setConfirmDelete(null)
    setViewItem(null)
    loadCogs()
  }

  const filtered = cogsItems.filter(item => {
    if (filterCat !== 'All' && item.menu_category !== filterCat) return false
    if (search && !`${item.item_name} ${item.menu_category}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const btnStyle = (primary) => ({
    padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
    border: primary ? 'none' : '1px solid var(--border)',
  })

  function marginColor(pct) {
    const n = parseFloat(pct)
    if (n >= 60) return '#065f46'
    if (n >= 40) return '#d97706'
    return '#dc2626'
  }
  function marginBg(pct) {
    const n = parseFloat(pct)
    if (n >= 60) return '#d1fae5'
    if (n >= 40) return '#fef3c7'
    return '#fee2e2'
  }

  if (authorized === false) {
    return (
      <AuthShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Access Restricted</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>COGS is only accessible to Alex and CJ.</div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ padding: '24px 28px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>🧮 Cost of Goods Sold</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Per-item cost tracking linked to Recipes. Visible to Alex &amp; CJ only.</div>
          </div>
          <button onClick={openNew} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>+</span> Add Item
          </button>
        </div>

        {/* Summary bar */}
        {!loading && cogsItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Items', value: cogsItems.length },
              { label: 'Avg Selling Price', value: peso(cogsItems.reduce((s, i) => s + (parseFloat(i.selling_price) || 0), 0) / (cogsItems.filter(i => i.selling_price).length || 1)) },
              { label: 'Avg Total Cost', value: peso(cogsItems.reduce((s, i) => s + (parseFloat(i.total_cost) || 0), 0) / (cogsItems.length || 1)) },
              { label: 'Avg Margin', value: (() => { const items = cogsItems.filter(i => i.selling_price && i.total_cost); if (!items.length) return '—'; const avg = items.reduce((s, i) => s + ((i.selling_price - i.total_cost) / i.selling_price * 100), 0) / items.length; return avg.toFixed(1) + '%' })() },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...iStyle, width: 220 }} placeholder="🔍  Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...iStyle, width: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All Categories</option>
            {MENU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>No items yet. Add your first menu item to track COGS!</div>
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Item', 'Category', 'Selling Price', 'Total Cost', 'Margin', 'Linked Recipe', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const margin = item.selling_price ? ((item.selling_price - (item.total_cost || 0)) / item.selling_price * 100).toFixed(1) : null
                  return (
                    <tr key={item.id} onClick={() => setViewItem(item)} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{item.item_name}</div>
                        {!item.is_active && <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>INACTIVE</span>}
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{item.menu_category}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.selling_price ? peso(item.selling_price) : '—'}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{item.total_cost ? peso(item.total_cost) : '—'}</td>
                      <td style={{ padding: '13px 14px' }}>
                        {margin !== null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>{margin}%</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {item.recipes ? <span style={{ color: '#ef4576', fontWeight: 500 }}>📒 {item.recipes.name}</span> : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(item) }} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif" }}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW MODAL */}
        <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={viewItem?.item_name || ''} wide>
          {viewItem && (() => {
            const tc = viewItem.total_cost || 0
            const sp = viewItem.selling_price || 0
            const margin = sp ? ((sp - tc) / sp * 100).toFixed(1) : null
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Menu Category', value: viewItem.menu_category },
                    { label: 'Selling Price', value: sp ? peso(sp) : '—' },
                    { label: 'Total Cost', value: tc ? peso(tc) : '—' },
                    { label: 'Gross Margin', value: margin ? margin + '%' : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Linked Recipe */}
                {viewItem.recipes && (
                  <div style={{ background: '#fff7f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#c2410c', marginBottom: 8 }}>Linked Recipe</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📒 {viewItem.recipes.name} <span style={{ fontSize: 11, fontWeight: 400, color: '#c2410c' }}>({viewItem.recipes.category})</span></div>
                    {viewItem.recipes.serving_size && <div style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>🍽 {viewItem.recipes.serving_size}</div>}
                    {Array.isArray(viewItem.recipes.ingredients) && viewItem.recipes.ingredients.length > 0 && (
                      <div style={{ fontSize: 12, color: '#92400e' }}>🧂 {viewItem.recipes.ingredients.length} ingredients: {viewItem.recipes.ingredients.slice(0, 4).map(i => i.name).join(', ')}{viewItem.recipes.ingredients.length > 4 ? '…' : ''}</div>
                    )}
                  </div>
                )}

                {/* Cost Breakdown */}
                {(Array.isArray(viewItem.cost_breakdown) && viewItem.cost_breakdown.length > 0) && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Ingredient Cost Breakdown</div>
                    <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {viewItem.cost_breakdown.map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < viewItem.cost_breakdown.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{peso(row.cost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other costs */}
                {(viewItem.labor_cost || viewItem.packaging_cost || viewItem.overhead_cost) ? (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Other Costs</div>
                    <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {[['Labor', viewItem.labor_cost], ['Packaging', viewItem.packaging_cost], ['Overhead', viewItem.overhead_cost]].filter(([, v]) => v).map(([label, val], i, arr) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                          <span style={{ fontWeight: 600 }}>{peso(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {viewItem.notes && <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>📝 {viewItem.notes}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <button onClick={() => setConfirmDelete(viewItem.id)} style={{ ...btnStyle(false), color: '#dc2626', border: '1px solid #fecaca' }}>Delete</button>
                  <button onClick={() => { openEdit(viewItem); setViewItem(null) }} style={btnStyle(false)}>Edit</button>
                  <button onClick={() => setViewItem(null)} style={btnStyle(true)}>Close</button>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* FORM MODAL */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit COGS Entry' : 'New COGS Entry'} wide>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lStyle}>Item Name *</label>
                <input style={iStyle} value={form.item_name} onChange={e => setF('item_name', e.target.value)} placeholder="e.g. Iced Matcha Latte" />
              </div>
              <div>
                <label style={lStyle}>Menu Category</label>
                <select style={iStyle} value={form.menu_category} onChange={e => setF('menu_category', e.target.value)}>
                  {MENU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lStyle}>Selling Price (₱)</label>
                <input style={iStyle} type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setF('selling_price', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={lStyle}>Linked Recipe</label>
                <select style={iStyle} value={form.recipe_id} onChange={e => setF('recipe_id', e.target.value)}>
                  <option value="">— None —</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.category})</option>)}
                </select>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...lStyle, marginBottom: 0 }}>Ingredient Cost Breakdown</label>
                <button onClick={addBreakdownRow} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add Line</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 110px 28px', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                <span>Ingredient / Label</span><span>Cost (₱)</span><span></span>
              </div>
              {form.cost_breakdown.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No breakdown rows yet.</div>}
              {form.cost_breakdown.map((row, i) => (
                <CostBreakdownRow key={i} row={row} onChange={val => updateBreakdownRow(i, val)} onRemove={() => removeBreakdownRow(i)} />
              ))}
            </div>

            {/* Other costs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={lStyle}>Labor Cost (₱)</label>
                <input style={iStyle} type="number" min="0" step="0.01" value={form.labor_cost} onChange={e => setF('labor_cost', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={lStyle}>Packaging Cost (₱)</label>
                <input style={iStyle} type="number" min="0" step="0.01" value={form.packaging_cost} onChange={e => setF('packaging_cost', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={lStyle}>Overhead Cost (₱)</label>
                <input style={iStyle} type="number" min="0" step="0.01" value={form.overhead_cost} onChange={e => setF('overhead_cost', e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Live total */}
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Total Cost</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{peso(calcTotalCost(form))}</div>
              </div>
              {form.selling_price && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Gross Margin</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: marginColor(calcMargin(form)) }}>{calcMargin(form)}%</div>
                </div>
              )}
            </div>

            <div>
              <label style={lStyle}>Notes</label>
              <textarea style={{ ...iStyle, height: 60, resize: 'vertical' }} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any pricing notes…" />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
                <span>Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <button onClick={() => setShowForm(false)} style={btnStyle(false)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnStyle(true), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </Modal>

        {/* DELETE CONFIRM */}
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete COGS Entry?">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            This will permanently delete this COGS entry. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDelete(null)} style={btnStyle(false)}>Cancel</button>
            <button onClick={() => handleDelete(confirmDelete)} style={{ ...btnStyle(true), background: '#dc2626' }}>Delete</button>
          </div>
        </Modal>

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AuthShell>
  )
}
