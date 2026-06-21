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
      <div style={{ background: 'var(--white)', borderRadius: 18, padding: 28, width: '100%', maxWidth: wide ? 780 : 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Margin color helpers
function marginColor(pct) {
  const n = parseFloat(pct)
  if (isNaN(n)) return 'var(--text-muted)'
  if (n >= 60) return '#065f46'
  if (n >= 40) return '#d97706'
  return '#dc2626'
}
function marginBg(pct) {
  const n = parseFloat(pct)
  if (isNaN(n)) return 'var(--surface)'
  if (n >= 60) return '#d1fae5'
  if (n >= 40) return '#fef3c7'
  return '#fee2e2'
}

// Build ingredient cost rows from a recipe's ingredients list
function buildIngredientCosts(ingredients) {
  return (ingredients || []).map(ing => ({
    ingredient_name: ing.name || '',
    brand: ing.brand || '',
    variant: ing.variant || '',
    qty: ing.qty || '',
    unit: ing.unit || '',
    cost_per_unit: '',   // to be filled by user
    total_cost: 0,
  }))
}

// Merge saved ingredient_costs with fresh recipe ingredients
// Keeps user-entered costs, adds new ingredients, removes deleted ones
function mergeIngredientCosts(recipeIngredients, savedCosts) {
  return (recipeIngredients || []).map(ing => {
    const existing = (savedCosts || []).find(c => c.ingredient_name === ing.name)
    return {
      ingredient_name: ing.name || '',
      brand: ing.brand || '',
      variant: ing.variant || '',
      qty: ing.qty || '',
      unit: ing.unit || '',
      cost_per_unit: existing ? existing.cost_per_unit : '',
      total_cost: existing ? existing.total_cost : 0,
    }
  })
}

function calcIngTotal(rows) {
  return rows.reduce((sum, r) => sum + (parseFloat(r.cost_per_unit) || 0), 0)
}

// ─── COGS Form ────────────────────────────────────────────────────────────────
function CogsForm({ recipes, item, onSave, onClose, saving }) {
  const isEdit = !!item

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        item_name: item.item_name || '',
        recipe_id: item.recipe_id || '',
        selling_price: item.selling_price ?? '',
        labor_cost: item.labor_cost ?? '',
        packaging_cost: item.packaging_cost ?? '',
        overhead_cost: item.overhead_cost ?? '',
        notes: item.notes || '',
        is_active: item.is_active !== false,
        ingredient_costs: item.ingredient_costs || [],
      }
    }
    return {
      item_name: '',
      recipe_id: '',
      selling_price: '',
      labor_cost: '',
      packaging_cost: '',
      overhead_cost: '',
      notes: '',
      is_active: true,
      ingredient_costs: [],
    }
  })

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // When recipe changes, merge ingredient costs
  function handleRecipeChange(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId)
    const merged = recipe
      ? mergeIngredientCosts(recipe.ingredients, form.ingredient_costs)
      : []
    setForm(p => ({
      ...p,
      recipe_id: recipeId,
      item_name: p.item_name || recipe?.name || '',
      ingredient_costs: merged,
    }))
  }

  // On mount, if editing and recipe_id set, sync ingredient costs with recipe
  useEffect(() => {
    if (isEdit && item.recipe_id) {
      const recipe = recipes.find(r => r.id === item.recipe_id)
      if (recipe) {
        setF('ingredient_costs', mergeIngredientCosts(recipe.ingredients, item.ingredient_costs || []))
      }
    }
  }, [])

  function updateIngCost(i, field, val) {
    setForm(p => {
      const arr = [...p.ingredient_costs]
      arr[i] = { ...arr[i], [field]: val, total_cost: parseFloat(val) || 0 }
      return { ...p, ingredient_costs: arr }
    })
  }

  const linkedRecipe = recipes.find(r => r.id === form.recipe_id)
  const ingTotal = calcIngTotal(form.ingredient_costs)
  const laborCost = parseFloat(form.labor_cost) || 0
  const packCost = parseFloat(form.packaging_cost) || 0
  const overCost = parseFloat(form.overhead_cost) || 0
  const totalCost = ingTotal + laborCost + packCost + overCost
  const sellingPrice = parseFloat(form.selling_price) || 0
  const margin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice * 100) : null

  const btnStyle = (primary) => ({
    padding: '9px 18px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)',
    color: primary ? 'white' : 'var(--text-primary)',
  })

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Item name + recipe */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={lStyle}>Menu Item Name *</label>
          <input style={iStyle} value={form.item_name} onChange={e => setF('item_name', e.target.value)} placeholder="e.g. Iced Matcha Latte" />
        </div>
        <div>
          <label style={lStyle}>Linked Recipe</label>
          <select style={iStyle} value={form.recipe_id} onChange={e => handleRecipeChange(e.target.value)}>
            <option value="">— Select a recipe —</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.category}{r.subcategory ? ` › ${r.subcategory}` : ''})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selling price */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div>
          <label style={lStyle}>Selling Price (₱)</label>
          <input style={iStyle} type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setF('selling_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label style={lStyle}>Labor Cost (₱)</label>
          <input style={iStyle} type="number" min="0" step="0.01" value={form.labor_cost} onChange={e => setF('labor_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label style={lStyle}>Packaging Cost (₱)</label>
          <input style={iStyle} type="number" min="0" step="0.01" value={form.packaging_cost} onChange={e => setF('packaging_cost', e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
        <div>
          <label style={lStyle}>Overhead Cost (₱)</label>
          <input style={iStyle} type="number" min="0" step="0.01" value={form.overhead_cost} onChange={e => setF('overhead_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label style={lStyle}>Notes</label>
          <input style={iStyle} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any pricing notes…" />
        </div>
      </div>

      {/* Ingredient cost table — synced from recipe */}
      {linkedRecipe && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ ...lStyle, marginBottom: 0 }}>Ingredient Costs <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--text-muted)' }}>— synced from {linkedRecipe.name}</span></label>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter cost per ingredient</span>
          </div>

          {form.ingredient_costs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>This recipe has no ingredients defined yet. Add them in the Recipes module first.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', gap: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Ingredient', 'Qty / Unit', 'Brand · Variant', 'Cost (₱)'].map(h => (
                  <div key={h} style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {form.ingredient_costs.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', gap: 0, borderBottom: i < form.ingredient_costs.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.ingredient_name}</div>
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{row.qty} {row.unit}</div>
                  <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {row.brand && <div>{row.brand}</div>}
                    {row.variant && <div style={{ opacity: 0.7 }}>{row.variant}</div>}
                    {!row.brand && !row.variant && <span style={{ fontStyle: 'italic' }}>—</span>}
                  </div>
                  <div style={{ padding: '6px 10px' }}>
                    <input
                      type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={row.cost_per_unit}
                      onChange={e => updateIngCost(i, 'cost_per_unit', e.target.value)}
                      style={{ ...iStyle, padding: '7px 10px', fontSize: 13, textAlign: 'right' }}
                    />
                  </div>
                </div>
              ))}
              {/* Ingredient subtotal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Ingredient Subtotal</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{peso(ingTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!linkedRecipe && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
          Select a recipe above to pull in its ingredients for cost entry.
        </div>
      )}

      {/* Live cost summary */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {[
            { label: 'Ingredient Cost', value: peso(ingTotal) },
            { label: 'Labor + Pack + OH', value: peso(laborCost + packCost + overCost) },
            { label: 'Total COGS', value: peso(totalCost) },
            { label: 'Selling Price', value: sellingPrice ? peso(sellingPrice) : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '12px 14px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
        {margin !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Margin</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", padding: '3px 10px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>
              {margin.toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {margin >= 60 ? '✅ Healthy margin' : margin >= 40 ? '⚠️ Tight margin' : '❌ Below target'}
            </span>
          </div>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
        <span>Active</span>
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <button onClick={onClose} style={btnStyle(false)}>Cancel</button>
        <button onClick={() => onSave(form, totalCost, margin)} disabled={saving} style={{ ...btnStyle(true), opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !ADMIN_EMAILS.includes(session.user.email)) {
        setAuthorized(false); setLoading(false); return
      }
      setAuthorized(true)
      await Promise.allSettled([loadCogs(), loadRecipes()])
      setLoading(false)
    }
    init()
  }, [])

  async function loadCogs() {
    const { data } = await supabase
      .from('cogs')
      .select('*, recipes(id, name, category, subcategory, ingredients)')
      .order('item_name')
    setCogsItems(data || [])
  }

  async function loadRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('id, name, category, subcategory, ingredients')
      .eq('is_active', true)
      .order('category').order('name')
    setRecipes(data || [])
  }

  async function handleSave(form, totalCost, margin) {
    if (!form.item_name.trim()) return showToast('Item name required', 'error')
    setSaving(true)
    const payload = {
      item_name: form.item_name.trim(),
      recipe_id: form.recipe_id || null,
      selling_price: parseFloat(form.selling_price) || null,
      labor_cost: parseFloat(form.labor_cost) || 0,
      packaging_cost: parseFloat(form.packaging_cost) || 0,
      overhead_cost: parseFloat(form.overhead_cost) || 0,
      total_cost: totalCost,
      gross_margin: margin !== null ? parseFloat(margin.toFixed(2)) : null,
      ingredient_costs: form.ingredient_costs,
      notes: form.notes.trim(),
      is_active: form.is_active,
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('cogs').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('cogs').insert(payload))
    }
    setSaving(false)
    if (error) return showToast('Save failed: ' + error.message, 'error')
    showToast(editItem ? 'Updated!' : 'Added!')
    setShowForm(false)
    setEditItem(null)
    loadCogs()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('cogs').delete().eq('id', id)
    if (error) return showToast('Delete failed', 'error')
    showToast('Deleted')
    setConfirmDelete(null)
    setViewItem(null)
    loadCogs()
  }

  // Get unique recipe categories for filter
  const recipeCats = [...new Set(recipes.map(r => r.category).filter(Boolean))]

  const filtered = cogsItems.filter(item => {
    const recipe = recipes.find(r => r.id === item.recipe_id)
    if (filterCat !== 'All' && recipe?.category !== filterCat) return false
    if (search && !`${item.item_name}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const btnStyle = (primary) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
  })

  if (authorized === false) {
    return (
      <AuthShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 700 }}>Access Restricted</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>COGS is only accessible to Alex and CJ.</div>
        </div>
      </AuthShell>
    )
  }

  // Summary stats
  const activeItems = cogsItems.filter(i => i.is_active)
  const avgMargin = activeItems.filter(i => i.gross_margin !== null).length > 0
    ? activeItems.filter(i => i.gross_margin !== null).reduce((s, i) => s + i.gross_margin, 0) / activeItems.filter(i => i.gross_margin !== null).length
    : null
  const avgCost = activeItems.length > 0
    ? activeItems.reduce((s, i) => s + (i.total_cost || 0), 0) / activeItems.length
    : null

  return (
    <AuthShell>
      <div style={{ padding: '24px 28px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>🧮 Cost of Goods Sold</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Per-item cost tracking synced to Recipes. Visible to Alex &amp; CJ only.</div>
          </div>
          <button onClick={() => { setEditItem(null); setShowForm(true) }} style={btnStyle(true)}>
            <span style={{ fontSize: 16 }}>+</span> Add Item
          </button>
        </div>

        {/* Summary cards */}
        {!loading && cogsItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Menu Items', value: cogsItems.length },
              { label: 'Avg COGS', value: avgCost !== null ? peso(avgCost) : '—' },
              { label: 'Avg Margin', value: avgMargin !== null ? avgMargin.toFixed(1) + '%' : '—' },
              { label: 'With Recipe', value: cogsItems.filter(i => i.recipe_id).length + ' / ' + cogsItems.length },
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
            <option value="All">All Recipe Categories</option>
            {recipeCats.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
            {cogsItems.length === 0 ? 'No items yet. Click + Add Item to get started.' : 'No items match your filters.'}
          </div>
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Item', 'Linked Recipe', 'COGS', 'Selling Price', 'Margin', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const margin = item.gross_margin
                  const recipe = item.recipes
                  return (
                    <tr key={item.id}
                      onClick={() => setViewItem(item)}
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{item.item_name}</div>
                        {!item.is_active && <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>INACTIVE</span>}
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        {recipe ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#ef4576' }}>📒 {recipe.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{recipe.category}{recipe.subcategory ? ` › ${recipe.subcategory}` : ''}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{item.total_cost ? peso(item.total_cost) : '—'}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.selling_price ? peso(item.selling_price) : '—'}</td>
                      <td style={{ padding: '13px 14px' }}>
                        {margin !== null && margin !== undefined ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>{parseFloat(margin).toFixed(1)}%</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <button onClick={e => { e.stopPropagation(); setEditItem(item); setShowForm(true) }}
                          style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif" }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FORM MODAL */}
        <Modal open={showForm} onClose={() => { setShowForm(false); setEditItem(null) }} title={editItem ? 'Edit COGS Entry' : 'New COGS Entry'} wide>
          <CogsForm
            key={editItem?.id || 'new'}
            recipes={recipes}
            item={editItem}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditItem(null) }}
            saving={saving}
          />
        </Modal>

        {/* VIEW MODAL */}
        <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={viewItem?.item_name || ''} wide>
          {viewItem && (() => {
            const margin = viewItem.gross_margin
            const recipe = viewItem.recipes
            return (
              <div>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Selling Price', value: viewItem.selling_price ? peso(viewItem.selling_price) : '—' },
                    { label: 'Total COGS', value: viewItem.total_cost ? peso(viewItem.total_cost) : '—' },
                    { label: 'Gross Margin', value: margin !== null && margin !== undefined ? parseFloat(margin).toFixed(1) + '%' : '—' },
                    { label: 'Labor', value: viewItem.labor_cost ? peso(viewItem.labor_cost) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Linked Recipe */}
                {recipe && (
                  <div style={{ background: '#fff7f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#c2410c', marginBottom: 6 }}>Linked Recipe</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>📒 {recipe.name}</div>
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>{recipe.category}{recipe.subcategory ? ` › ${recipe.subcategory}` : ''}</div>
                  </div>
                )}

                {/* Ingredient cost breakdown */}
                {Array.isArray(viewItem.ingredient_costs) && viewItem.ingredient_costs.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Ingredient Cost Breakdown</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      {viewItem.ingredient_costs.filter(r => r.cost_per_unit).map((row, i, arr) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ padding: '9px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{row.ingredient_name}</div>
                          <div style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{row.qty} {row.unit}</div>
                          <div style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {row.brand && <div>{row.brand}</div>}
                            {row.variant && <div style={{ opacity: 0.7 }}>{row.variant}</div>}
                          </div>
                          <div style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{peso(row.cost_per_unit)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewItem.notes && <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>📝 {viewItem.notes}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <button onClick={() => setConfirmDelete(viewItem.id)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #fecaca', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--surface)', color: '#dc2626', fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
                  <button onClick={() => { setEditItem(viewItem); setViewItem(null); setShowForm(true) }} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif" }}>Edit</button>
                  <button onClick={() => setViewItem(null)} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#ef4576', color: 'white', fontFamily: "'DM Sans',sans-serif" }}>Close</button>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* DELETE CONFIRM */}
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete COGS Entry?">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>This will permanently delete this entry. This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#dc2626', color: 'white', fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
          </div>
        </Modal>

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AuthShell>
  )
}
