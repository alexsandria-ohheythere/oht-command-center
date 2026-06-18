'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const DEFAULT_CATEGORIES = ['Bar', 'Kitchen', 'Pastry', 'Other']
const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cup', 'oz', 'slice', 'pack']
const SETTINGS_KEY = 'recipe_categories'

const PALETTE = [
  { bg: '#e8f4fd', text: '#2563eb', border: '#bfdbfe' },
  { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8' },
  { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  { bg: '#ede9fe', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
  { bg: '#fef9c3', text: '#ca8a04', border: '#fef08a' },
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
      <div style={{ background: 'var(--white)', borderRadius: 18, padding: 28, width: '100%', maxWidth: wide ? 720 : 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CategoryBadge({ cat, categories }) {
  const found = categories.find(c => c.name === cat)
  const c = found ? PALETTE[found.colorIdx % PALETTE.length] : PALETTE[3]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
      {cat}
    </span>
  )
}

function IngredientRow({ ing, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <input style={iStyle} placeholder="Ingredient name" value={ing.name} onChange={e => onChange({ ...ing, name: e.target.value })} />
      <input style={iStyle} placeholder="Qty" type="number" min="0" step="any" value={ing.qty} onChange={e => onChange({ ...ing, qty: e.target.value })} />
      <select style={iStyle} value={ing.unit} onChange={e => onChange({ ...ing, unit: e.target.value })}>
        {UNITS.map(u => <option key={u}>{u}</option>)}
      </select>
      <button onClick={onRemove} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 14, width: 28, height: 28 }}>×</button>
    </div>
  )
}

const blankRecipe = (defaultCat) => ({
  name: '', category: defaultCat || 'Bar', description: '', serving_size: '', prep_time: '',
  junior_visible: false, is_active: true, ingredients: [], steps: [],
})

// Category Manager Panel
function CategoryManager({ categories, onSave, onClose, saving }) {
  const [cats, setCats] = useState(categories.map(c => ({ ...c })))
  const [newName, setNewName] = useState('')
  const [newColorIdx, setNewColorIdx] = useState(0)

  function addCat() {
    const name = newName.trim()
    if (!name) return
    if (cats.find(c => c.name.toLowerCase() === name.toLowerCase())) return
    setCats(prev => [...prev, { name, colorIdx: newColorIdx }])
    setNewName('')
    setNewColorIdx((newColorIdx + 1) % PALETTE.length)
  }

  function removeCat(i) {
    setCats(prev => prev.filter((_, idx) => idx !== i))
  }

  function recolor(i, colorIdx) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, colorIdx } : c))
  }

  function rename(i, name) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, name } : c))
  }

  function move(i, dir) {
    const arr = [...cats]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setCats(arr)
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
        Add, rename, recolor, or reorder recipe categories. Changes apply across all recipes and the Staff Portal.
      </div>

      {/* Existing categories */}
      <div style={{ marginBottom: 20 }}>
        {cats.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>No categories yet.</div>}
        {cats.map((cat, i) => {
          const c = PALETTE[cat.colorIdx % PALETTE.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
              {/* Color picker dots */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {PALETTE.map((p, pi) => (
                  <button key={pi} onClick={() => recolor(i, pi)} title={`Color ${pi + 1}`} style={{ width: 16, height: 16, borderRadius: '50%', background: p.bg, border: cat.colorIdx % PALETTE.length === pi ? `2px solid ${p.text}` : `1px solid ${p.border}`, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </div>
              {/* Name input */}
              <input
                style={{ ...iStyle, flex: 1, padding: '6px 10px', fontSize: 13, background: 'var(--white)' }}
                value={cat.name}
                onChange={e => rename(i, e.target.value)}
              />
              {/* Preview badge */}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{cat.name || '…'}</span>
              {/* Move up/down */}
              <button onClick={() => move(i, -1)} disabled={i === 0} style={{ background: 'transparent', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--border)' : 'var(--text-muted)', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === cats.length - 1} style={{ background: 'transparent', border: 'none', cursor: i === cats.length - 1 ? 'default' : 'pointer', color: i === cats.length - 1 ? 'var(--border)' : 'var(--text-muted)', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}>↓</button>
              {/* Remove */}
              <button onClick={() => removeCat(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 13, width: 26, height: 26, flexShrink: 0 }}>×</button>
            </div>
          )
        })}
      </div>

      {/* Add new */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 14px', border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Add New Category</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {PALETTE.map((p, pi) => (
              <button key={pi} onClick={() => setNewColorIdx(pi)} style={{ width: 18, height: 18, borderRadius: '50%', background: p.bg, border: newColorIdx === pi ? `2px solid ${p.text}` : `1px solid ${p.border}`, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <input
            style={{ ...iStyle, flex: 1, minWidth: 140, padding: '8px 12px' }}
            placeholder="Category name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCat()}
          />
          <button onClick={addCat} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--text-primary)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>+ Add</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: 'var(--surface)', color: 'var(--text-primary)' }}>Cancel</button>
        <button onClick={() => onSave(cats)} disabled={saving} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: '#ef4576', color: 'white', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Categories'}
        </button>
      </div>
    </div>
  )
}

export default function RecipesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [filterCat, setFilterCat] = useState('All')
  const [filterJunior, setFilterJunior] = useState('All')
  const [search, setSearch] = useState('')

  const [showCatManager, setShowCatManager] = useState(false)
  const [savingCats, setSavingCats] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [viewRecipe, setViewRecipe] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function loadCategories() {
    const { data } = await supabase.from('settings').select('value').eq('key', SETTINGS_KEY).single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value)
        setCategories(parsed)
        return parsed
      } catch {}
    }
    // Default
    const defaults = DEFAULT_CATEGORIES.map((name, i) => ({ name, colorIdx: i % PALETTE.length }))
    setCategories(defaults)
    return defaults
  }

  async function loadRecipes() {
    const { data, error } = await supabase.from('recipes').select('*').order('category').order('name')
    if (error) showToast('Failed to load recipes', 'error')
    else setRecipes(data || [])
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadCategories()
      await loadRecipes()
      setLoading(false)
    }
    init()
  }, [])

  async function handleSaveCategories(cats) {
    const cleaned = cats.filter(c => c.name.trim()).map(c => ({ ...c, name: c.name.trim() }))
    setSavingCats(true)
    // Upsert into settings
    const { error } = await supabase.from('settings').upsert({ key: SETTINGS_KEY, value: JSON.stringify(cleaned) }, { onConflict: 'key' })
    setSavingCats(false)
    if (error) return showToast('Failed to save categories: ' + error.message, 'error')
    setCategories(cleaned)
    setShowCatManager(false)
    // Reset category filter if no longer valid
    setFilterCat('All')
    showToast('Categories saved!')
  }

  const catNames = categories.map(c => c.name)

  function openNew() {
    setEditing(null)
    setForm(blankRecipe(catNames[0] || 'Bar'))
    setShowForm(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '',
      category: r.category || catNames[0] || '',
      description: r.description || '',
      serving_size: r.serving_size || '',
      prep_time: r.prep_time || '',
      junior_visible: r.junior_visible || false,
      is_active: r.is_active !== false,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
    })
    setShowForm(true)
  }

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function addIngredient() { setF('ingredients', [...form.ingredients, { name: '', qty: '', unit: 'g' }]) }
  function updateIngredient(i, val) { const a = [...form.ingredients]; a[i] = val; setF('ingredients', a) }
  function removeIngredient(i) { setF('ingredients', form.ingredients.filter((_, idx) => idx !== i)) }
  function addStep() { setF('steps', [...form.steps, '']) }
  function updateStep(i, val) { const a = [...form.steps]; a[i] = val; setF('steps', a) }
  function removeStep(i) { setF('steps', form.steps.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    if (!form.name.trim()) return showToast('Recipe name required', 'error')
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      serving_size: form.serving_size.trim(),
      prep_time: form.prep_time.trim(),
      junior_visible: form.junior_visible,
      is_active: form.is_active,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      steps: form.steps.filter(s => s.trim()),
    }
    let error
    if (editing) {
      ({ error } = await supabase.from('recipes').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('recipes').insert(payload))
    }
    setSaving(false)
    if (error) return showToast('Save failed: ' + error.message, 'error')
    showToast(editing ? 'Recipe updated!' : 'Recipe added!')
    setShowForm(false)
    loadRecipes()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) return showToast('Delete failed', 'error')
    showToast('Recipe deleted')
    setConfirmDelete(null)
    setViewRecipe(null)
    loadRecipes()
  }

  const filtered = recipes.filter(r => {
    if (filterCat !== 'All' && r.category !== filterCat) return false
    if (filterJunior === 'Junior Only' && !r.junior_visible) return false
    if (filterJunior === 'Senior Only' && r.junior_visible) return false
    if (search && !`${r.name} ${r.category} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by category order
  const grouped = []
  const catOrder = catNames.length > 0 ? catNames : DEFAULT_CATEGORIES
  for (const cat of catOrder) {
    const recs = filtered.filter(r => r.category === cat)
    if (recs.length > 0) grouped.push({ cat, recs })
  }
  // Uncategorized (category name no longer in list)
  const knownCats = new Set(catOrder)
  const orphans = filtered.filter(r => !knownCats.has(r.category))
  if (orphans.length > 0) grouped.push({ cat: 'Other', recs: orphans })

  const btnStyle = (primary) => ({
    padding: '9px 18px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--border)', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
  })

  return (
    <AuthShell>
      <div style={{ padding: '24px 28px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📒 Recipes</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Manage bar, kitchen, and pastry recipes. Role-based visibility in Staff Portal.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCatManager(true)} style={{ ...btnStyle(false), display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚙️ Categories
            </button>
            <button onClick={openNew} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 16 }}>+</span> New Recipe
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...iStyle, width: 220 }}
            placeholder="🔍  Search recipes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={{ ...iStyle, width: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All Categories</option>
            {catNames.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={{ ...iStyle, width: 170 }} value={filterJunior} onChange={e => setFilterJunior(e.target.value)}>
            <option value="All">All Access Levels</option>
            <option value="Junior Only">Junior-visible only</option>
            <option value="Senior Only">Senior/Full access only</option>
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Category pill strip */}
        {catNames.length > 0 && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCat('All')} style={{ fontSize: 11, fontWeight: filterCat === 'All' ? 700 : 500, padding: '5px 12px', borderRadius: 20, border: filterCat === 'All' ? '2px solid #ef4576' : '1px solid var(--border)', background: filterCat === 'All' ? '#fdf2f5' : 'var(--white)', color: filterCat === 'All' ? '#ef4576' : 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              All ({recipes.length})
            </button>
            {catNames.map(cat => {
              const count = recipes.filter(r => r.category === cat).length
              const active = filterCat === cat
              const found = categories.find(c => c.name === cat)
              const palette = found ? PALETTE[found.colorIdx % PALETTE.length] : PALETTE[3]
              return (
                <button key={cat} onClick={() => setFilterCat(active ? 'All' : cat)}
                  style={{ fontSize: 11, fontWeight: active ? 700 : 500, padding: '5px 12px', borderRadius: 20, border: active ? `2px solid ${palette.text}` : `1px solid ${palette.border}`, background: active ? palette.bg : 'var(--white)', color: active ? palette.text : 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  {cat} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Recipe Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Loading recipes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
            {recipes.length === 0 ? 'No recipes yet. Click + New Recipe to get started!' : 'No recipes match your filters.'}
          </div>
        ) : (
          grouped.map(({ cat, recs }) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CategoryBadge cat={cat} categories={categories} />
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{recs.length} recipe{recs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {recs.map(r => (
                  <div key={r.id} onClick={() => setViewRecipe(r)}
                    style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'box-shadow .15s', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>{r.name}</div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {r.junior_visible && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#d1fae5', color: '#065f46', letterSpacing: 0.5 }}>JUNIOR ✓</span>}
                        {!r.is_active && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', letterSpacing: 0.5 }}>INACTIVE</span>}
                      </div>
                    </div>
                    {r.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{r.description.length > 90 ? r.description.slice(0, 90) + '…' : r.description}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {r.serving_size && <span>🍽 {r.serving_size}</span>}
                      {r.prep_time && <span>⏱ {r.prep_time}</span>}
                      {Array.isArray(r.ingredients) && r.ingredients.length > 0 && <span>🧂 {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* CATEGORY MANAGER MODAL */}
        <Modal open={showCatManager} onClose={() => setShowCatManager(false)} title="⚙️ Manage Categories" wide>
          <CategoryManager
            categories={categories}
            onSave={handleSaveCategories}
            onClose={() => setShowCatManager(false)}
            saving={savingCats}
          />
        </Modal>

        {/* VIEW MODAL */}
        <Modal open={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.name || ''} wide>
          {viewRecipe && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <CategoryBadge cat={viewRecipe.category} categories={categories} />
                {viewRecipe.junior_visible && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46' }}>Junior Visible</span>}
                {!viewRecipe.is_active && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>Inactive</span>}
                {viewRecipe.serving_size && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🍽 {viewRecipe.serving_size}</span>}
                {viewRecipe.prep_time && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {viewRecipe.prep_time}</span>}
              </div>
              {viewRecipe.description && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>{viewRecipe.description}</p>}
              {Array.isArray(viewRecipe.ingredients) && viewRecipe.ingredients.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Ingredients</div>
                  <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {viewRecipe.ingredients.map((ing, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < viewRecipe.ingredients.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ing.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{ing.qty} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(viewRecipe.steps) && viewRecipe.steps.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Steps</div>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {viewRecipe.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.6 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <button onClick={() => setConfirmDelete(viewRecipe.id)} style={{ ...btnStyle(false), color: '#dc2626', border: '1px solid #fecaca' }}>Delete</button>
                <button onClick={() => { openEdit(viewRecipe); setViewRecipe(null) }} style={btnStyle(false)}>Edit</button>
                <button onClick={() => setViewRecipe(null)} style={btnStyle(true)}>Close</button>
              </div>
            </div>
          )}
        </Modal>

        {/* FORM MODAL */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Recipe' : 'New Recipe'} wide>
          {form && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lStyle}>Recipe Name *</label>
                  <input style={iStyle} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Matcha Latte" />
                </div>
                <div>
                  <label style={lStyle}>Category</label>
                  <select style={iStyle} value={form.category} onChange={e => setF('category', e.target.value)}>
                    {catNames.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lStyle}>Description / Notes</label>
                <textarea style={{ ...iStyle, height: 70, resize: 'vertical' }} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Brief description or special notes…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lStyle}>Serving Size</label>
                  <input style={iStyle} value={form.serving_size} onChange={e => setF('serving_size', e.target.value)} placeholder="e.g. 12 oz, 1 serving" />
                </div>
                <div>
                  <label style={lStyle}>Prep Time</label>
                  <input style={iStyle} value={form.prep_time} onChange={e => setF('prep_time', e.target.value)} placeholder="e.g. 3 mins" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.junior_visible} onChange={e => setF('junior_visible', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
                <span>Visible to Junior staff</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Junior Baristas, Sous Chef, Kitchen Staff)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
                <span>Active</span>
              </label>

              {/* Ingredients */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Ingredients</label>
                  <button onClick={addIngredient} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add</button>
                </div>
                {form.ingredients.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No ingredients yet.</div>}
                {form.ingredients.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                    <span>Ingredient</span><span>Qty</span><span>Unit</span><span></span>
                  </div>
                )}
                {form.ingredients.map((ing, i) => (
                  <IngredientRow key={i} ing={ing} onChange={val => updateIngredient(i, val)} onRemove={() => removeIngredient(i)} />
                ))}
              </div>

              {/* Steps */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Preparation Steps</label>
                  <button onClick={addStep} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add Step</button>
                </div>
                {form.steps.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No steps yet.</div>}
                {form.steps.map((step, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingTop: 10, minWidth: 20 }}>{i + 1}.</span>
                      <textarea style={{ ...iStyle, height: 52, resize: 'vertical' }} value={step} onChange={e => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}…`} />
                    </div>
                    <button onClick={() => removeStep(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 14, width: 28, height: 28, marginTop: 4 }}>×</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <button onClick={() => setShowForm(false)} style={btnStyle(false)}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ ...btnStyle(true), opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Recipe'}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* DELETE CONFIRM */}
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Recipe?">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            This will permanently delete this recipe and remove it from any linked COGS entries. This cannot be undone.
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
