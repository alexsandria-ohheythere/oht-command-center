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

// Merge saved ingredient costs with fresh recipe ingredients
function syncIngredientCosts(recipeIngredients, savedCosts) {
  return (recipeIngredients || []).map(ing => {
    const existing = (savedCosts || []).find(c => c.ingredient_name === ing.name)
    return {
      ingredient_name: ing.name || '',
      brand: ing.brand || '',
      variant: ing.variant || '',
      qty: ing.qty || '',
      unit: ing.unit || '',
      cost_per_unit: existing ? existing.cost_per_unit : '',
    }
  })
}

function syncPackagingCosts(recipePackaging, savedCosts) {
  return (recipePackaging || []).map(pkg => {
    const existing = (savedCosts || []).find(c => c.item_name === pkg.name)
    return {
      item_name: pkg.name || '',
      brand: pkg.brand || '',
      variant: pkg.variant || '',
      qty: pkg.qty || '',
      unit: pkg.unit || '',
      cost_per_unit: existing ? existing.cost_per_unit : '',
    }
  })
}

function calcTotals(ingredientCosts, packagingCosts, laborCost, overCost, sellingPrice) {
  const ingTotal = (ingredientCosts || []).reduce((s, r) => s + (parseFloat(r.cost_per_unit) || 0), 0)
  const pkgTotal = (packagingCosts || []).reduce((s, r) => s + (parseFloat(r.cost_per_unit) || 0), 0)
  const other = (parseFloat(laborCost) || 0) + (parseFloat(overCost) || 0)
  const total = ingTotal + pkgTotal + other
  const sp = parseFloat(sellingPrice) || 0
  const margin = sp > 0 ? ((sp - total) / sp * 100) : null
  return { ingTotal, pkgTotal, other, total, margin }
}

