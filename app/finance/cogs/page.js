'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']
const peso = n => '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PALETTE = [
  { bg: '#e8f4fd', text: '#1e40af', dot: '#2563eb', border: '#bfdbfe', light: '#f0f8ff' },
  { bg: '#fef3c7', text: '#b45309', dot: '#d97706', border: '#fde68a', light: '#fffbeb' },
  { bg: '#fce7f3', text: '#9d174d', dot: '#db2777', border: '#fbcfe8', light: '#fdf4f8' },
  { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280', border: '#e5e7eb', light: '#f9fafb' },
  { bg: '#d1fae5', text: '#065f46', dot: '#10b981', border: '#a7f3d0', light: '#f0fdf4' },
  { bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed', border: '#ddd6fe', light: '#faf5ff' },
  { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626', border: '#fecaca', light: '#fff5f5' },
  { bg: '#fef9c3', text: '#854d0e', dot: '#ca8a04', border: '#fef08a', light: '#fefce8' },
]

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

function calcTotals(form) {
  const ingTotal = (form.ingredient_costs || []).reduce((s, r) => s + (parseFloat(r.cost_per_unit) || 0), 0)
  const labor = parseFloat(form.labor_cost) || 0
  const pack = parseFloat(form.packaging_cost) || 0
  const over = parseFloat(form.overhead_cost) || 0
  const total = ingTotal + labor + pack + over
  const sp = parseFloat(form.selling_price) || 0
  const margin = sp > 0 ? ((sp - total) / sp * 100) : null
  return { ingTotal, total, margin }
}

// ─── COGS Form ────────────────────────────────────────────────────────────────
function CogsForm({ recipes, item, onSave, onClose, saving }) {
  const isEdit = !!item
  const [form, setForm] = useState(() => isEdit ? {
    item_name: item.item_name || '',
    recipe_id: item.recipe_id || '',
    selling_price: item.selling_price ?? '',
    labor_cost: item.labor_cost ?? '',
    packaging_cost: item.packaging_cost ?? '',
    overhead_cost: item.overhead_cost ?? '',
    notes: item.notes || '',
    is_active: item.is_active !== false,
    ingredient_costs: item.ingredient_costs || [],
  } : {
    item_name: '', recipe_id: '', selling_price: '', labor_cost: '',
    packaging_cost: '', overhead_cost: '', notes: '', is_active: true, ingredient_costs: [],
  })

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleRecipeChange(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId)
    const merged = recipe ? mergeIngredientCosts(recipe.ingredients, form.ingredient_costs) : []
    setForm(p => ({ ...p, recipe_id: recipeId, item_name: p.item_name || recipe?.name || '', ingredient_costs: merged }))
  }

  useEffect(() => {
    if (isEdit && item.recipe_id) {
      const recipe = recipes.find(r => r.id === item.recipe_id)
      if (recipe) setF('ingredient_costs', mergeIngredientCosts(recipe.ingredients, item.ingredient_costs || []))
    }
  }, [])

  function updateIngCost(i, val) {
    setForm(p => {
      const arr = [...p.ingredient_costs]
      arr[i] = { ...arr[i], cost_per_unit: val, total_cost: parseFloat(val) || 0 }
      return { ...p, ingredient_costs: arr }
    })
  }

  const linkedRecipe = recipes.find(r => r.id === form.recipe_id)
  const { ingTotal, total, margin } = calcTotals(form)
  const sp = parseFloat(form.selling_price) || 0

  const btn = (primary) => ({
    padding: '9px 18px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
  })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={lStyle}>Menu Item Name *</label>
          <input style={iStyle} value={form.item_name} onChange={e => setF('item_name', e.target.value)} placeholder="e.g. Iced Matcha Latte" />
        </div>
        <div>
          <label style={lStyle}>Linked Recipe</label>
          <select style={iStyle} value={form.recipe_id} onChange={e => handleRecipeChange(e.target.value)}>
            <option value="">— Select a recipe —</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.category}{r.subcategory ? ` › ${r.subcategory}` : ''})</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {[['Selling Price (₱)', 'selling_price'], ['Labor Cost (₱)', 'labor_cost'], ['Packaging (₱)', 'packaging_cost'], ['Overhead (₱)', 'overhead_cost']].map(([label, key]) => (
          <div key={key}>
            <label style={lStyle}>{label}</label>
            <input style={iStyle} type="number" min="0" step="0.01" value={form[key]} onChange={e => setF(key, e.target.value)} placeholder="0.00" />
          </div>
        ))}
      </div>

      {/* Ingredient cost table */}
      {linkedRecipe && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ ...lStyle, marginBottom: 0 }}>Ingredient Costs <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— from {linkedRecipe.name}</span></label>
          </div>
          {form.ingredient_costs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No ingredients on this recipe yet.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Ingredient', 'Qty / Unit', 'Brand · Variant', 'Cost (₱)'].map(h => (
                  <div key={h} style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                ))}
              </div>
              {form.ingredient_costs.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', borderBottom: i < form.ingredient_costs.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.ingredient_name}</div>
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{row.qty} {row.unit}</div>
                  <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {row.brand && <div>{row.brand}</div>}
                    {row.variant && <div style={{ opacity: 0.7 }}>{row.variant}</div>}
                    {!row.brand && !row.variant && <span style={{ fontStyle: 'italic' }}>—</span>}
                  </div>
                  <div style={{ padding: '6px 10px' }}>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={row.cost_per_unit}
                      onChange={e => updateIngCost(i, e.target.value)}
                      style={{ ...iStyle, padding: '7px 10px', fontSize: 13, textAlign: 'right' }} />
                  </div>
                </div>
              ))}
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

      {/* Live summary */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: margin !== null ? '1px solid var(--border)' : 'none' }}>
          {[['Ingredient Cost', peso(ingTotal)], ['Other Costs', peso((parseFloat(form.labor_cost)||0)+(parseFloat(form.packaging_cost)||0)+(parseFloat(form.overhead_cost)||0))], ['Total COGS', peso(total)], ['Selling Price', sp ? peso(sp) : '—']].map(([label, value], i) => (
            <div key={label} style={{ padding: '12px 14px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
        {margin !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Margin</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", padding: '3px 10px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>{margin.toFixed(1)}%</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{margin >= 60 ? '✅ Healthy' : margin >= 40 ? '⚠️ Tight' : '❌ Below target'}</span>
          </div>
        )}
      </div>

      <div>
        <label style={lStyle}>Notes</label>
        <input style={iStyle} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any pricing notes…" />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
        <span>Active</span>
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <button onClick={onClose} style={btn(false)}>Cancel</button>
        <button onClick={() => onSave(form, total, margin)} disabled={saving} style={{ ...btn(true), opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </div>
  )
}

// ─── Gallery Card ─────────────────────────────────────────────────────────────
function CogsCard({ item, palette, onClick, onEdit }) {
  const margin = item.gross_margin
  const recipe = item.recipes
  const hasMargin = margin !== null && margin !== undefined

  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = palette.border }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>

      {/* Color top bar */}
      <div style={{ height: 4, background: palette.dot }} />

      {/* Card body */}
      <div style={{ padding: '16px 18px' }}>
        {/* Name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>{item.item_name}</div>
          {!item.is_active && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', flexShrink: 0 }}>INACTIVE</span>
          )}
        </div>

        {/* Linked recipe */}
        {recipe ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 10 }}>📒</span>
            <span style={{ fontSize: 12, color: '#ef4576', fontWeight: 500 }}>{recipe.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· {recipe.category}{recipe.subcategory ? ` › ${recipe.subcategory}` : ''}</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 14 }}>No recipe linked</div>
        )}

        {/* Cost + price + margin */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: hasMargin ? 12 : 0 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>COGS</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>
              {item.total_cost ? peso(item.total_cost) : '—'}
            </div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Price</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>
              {item.selling_price ? peso(item.selling_price) : '—'}
            </div>
          </div>
        </div>

        {/* Margin pill */}
        {hasMargin && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Margin</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>
              {parseFloat(margin).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Ingredient count */}
        {Array.isArray(item.ingredient_costs) && item.ingredient_costs.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            🧂 {item.ingredient_costs.filter(r => r.cost_per_unit).length} / {item.ingredient_costs.length} ingredients costed
          </div>
        )}
      </div>

      {/* Edit footer */}
      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: palette.light, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 7, border: `1px solid ${palette.border}`, background: 'transparent', color: palette.text, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          Edit
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
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [search, setSearch] = useState('')
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
      await Promise.allSettled([loadCogs(), loadRecipes(), loadCategories()])
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

  async function loadCategories() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'recipe_categories').single()
    if (data?.value) {
      try { setCategories(JSON.parse(data.value)) } catch {}
    }
  }

  function getPalette(catName) {
    const found = categories.find(c => c.name === catName)
    return found ? PALETTE[found.colorIdx % PALETTE.length] : PALETTE[3]
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
      notes: form.notes?.trim() || '',
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
    setShowForm(false); setEditItem(null)
    loadCogs()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('cogs').delete().eq('id', id)
    if (error) return showToast('Delete failed', 'error')
    showToast('Deleted')
    setConfirmDelete(null); setViewItem(null)
    loadCogs()
  }

  const filtered = cogsItems.filter(item =>
    !search || item.item_name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by recipe category, preserving settings order
  const catOrder = categories.length > 0
    ? categories.map(c => c.name)
    : [...new Set(filtered.map(i => i.recipes?.category).filter(Boolean))]

  const grouped = []
  const seen = new Set()
  for (const cat of catOrder) {
    const items = filtered.filter(i => i.recipes?.category === cat)
    if (items.length > 0) { grouped.push({ cat, items }); seen.add(cat) }
  }
  // Uncategorized (no recipe, or category not in settings)
  const uncat = filtered.filter(i => !seen.has(i.recipes?.category))
  if (uncat.length > 0) grouped.push({ cat: 'Uncategorized', items: uncat })

  const totalItems = cogsItems.length
  const avgMargin = cogsItems.filter(i => i.gross_margin !== null).length > 0
    ? cogsItems.filter(i => i.gross_margin !== null).reduce((s, i) => s + i.gross_margin, 0) / cogsItems.filter(i => i.gross_margin !== null).length
    : null

  const btnStyle = (primary) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
  })

  if (authorized === false) {
    return (
      <AuthShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 700 }}>Access Restricted</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>COGS is only accessible to Alex and CJ.</div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ padding: '24px 28px', fontFamily: "'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>🧮 Cost of Goods Sold</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Per-item cost tracking synced to Recipes. Alex &amp; CJ only.</div>
          </div>
          <button onClick={() => { setEditItem(null); setShowForm(true) }} style={btnStyle(true)}>
            <span style={{ fontSize: 16 }}>+</span> Add Item
          </button>
        </div>

        {/* Summary strip */}
        {!loading && totalItems > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Total Items', value: totalItems },
              { label: 'With Recipe', value: `${cogsItems.filter(i => i.recipe_id).length} / ${totalItems}` },
              { label: 'Avg Margin', value: avgMargin !== null ? avgMargin.toFixed(1) + '%' : '—' },
              { label: 'Avg COGS', value: totalItems > 0 ? peso(cogsItems.reduce((s, i) => s + (i.total_cost || 0), 0) / totalItems) : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center' }}>
          <input style={{ ...iStyle, width: 240 }} placeholder="🔍  Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Gallery by category */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>
            {cogsItems.length === 0 ? 'No items yet. Click + Add Item to get started.' : 'No items match your search.'}
          </div>
        ) : (
          grouped.map(({ cat, items }) => {
            const p = getPalette(cat)
            return (
              <div key={cat} style={{ marginBottom: 36 }}>
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{cat}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  {/* Category avg margin */}
                  {(() => {
                    const withMargin = items.filter(i => i.gross_margin !== null)
                    if (!withMargin.length) return null
                    const avg = withMargin.reduce((s, i) => s + i.gross_margin, 0) / withMargin.length
                    return (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: marginBg(avg), color: marginColor(avg) }}>
                        avg {avg.toFixed(1)}%
                      </span>
                    )
                  })()}
                </div>

                {/* Cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {items.map(item => (
                    <CogsCard
                      key={item.id}
                      item={item}
                      palette={p}
                      onClick={() => setViewItem(item)}
                      onEdit={() => { setEditItem(item); setShowForm(true) }}
                    />
                  ))}
                  {/* Ghost add card */}
                  <div
                    onClick={() => { setEditItem(null); setShowForm(true) }}
                    style={{ border: '1px dashed var(--border)', borderRadius: 16, minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', transition: 'background .15s, color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = p.bg; e.currentTarget.style.color = p.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                    <span>Add item</span>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* FORM MODAL */}
        <Modal open={showForm} onClose={() => { setShowForm(false); setEditItem(null) }} title={editItem ? 'Edit COGS Entry' : 'New COGS Entry'} wide>
          <CogsForm key={editItem?.id || 'new'} recipes={recipes} item={editItem} onSave={handleSave} onClose={() => { setShowForm(false); setEditItem(null) }} saving={saving} />
        </Modal>

        {/* VIEW MODAL */}
        <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={viewItem?.item_name || ''} wide>
          {viewItem && (() => {
            const p = getPalette(viewItem.recipes?.category)
            return (
              <div>
                <div style={{ height: 4, background: p.dot, borderRadius: 4, marginBottom: 20 }} />
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Selling Price', value: viewItem.selling_price ? peso(viewItem.selling_price) : '—' },
                    { label: 'Total COGS', value: viewItem.total_cost ? peso(viewItem.total_cost) : '—' },
                    { label: 'Gross Margin', value: viewItem.gross_margin !== null && viewItem.gross_margin !== undefined ? parseFloat(viewItem.gross_margin).toFixed(1) + '%' : '—' },
                    { label: 'Labor', value: viewItem.labor_cost ? peso(viewItem.labor_cost) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Linked recipe */}
                {viewItem.recipes && (
                  <div style={{ background: p.light, border: `1px solid ${p.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: p.text, marginBottom: 6 }}>Linked Recipe</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>📒 {viewItem.recipes.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{viewItem.recipes.category}{viewItem.recipes.subcategory ? ` › ${viewItem.recipes.subcategory}` : ''}</div>
                  </div>
                )}

                {/* Ingredient cost breakdown */}
                {Array.isArray(viewItem.ingredient_costs) && viewItem.ingredient_costs.filter(r => r.cost_per_unit).length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Ingredient Cost Breakdown</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      {viewItem.ingredient_costs.filter(r => r.cost_per_unit).map((row, i, arr) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
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