// ─── Cost Editor Modal ────────────────────────────────────────────────────────
function CostEditor({ entry, onSave, onClose, saving }) {
  const [ingCosts, setIngCosts] = useState((entry.ingredient_costs || []).map(r => ({ ...r })))
  const [pkgCosts, setPkgCosts] = useState((entry.packaging_costs || []).map(r => ({ ...r })))
  const [sellingPrice, setSellingPrice] = useState(entry.selling_price ?? '')
  const [laborCost, setLaborCost] = useState(entry.labor_cost ?? '')
  const [overCost, setOverCost] = useState(entry.overhead_cost ?? '')
  const [notes, setNotes] = useState(entry.notes || '')

  function updateIngCost(i, val) {
    setIngCosts(prev => prev.map((r, idx) => idx === i ? { ...r, cost_per_unit: val } : r))
  }
  function updatePkgCost(i, val) {
    setPkgCosts(prev => prev.map((r, idx) => idx === i ? { ...r, cost_per_unit: val } : r))
  }

  const { ingTotal, pkgTotal, other, total, margin } = calcTotals(ingCosts, pkgCosts, laborCost, overCost, sellingPrice)

  const btn = (primary) => ({
    padding: '9px 18px', borderRadius: 9,
    border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)',
    color: primary ? 'white' : 'var(--text-primary)',
  })

  // Reusable cost table renderer
  function CostTable({ rows, onUpdate, emptyMsg }) {
    if (rows.length === 0) return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>{emptyMsg}</div>
    )
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 1fr 110px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {['Item', 'Qty', 'Brand · Variant', 'Cost (₱)'].map(h => (
            <div key={h} style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
          ))}
        </div>
        {rows.map((row, i) => {
          const name = row.ingredient_name || row.item_name || ''
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 1fr 110px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', background: row.cost_per_unit ? 'transparent' : '#fffaf8' }}>
              <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{row.qty} {row.unit}</div>
              <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {row.brand && <div style={{ fontWeight: 500 }}>{row.brand}</div>}
                {row.variant && <div style={{ opacity: 0.75 }}>{row.variant}</div>}
                {!row.brand && !row.variant && <span style={{ fontStyle: 'italic' }}>—</span>}
              </div>
              <div style={{ padding: '6px 10px' }}>
                <input type="number" min="0" step="0.01" placeholder="0.00"
                  value={row.cost_per_unit}
                  onChange={e => onUpdate(i, e.target.value)}
                  style={{ ...iStyle, padding: '7px 10px', fontSize: 13, textAlign: 'right',
                    background: row.cost_per_unit ? '#f0fdf4' : 'var(--surface)',
                    borderColor: row.cost_per_unit ? '#a7f3d0' : 'var(--border)',
                  }}
                />
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Subtotal</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {peso(rows.reduce((s, r) => s + (parseFloat(r.cost_per_unit) || 0), 0))}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Recipe info banner */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Recipe</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>📒 {entry.recipe_name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.category}{entry.subcategory ? ` › ${entry.subcategory}` : ''}</div>
        {entry.assigned_roles && entry.assigned_roles.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', alignSelf: 'center' }}>Assigned:</span>
            {entry.assigned_roles.map(role => (
              <span key={role} style={{ fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 20, background: '#fdf2f5', color: '#ef4576', border: '1px solid #fbcfe8' }}>{role}</span>
            ))}
          </div>
        )}
      </div>

      {/* Selling price + overhead + labor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          ['Selling Price (₱)', sellingPrice, setSellingPrice],
          ['Labor Cost (₱)', laborCost, setLaborCost],
          ['Overhead (₱)', overCost, setOverCost],
        ].map(([label, val, setter]) => (
          <div key={label}>
            <label style={lStyle}>{label}</label>
            <input style={iStyle} type="number" min="0" step="0.01" value={val} onChange={e => setter(e.target.value)} placeholder="0.00" />
          </div>
        ))}
      </div>

      {/* Ingredients */}
      <div>
        <label style={{ ...lStyle, marginBottom: 10 }}>Ingredients</label>
        <CostTable rows={ingCosts} onUpdate={updateIngCost} emptyMsg="No ingredients on this recipe. Add them in Recipes first." />
      </div>

      {/* Packaging */}
      <div>
        <label style={{ ...lStyle, marginBottom: 10 }}>Packaging</label>
        <CostTable rows={pkgCosts} onUpdate={updatePkgCost} emptyMsg="No packaging on this recipe. Add items like cups, lids, straws in Recipes first." />
      </div>

      {/* Live summary */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: margin !== null ? '1px solid var(--border)' : 'none' }}>
          {[
            ['Ingredients', peso(ingTotal)],
            ['Packaging', peso(pkgTotal)],
            ['Total COGS', peso(total)],
            ['Selling Price', parseFloat(sellingPrice) > 0 ? peso(sellingPrice) : '—'],
          ].map(([label, value], i) => (
            <div key={label} style={{ padding: '12px 14px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
        {margin !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Margin</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", padding: '3px 12px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>
              {margin.toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {margin >= 60 ? '✅ Healthy' : margin >= 40 ? '⚠️ Tight margin' : '❌ Below target'}
            </span>
          </div>
        )}
      </div>

      <div>
        <label style={lStyle}>Notes</label>
        <input style={iStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any pricing notes…" />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <button onClick={onClose} style={btn(false)}>Cancel</button>
        <button onClick={() => onSave({ ingCosts, pkgCosts, sellingPrice, laborCost, overCost, notes, total, margin })}
          disabled={saving} style={{ ...btn(true), opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Costs'}
        </button>
      </div>
    </div>
  )
}

// ─── Gallery Card ─────────────────────────────────────────────────────────────
function RecipeCogsCard({ entry, palette, onClick }) {
  const ingCosted = (entry.ingredient_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
  const pkgCosted = (entry.packaging_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
  const costed = ingCosted + pkgCosted
  const total_ing = (entry.ingredient_costs || []).length + (entry.packaging_costs || []).length
  const allCosted = total_ing > 0 && costed === total_ing
  const noneCosted = costed === 0
  const margin = entry.gross_margin
  const hasPrice = !!entry.selling_price

  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--white)', border: `1px solid ${noneCosted ? 'var(--border)' : palette.border}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.1)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>

      {/* Color top bar — full if all costed, dashed-look if incomplete */}
      <div style={{ height: 4, background: allCosted ? palette.dot : noneCosted ? 'var(--border)' : `linear-gradient(to right, ${palette.dot} ${(costed/total_ing*100).toFixed(0)}%, var(--border) 0%)` }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Status chip + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>{entry.recipe_name}</div>
          {allCosted ? (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46', flexShrink: 0 }}>✓ COSTED</span>
          ) : noneCosted ? (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', flexShrink: 0 }}>PENDING</span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#b45309', flexShrink: 0 }}>PARTIAL</span>
          )}
        </div>

        {/* Subcategory */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
          {entry.subcategory || entry.category}
        </div>

        {/* Cost + price tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>COGS</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: noneCosted ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>
              {entry.total_cost ? peso(entry.total_cost) : '—'}
            </div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Price</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: hasPrice ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: "'Montserrat',sans-serif" }}>
              {entry.selling_price ? peso(entry.selling_price) : '—'}
            </div>
          </div>
        </div>

        {/* Margin */}
        {margin !== null && margin !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Margin</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: marginBg(margin), color: marginColor(margin) }}>
              {parseFloat(margin).toFixed(1)}%
            </span>
          </div>
        ) : null}

        {/* Ingredient progress bar */}
        {total_ing > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ingredients costed</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: allCosted ? '#065f46' : 'var(--text-muted)' }}>{costed}/{total_ing}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(costed / total_ing * 100).toFixed(0)}%`, background: allCosted ? '#10b981' : palette.dot, borderRadius: 4, transition: 'width .3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: noneCosted ? 'var(--surface)' : palette.light, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {noneCosted ? 'Click to enter costs' : allCosted ? 'Click to update' : 'Click to complete'}
        </span>
        <span style={{ fontSize: 13, color: palette.text, fontWeight: 700 }}>✏️ Edit costs</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CogsPage() {
  const supabase = createClient()
  const [authorized, setAuthorized] = useState(null)
  const [entries, setEntries] = useState([])   // merged recipe + cogs data
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all | pending | costed

  const [editEntry, setEditEntry] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !ADMIN_EMAILS.includes(session.user.email)) {
        setAuthorized(false); setLoading(false); return
      }
      setAuthorized(true)
      await loadAll()
      setLoading(false)
    }
    init()
  }, [])

  async function loadAll() {
    // Load categories (for color palette)
    const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'recipe_categories').single()
    let cats = []
    if (settingsData?.value) { try { cats = JSON.parse(settingsData.value) } catch {} }
    setCategories(cats)

    // Load all active recipes
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, category, subcategory, ingredients, packaging, assigned_roles, is_active')
      .eq('is_active', true)
      .order('category').order('subcategory').order('name')

    // Load all cogs entries (keyed by recipe_id)
    const { data: cogsRows } = await supabase
      .from('cogs')
      .select('*')

    const cogsMap = {}
    for (const row of (cogsRows || [])) {
      if (row.recipe_id) cogsMap[row.recipe_id] = row
    }

    // Merge: every recipe gets an entry, syncing ingredients
    const merged = (recipes || []).map(recipe => {
      const cogs = cogsMap[recipe.id] || {}
      const ingredient_costs = syncIngredientCosts(recipe.ingredients, cogs.ingredient_costs)
      const packaging_costs = syncPackagingCosts(recipe.packaging, cogs.packaging_costs)
      return {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        category: recipe.category,
        subcategory: recipe.subcategory,
        assigned_roles: recipe.assigned_roles || [],
        cogs_id: cogs.id || null,
        selling_price: cogs.selling_price ?? '',
        labor_cost: cogs.labor_cost ?? '',
        overhead_cost: cogs.overhead_cost ?? '',
        total_cost: cogs.total_cost || null,
        gross_margin: cogs.gross_margin ?? null,
        notes: cogs.notes || '',
        ingredient_costs,
        packaging_costs,
      }
    })

    setEntries(merged)
  }

  async function syncNewRecipes() {
    setSyncing(true)
    await loadAll()
    setSyncing(false)
    showToast('Synced with latest recipes!')
  }

  function getPalette(catName) {
    const found = categories.find(c => c.name === catName)
    return found ? PALETTE[found.colorIdx % PALETTE.length] : PALETTE[3]
  }

  async function handleSave({ ingCosts, pkgCosts, sellingPrice, laborCost, overCost, notes, total, margin }) {
    if (!editEntry) return
    setSaving(true)
    const payload = {
      recipe_id: editEntry.recipe_id,
      item_name: editEntry.recipe_name,
      selling_price: parseFloat(sellingPrice) || null,
      labor_cost: parseFloat(laborCost) || 0,
      overhead_cost: parseFloat(overCost) || 0,
      total_cost: total,
      gross_margin: margin !== null ? parseFloat(margin.toFixed(2)) : null,
      ingredient_costs: ingCosts,
      packaging_costs: pkgCosts,
      notes: notes?.trim() || '',
      is_active: true,
    }

    let error
    if (editEntry.cogs_id) {
      ({ error } = await supabase.from('cogs').update(payload).eq('id', editEntry.cogs_id))
    } else {
      ({ error } = await supabase.from('cogs').insert(payload))
    }

    setSaving(false)
    if (error) return showToast('Save failed: ' + error.message, 'error')
    showToast('Costs saved!')
    setEditEntry(null)
    await loadAll()
  }

  const filtered = entries.filter(e => {
    if (search && !e.recipe_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus === 'pending') {
      const ingC = (e.ingredient_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
      const pkgC = (e.packaging_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
      if (ingC + pkgC > 0) return false
    }
    if (filterStatus === 'costed') {
      const ingC = (e.ingredient_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
      const pkgC = (e.packaging_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
      const ingT = (e.ingredient_costs || []).length
      const pkgT = (e.packaging_costs || []).length
      if ((ingT + pkgT) === 0 || (ingC + pkgC) < (ingT + pkgT)) return false
    }
    return true
  })

  // Group by category order from settings
  const catOrder = categories.length > 0
    ? categories.map(c => c.name)
    : [...new Set(filtered.map(e => e.category).filter(Boolean))]

  const grouped = []
  const seen = new Set()
  for (const cat of catOrder) {
    const items = filtered.filter(e => e.category === cat)
    if (items.length > 0) { grouped.push({ cat, items }); seen.add(cat) }
  }
  const uncat = filtered.filter(e => !seen.has(e.category))
  if (uncat.length > 0) grouped.push({ cat: 'Other', items: uncat })

  // Summary stats
  const totalCosted = entries.filter(e => {
    const ingC = (e.ingredient_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
    const pkgC = (e.packaging_costs || []).filter(r => r.cost_per_unit && parseFloat(r.cost_per_unit) > 0).length
    const ingT = (e.ingredient_costs || []).length
    const pkgT = (e.packaging_costs || []).length
    return (ingT + pkgT) > 0 && (ingC + pkgC) === (ingT + pkgT)
  }).length
  const withMargin = entries.filter(e => e.gross_margin !== null)
  const avgMargin = withMargin.length > 0
    ? withMargin.reduce((s, e) => s + e.gross_margin, 0) / withMargin.length
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>All active recipes appear here automatically. Click any card to enter costs.</div>
          </div>
          <button onClick={syncNewRecipes} disabled={syncing} style={{ ...btnStyle(false), gap: 6, opacity: syncing ? 0.6 : 1 }}>
            {syncing ? '⟳ Syncing…' : '⟳ Sync Recipes'}
          </button>
        </div>

        {/* Summary strip */}
        {!loading && entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Total Recipes', value: entries.length },
              { label: 'Fully Costed', value: `${totalCosted} / ${entries.length}` },
              { label: 'Pending', value: entries.length - totalCosted },
              { label: 'Avg Margin', value: avgMargin !== null ? avgMargin.toFixed(1) + '%' : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Montserrat',sans-serif" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...iStyle, width: 220 }} placeholder="🔍  Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'All'], ['pending', 'Pending'], ['costed', 'Fully Costed']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                background: filterStatus === val ? '#fdf2f5' : 'var(--white)',
                color: filterStatus === val ? '#ef4576' : 'var(--text-muted)',
                border: filterStatus === val ? '1.5px solid #ef4576' : '1px solid var(--border)',
              }}>{label}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Gallery */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No active recipes yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add recipes in Inventory → Recipes first, then come back here to enter costs.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>No recipes match your filters.</div>
        ) : (
          grouped.map(({ cat, items }) => {
            const p = getPalette(cat)
            const withMargin = items.filter(i => i.gross_margin !== null)
            const avgCatMargin = withMargin.length > 0
              ? withMargin.reduce((s, i) => s + i.gross_margin, 0) / withMargin.length
              : null

            return (
              <div key={cat} style={{ marginBottom: 36 }}>
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{cat}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.length} recipe{items.length !== 1 ? 's' : ''}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  {avgCatMargin !== null && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: marginBg(avgCatMargin), color: marginColor(avgCatMargin) }}>
                      avg {avgCatMargin.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                  {items.map(entry => (
                    <RecipeCogsCard
                      key={entry.recipe_id}
                      entry={entry}
                      palette={p}
                      onClick={() => setEditEntry(entry)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/* COST EDITOR MODAL */}
        <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title={`Costs — ${editEntry?.recipe_name || ''}`} wide>
          {editEntry && (
            <CostEditor
              key={editEntry.recipe_id}
              entry={editEntry}
              onSave={handleSave}
              onClose={() => setEditEntry(null)}
              saving={saving}
            />
          )}
        </Modal>

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AuthShell>
  )
}
