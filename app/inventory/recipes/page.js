'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cup', 'oz', 'slice', 'pack']
const SETTINGS_KEY = 'recipe_categories'

// Each category: { name, colorIdx, subcategories: [{ name }] }
const DEFAULT_CATEGORIES = [
  { name: 'Bar', colorIdx: 0, subcategories: [{ name: 'Cold Drinks' }, { name: 'Hot Drinks' }] },
  { name: 'Kitchen', colorIdx: 1, subcategories: [{ name: 'Mains' }, { name: 'Sides' }] },
  { name: 'Pastry', colorIdx: 2, subcategories: [{ name: 'Baked Goods' }] },
]

const PALETTE = [
  { bg: '#e8f4fd', text: '#1e40af', dot: '#2563eb', border: '#bfdbfe' },
  { bg: '#fef3c7', text: '#b45309', dot: '#d97706', border: '#fde68a' },
  { bg: '#fce7f3', text: '#9d174d', dot: '#db2777', border: '#fbcfe8' },
  { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280', border: '#e5e7eb' },
  { bg: '#d1fae5', text: '#065f46', dot: '#10b981', border: '#a7f3d0' },
  { bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626', border: '#fecaca' },
  { bg: '#fef9c3', text: '#854d0e', dot: '#ca8a04', border: '#fef08a' },
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
      <div style={{ background: 'var(--white)', borderRadius: 18, padding: 28, width: '100%', maxWidth: wide ? 760 : 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function getPalette(categories, catName) {
  const found = categories.find(c => c.name === catName)
  return found ? PALETTE[found.colorIdx % PALETTE.length] : PALETTE[3]
}

// ─── Catalog-linked ingredient / packaging row ────────────────────────────────
function IngredientRow({ ing, onChange, onRemove, catalogItems }) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const linked = catalogItems.find(c => c.id === ing.catalog_id)

  function pickCatalogItem(item) {
    onChange({
      ...ing,
      catalog_id: item.id,
      name: item.name,
      unit: item.unit,
      brand: item.preferred_store || ing.brand || '',
      variant: item.notes || ing.variant || '',
    })
    setShowPicker(false)
    setPickerSearch('')
  }

  function clearCatalogLink() {
    onChange({ ...ing, catalog_id: null })
  }

  const filteredCatalog = catalogItems.filter(c =>
    !pickerSearch || c.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${ing.catalog_id ? '#a7f3d0' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
      {/* Catalog link indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {ing.catalog_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46' }}>
              📦 Linked to Catalog
            </span>
            {linked && <span style={{ fontSize: 11, color: '#065f46' }}>{linked.name} · ₱{Number(linked.avg_price || 0).toFixed(2)}/{linked.unit}</span>}
            <button onClick={clearCatalogLink} style={{ fontSize: 10, color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>✕ Unlink</button>
          </div>
        ) : (
          <button onClick={() => setShowPicker(p => !p)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            📦 Link to Catalog
          </button>
        )}
      </div>

      {/* Catalog picker dropdown */}
      {showPicker && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
          <input
            autoFocus
            style={{ ...iStyle, borderRadius: 0, borderBottom: '1px solid var(--border)', fontSize: 12 }}
            placeholder="Search catalog…"
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
          />
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {filteredCatalog.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No items found</div>}
            {filteredCatalog.map(item => (
              <div key={item.id} onClick={() => pickCatalogItem(item)}
                style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{item.category}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#065f46' }}>₱{Number(item.avg_price || 0).toFixed(2)}/{item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 1: name, qty, unit, remove */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input style={{ ...iStyle, background: 'var(--white)' }} placeholder="Ingredient name" value={ing.name} onChange={e => onChange({ ...ing, name: e.target.value })} />
        <input style={{ ...iStyle, background: 'var(--white)' }} placeholder="Qty" type="number" min="0" step="any" value={ing.qty} onChange={e => onChange({ ...ing, qty: e.target.value })} />
        <select style={{ ...iStyle, background: 'var(--white)' }} value={ing.unit} onChange={e => onChange({ ...ing, unit: e.target.value })}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
        <button onClick={onRemove} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 14, width: 28, height: 28 }}>×</button>
      </div>
      {/* Row 2: brand, variant */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Brand</div>
          <input style={{ ...iStyle, background: 'var(--white)', fontSize: 12 }} placeholder="e.g. Superfood Grocer" value={ing.brand || ''} onChange={e => onChange({ ...ing, brand: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Variant</div>
          <input style={{ ...iStyle, background: 'var(--white)', fontSize: 12 }} placeholder="e.g. Uji Tea" value={ing.variant || ''} onChange={e => onChange({ ...ing, variant: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

// ─── Category Manager ────────────────────────────────────────────────────────
function CategoryManager({ categories, onSave, onClose, saving }) {
  const [cats, setCats] = useState(categories.map(c => ({
    ...c,
    subcategories: (c.subcategories || []).map(s => ({ ...s }))
  })))
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(0)
  // per-category new subcategory input state
  const [newSubInputs, setNewSubInputs] = useState({})

  function addCat() {
    const name = newCatName.trim()
    if (!name || cats.find(c => c.name.toLowerCase() === name.toLowerCase())) return
    setCats(prev => [...prev, { name, colorIdx: newCatColor, subcategories: [] }])
    setNewCatName('')
    setNewCatColor((newCatColor + 1) % PALETTE.length)
  }

  function removeCat(i) { setCats(prev => prev.filter((_, idx) => idx !== i)) }

  function recolorCat(i, colorIdx) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, colorIdx } : c))
  }

  function renameCat(i, name) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, name } : c))
  }

  function moveCat(i, dir) {
    const arr = [...cats]; const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]; setCats(arr)
  }

  function addSub(catIdx) {
    const name = (newSubInputs[catIdx] || '').trim()
    if (!name) return
    setCats(prev => prev.map((c, idx) => {
      if (idx !== catIdx) return c
      const already = (c.subcategories || []).find(s => s.name.toLowerCase() === name.toLowerCase())
      if (already) return c
      return { ...c, subcategories: [...(c.subcategories || []), { name }] }
    }))
    setNewSubInputs(prev => ({ ...prev, [catIdx]: '' }))
  }

  function removeSub(catIdx, subIdx) {
    setCats(prev => prev.map((c, idx) => {
      if (idx !== catIdx) return c
      return { ...c, subcategories: (c.subcategories || []).filter((_, si) => si !== subIdx) }
    }))
  }

  function renameSub(catIdx, subIdx, name) {
    setCats(prev => prev.map((c, idx) => {
      if (idx !== catIdx) return c
      return { ...c, subcategories: (c.subcategories || []).map((s, si) => si === subIdx ? { ...s, name } : s) }
    }))
  }

  function moveSub(catIdx, subIdx, dir) {
    setCats(prev => prev.map((c, idx) => {
      if (idx !== catIdx) return c
      const arr = [...(c.subcategories || [])]; const j = subIdx + dir
      if (j < 0 || j >= arr.length) return c
      ;[arr[subIdx], arr[j]] = [arr[j], arr[subIdx]]
      return { ...c, subcategories: arr }
    }))
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
        Manage top-level categories and their subcategories. Every recipe must belong to a subcategory.
      </div>

      {cats.map((cat, ci) => {
        const p = PALETTE[cat.colorIdx % PALETTE.length]
        return (
          <div key={ci} style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Category row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', flexWrap: 'wrap' }}>
              {/* Color dots */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {PALETTE.map((p2, pi) => (
                  <button key={pi} onClick={() => recolorCat(ci, pi)} style={{ width: 14, height: 14, borderRadius: '50%', background: p2.dot, border: cat.colorIdx % PALETTE.length === pi ? '2px solid #111' : '1px solid transparent', cursor: 'pointer', padding: 0, opacity: cat.colorIdx % PALETTE.length === pi ? 1 : 0.4, flexShrink: 0 }} />
                ))}
              </div>
              <input
                style={{ ...iStyle, flex: 1, minWidth: 100, padding: '6px 10px', fontSize: 13, background: 'var(--white)', fontWeight: 700 }}
                value={cat.name}
                onChange={e => renameCat(ci, e.target.value)}
                placeholder="Category name"
              />
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.bg, color: p.text, flexShrink: 0 }}>{cat.name || '…'}</span>
              <button onClick={() => moveCat(ci, -1)} disabled={ci === 0} style={{ background: 'transparent', border: 'none', cursor: ci === 0 ? 'default' : 'pointer', color: ci === 0 ? 'var(--border)' : 'var(--text-muted)', fontSize: 14, padding: '2px 3px' }}>↑</button>
              <button onClick={() => moveCat(ci, 1)} disabled={ci === cats.length - 1} style={{ background: 'transparent', border: 'none', cursor: ci === cats.length - 1 ? 'default' : 'pointer', color: ci === cats.length - 1 ? 'var(--border)' : 'var(--text-muted)', fontSize: 14, padding: '2px 3px' }}>↓</button>
              <button onClick={() => removeCat(ci)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 13, width: 24, height: 24, flexShrink: 0 }}>×</button>
            </div>

            {/* Subcategory rows */}
            <div style={{ padding: '8px 12px 12px 28px' }}>
              {(cat.subcategories || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0 8px' }}>No subcategories yet — add one below.</div>
              )}
              {(cat.subcategories || []).map((sub, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, display: 'inline-block', flexShrink: 0, opacity: 0.5 }} />
                  <input
                    style={{ ...iStyle, flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--white)' }}
                    value={sub.name}
                    onChange={e => renameSub(ci, si, e.target.value)}
                    placeholder="Subcategory name"
                  />
                  <button onClick={() => moveSub(ci, si, -1)} disabled={si === 0} style={{ background: 'transparent', border: 'none', cursor: si === 0 ? 'default' : 'pointer', color: si === 0 ? 'var(--border)' : 'var(--text-muted)', fontSize: 13, padding: '2px 3px' }}>↑</button>
                  <button onClick={() => moveSub(ci, si, 1)} disabled={si === (cat.subcategories || []).length - 1} style={{ background: 'transparent', border: 'none', cursor: si === (cat.subcategories || []).length - 1 ? 'default' : 'pointer', color: si === (cat.subcategories || []).length - 1 ? 'var(--border)' : 'var(--text-muted)', fontSize: 13, padding: '2px 3px' }}>↓</button>
                  <button onClick={() => removeSub(ci, si)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 12, width: 22, height: 22, flexShrink: 0 }}>×</button>
                </div>
              ))}
              {/* Add subcategory */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, display: 'inline-block', flexShrink: 0, opacity: 0.3, marginTop: 10 }} />
                <input
                  style={{ ...iStyle, flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--white)', borderStyle: 'dashed' }}
                  placeholder="New subcategory…"
                  value={newSubInputs[ci] || ''}
                  onChange={e => setNewSubInputs(prev => ({ ...prev, [ci]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addSub(ci)}
                />
                <button onClick={() => addSub(ci)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p.bg, color: p.text, fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>+ Add</button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add new category */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px', border: '1px solid var(--border)', marginBottom: 20, marginTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Add new category</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PALETTE.map((p2, pi) => (
              <button key={pi} onClick={() => setNewCatColor(pi)} style={{ width: 18, height: 18, borderRadius: '50%', background: p2.dot, border: newCatColor === pi ? '2px solid #111' : '1px solid transparent', cursor: 'pointer', padding: 0, opacity: newCatColor === pi ? 1 : 0.4 }} />
            ))}
          </div>
          <input
            style={{ ...iStyle, flex: 1, minWidth: 140, padding: '8px 12px' }}
            placeholder="Category name…"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
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

// ─── Main Page ───────────────────────────────────────────────────────────────
const blankRecipe = (cat, sub) => ({
  name: '', category: cat || '', subcategory: sub || '', description: '',
  serving_size: '', prep_time: '', junior_visible: false, is_active: true,
  photo_url: '', ingredients: [], packaging: [], assigned_roles: [], steps: [],
})

export default function RecipesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [catalogItems, setCatalogItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // Which top-level categories are expanded
  const [expandedCats, setExpandedCats] = useState({})
  const [filterJunior, setFilterJunior] = useState('all')
  const [search, setSearch] = useState('')

  const [showCatManager, setShowCatManager] = useState(false)
  const [savingCats, setSavingCats] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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
    setCategories(DEFAULT_CATEGORIES)
    return DEFAULT_CATEGORIES
  }

  async function loadRecipes() {
    const { data, error } = await supabase.from('recipes').select('*').order('category').order('subcategory').order('name')
    if (error) showToast('Failed to load recipes', 'error')
    else setRecipes(data || [])
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadCategories()
      await Promise.all([
        loadRecipes(),
        supabase.from('inventory_catalog').select('id,name,unit,avg_price,category,preferred_store,notes').eq('is_active', true).order('category').order('name').then(({ data }) => setCatalogItems(data || [])),
      ])
      setLoading(false)
    }
    init()
  }, [])

  async function handleSaveCategories(cats) {
    const cleaned = cats.filter(c => c.name.trim()).map(c => ({
      name: c.name.trim(),
      colorIdx: c.colorIdx,
      subcategories: (c.subcategories || []).filter(s => s.name.trim()).map(s => ({ name: s.name.trim() }))
    }))
    setSavingCats(true)
    const { error } = await supabase.from('settings').upsert({ key: SETTINGS_KEY, value: JSON.stringify(cleaned) }, { onConflict: 'key' })
    setSavingCats(false)
    if (error) return showToast('Failed to save: ' + error.message, 'error')
    setCategories(cleaned)
    setShowCatManager(false)
    showToast('Categories saved!')
  }

  function toggleCat(catName) {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }))
  }

  function openNew(cat, sub) {
    setEditing(null)
    setForm(blankRecipe(cat, sub))
    setShowForm(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '',
      category: r.category || '',
      subcategory: r.subcategory || '',
      description: r.description || '',
      serving_size: r.serving_size || '',
      prep_time: r.prep_time || '',
      junior_visible: r.junior_visible || false,
      is_active: r.is_active !== false,
      photo_url: r.photo_url || '',
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      packaging: Array.isArray(r.packaging) ? r.packaging : [],
      assigned_roles: Array.isArray(r.assigned_roles) ? r.assigned_roles : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
    })
    setShowForm(true)
  }

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // When category changes in form, reset subcategory to first of new category
  function handleFormCatChange(catName) {
    const cat = categories.find(c => c.name === catName)
    const firstSub = (cat?.subcategories || [])[0]?.name || ''
    setForm(p => ({ ...p, category: catName, subcategory: firstSub }))
  }

  function addIngredient() { setF('ingredients', [...form.ingredients, { name: '', qty: '', unit: 'g' }]) }
  function updateIngredient(i, val) { const a = [...form.ingredients]; a[i] = val; setF('ingredients', a) }
  function removeIngredient(i) { setF('ingredients', form.ingredients.filter((_, idx) => idx !== i)) }
  function addPackaging() { setF('packaging', [...(form.packaging || []), { name: '', qty: '', unit: 'pcs', brand: '', variant: '' }]) }
  function updatePackaging(i, val) { const a = [...(form.packaging || [])]; a[i] = val; setF('packaging', a) }
  function removePackaging(i) { setF('packaging', (form.packaging || []).filter((_, idx) => idx !== i)) }
  function toggleRole(role) { const cur = form.assigned_roles || []; setF('assigned_roles', cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]) }
  function addStep() { setF('steps', [...form.steps, '']) }
  function updateStep(i, val) { const a = [...form.steps]; a[i] = val; setF('steps', a) }
  function removeStep(i) { setF('steps', form.steps.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    if (!form.name.trim()) return showToast('Recipe name required', 'error')
    if (!form.subcategory) return showToast('Please select a subcategory', 'error')
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      description: form.description.trim(),
      serving_size: form.serving_size.trim(),
      prep_time: form.prep_time.trim(),
      junior_visible: form.junior_visible,
      is_active: form.is_active,
      photo_url: form.photo_url || '',
      ingredients: form.ingredients.filter(i => i.name.trim()),
      packaging: (form.packaging || []).filter(i => i.name.trim()),
      assigned_roles: form.assigned_roles || [],
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

  async function handlePhotoUpload(file) {
    if (!file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `recipes/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true })
    if (uploadError) { showToast('Upload failed: ' + uploadError.message, 'error'); setUploadingPhoto(false); return }
    const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path)
    setF('photo_url', data.publicUrl)
    setUploadingPhoto(false)
    showToast('Photo uploaded!')
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
    if (filterJunior === 'junior' && !r.junior_visible) return false
    if (filterJunior === 'senior' && r.junior_visible) return false
    if (search && !`${r.name} ${r.category} ${r.subcategory || ''} ${r.description || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const [activeTab, setActiveTab] = useState(null)

  // Set default tab when categories load
  useEffect(() => {
    if (categories.length > 0 && !activeTab) setActiveTab(categories[0].name)
  }, [categories])

  const btnStyle = (primary) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9,
    border: primary ? 'none' : '1px solid var(--border)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)',
    color: primary ? 'white' : 'var(--text-primary)',
  })

  // Subcategories for current form category
  const formCat = categories.find(c => c.name === form?.category)
  const formSubs = formCat?.subcategories || []

  // Active tab data
  const activeCatObj = categories.find(c => c.name === activeTab)
  const activePalette = activeCatObj ? PALETTE[activeCatObj.colorIdx % PALETTE.length] : PALETTE[3]
  const tabRecipes = filtered.filter(r => r.category === activeTab)

  return (
    <AuthShell>
      <div style={{ padding: '24px 28px', fontFamily: "'DM Sans',sans-serif", minHeight: '100vh' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📒 Recipes</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Role-based visibility in Staff Portal</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCatManager(true)} style={btnStyle(false)}>⚙️ Categories</button>
            <button onClick={() => {
              const firstCat = categories[0]
              const firstSub = firstCat?.subcategories?.[0]?.name || ''
              openNew(firstCat?.name || '', firstSub)
            }} style={btnStyle(true)}><span style={{ fontSize: 16 }}>+</span> New Recipe</button>
          </div>
        </div>

        {/* Search + access filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 0, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...iStyle, width: 220 }}
            placeholder="🔍  Search recipes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Access:</span>
            {[['all', 'All'], ['junior', 'Junior only'], ['senior', 'Senior only']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterJunior(val)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                background: filterJunior === val ? '#fdf2f5' : 'var(--white)',
                color: filterJunior === val ? '#ef4576' : 'var(--text-muted)',
                border: filterJunior === val ? '1.5px solid #ef4576' : '1px solid var(--border)',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        {!loading && categories.length > 0 && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 28, marginTop: 20, overflowX: 'auto' }}>
            {categories.map(cat => {
              const p = PALETTE[cat.colorIdx % PALETTE.length]
              const count = recipes.filter(r => r.category === cat.name).length
              const isActive = activeTab === cat.name
              return (
                <button key={cat.name} onClick={() => setActiveTab(cat.name)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  color: isActive ? p.text : 'var(--text-muted)',
                  borderBottom: isActive ? `3px solid ${p.dot}` : '3px solid transparent',
                  marginBottom: -2, whiteSpace: 'nowrap', transition: 'all .15s',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  {cat.name}
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: isActive ? p.bg : 'var(--surface)', color: isActive ? p.text : 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Gallery content for active tab */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>Loading recipes…</div>
        ) : !activeCatObj ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>No categories yet. Click ⚙️ Categories to add one.</div>
        ) : (activeCatObj.subcategories || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>No subcategories yet. Click ⚙️ Categories to add some under {activeCatObj.name}.</div>
        ) : (
          <div>
            {(activeCatObj.subcategories || []).map((sub, si) => {
              const subRecipes = tabRecipes.filter(r => r.subcategory === sub.name)
              const isLastSub = si === (activeCatObj.subcategories || []).length - 1
              return (
                <div key={sub.name} style={{ marginBottom: isLastSub ? 0 : 36 }}>
                  {/* Subcategory header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: activePalette.dot, opacity: 0.6, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{sub.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>{subRecipes.length}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <button onClick={() => openNew(activeCatObj.name, sub.name)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, border: `1px solid ${activePalette.border}`, background: activePalette.bg, color: activePalette.text, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                      + Add
                    </button>
                  </div>

                  {/* Recipe gallery cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {subRecipes.length === 0 && (
                      <div onClick={() => openNew(activeCatObj.name, sub.name)}
                        style={{ border: '1px dashed var(--border)', borderRadius: 14, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = activePalette.bg; e.currentTarget.style.color = activePalette.text; e.currentTarget.style.borderColor = activePalette.dot }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                        <span style={{ fontSize: 20 }}>+</span>
                        <span>Add first recipe</span>
                      </div>
                    )}
                    {subRecipes.map(r => (
                      <div key={r.id} onClick={() => setViewRecipe(r)}
                        style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = activePalette.border }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>

                        {/* Photo or color strip */}
                        {r.photo_url ? (
                          <div style={{ height: 140, overflow: 'hidden' }}>
                            <img src={r.photo_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                        ) : (
                          <div style={{ height: 3, background: activePalette.dot }} />
                        )}

                        <div style={{ padding: '14px 16px' }}>
                          {/* Tags */}
                          {(r.junior_visible || !r.is_active) && (
                            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                              {r.junior_visible && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#d1fae5', color: '#065f46' }}>Junior ✓</span>}
                              {!r.is_active && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>Inactive</span>}
                            </div>
                          )}

                          {/* Name */}
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 6 }}>{r.name}</div>

                          {/* Description */}
                          {r.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                              {r.description.length > 75 ? r.description.slice(0, 75) + '…' : r.description}
                            </div>
                          )}

                          {/* Meta row */}
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            {r.serving_size && <span>🍽 {r.serving_size}</span>}
                            {r.prep_time && <span>⏱ {r.prep_time}</span>}
                            {Array.isArray(r.ingredients) && r.ingredients.length > 0 && <span>🧂 {r.ingredients.length}</span>}
                            {Array.isArray(r.steps) && r.steps.length > 0 && <span>📋 {r.steps.length} steps</span>}
                          </div>
                        </div>

                        {/* Edit footer */}
                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: activePalette.bg }}>
                          <button onClick={e => { e.stopPropagation(); openEdit(r) }}
                            style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 7, border: `1px solid ${activePalette.border}`, background: 'transparent', color: activePalette.text, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Ghost add card at end (when there are already recipes) */}
                    {subRecipes.length > 0 && (
                      <div onClick={() => openNew(activeCatObj.name, sub.name)}
                        style={{ border: '1px dashed var(--border)', borderRadius: 14, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = activePalette.bg; e.currentTarget.style.color = activePalette.text; e.currentTarget.style.borderColor = activePalette.dot }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                        <span style={{ fontSize: 20 }}>+</span>
                        <span>Add recipe</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CATEGORY MANAGER MODAL */}
        <Modal open={showCatManager} onClose={() => setShowCatManager(false)} title="⚙️ Manage Categories" wide>
          <CategoryManager categories={categories} onSave={handleSaveCategories} onClose={() => setShowCatManager(false)} saving={savingCats} />
        </Modal>

        {/* VIEW MODAL */}
        <Modal open={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.name || ''} wide>
          {viewRecipe && (() => {
            const p = getPalette(categories, viewRecipe.category)
            return (
              <div>
                {viewRecipe.photo_url && (
                  <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 18, maxHeight: 260 }}>
                    <img src={viewRecipe.photo_url} alt={viewRecipe.name} style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.bg, color: p.text }}>{viewRecipe.category}</span>
                  {viewRecipe.subcategory && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{viewRecipe.subcategory}</span>
                  )}
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
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < viewRecipe.ingredients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (ing.brand || ing.variant) ? 6 : 0 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{ing.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{ing.qty} {ing.unit}</span>
                          </div>
                          {(ing.brand || ing.variant) && (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {ing.brand && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Brand:</span> {ing.brand}</span>}
                              {ing.variant && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Variant:</span> {ing.variant}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(viewRecipe.packaging) && viewRecipe.packaging.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Packaging</div>
                    <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {viewRecipe.packaging.map((pkg, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < viewRecipe.packaging.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (pkg.brand || pkg.variant) ? 6 : 0 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{pkg.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{pkg.qty} {pkg.unit}</span>
                          </div>
                          {(pkg.brand || pkg.variant) && (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {pkg.brand && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Brand:</span> {pkg.brand}</span>}
                              {pkg.variant && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Variant:</span> {pkg.variant}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(viewRecipe.assigned_roles) && viewRecipe.assigned_roles.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Assigned Employee</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {viewRecipe.assigned_roles.map(role => (
                        <span key={role} style={{ fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 20, background: '#fdf2f5', color: '#ef4576', border: '1px solid #fbcfe8' }}>{role}</span>
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
            )
          })()}
        </Modal>

        {/* RECIPE FORM MODAL */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Recipe' : 'New Recipe'} wide>
          {form && (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Name */}
              <div>
                <label style={lStyle}>Recipe Name *</label>
                <input style={iStyle} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Iced Matcha Latte" />
              </div>

              {/* Photo upload */}
              <div>
                <label style={lStyle}>Recipe Photo</label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Preview */}
                  <div style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {form.photo_url ? (
                      <img src={form.photo_url} alt="Recipe" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 28 }}>🍽</span>
                    )}
                  </div>
                  {/* Upload controls */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: uploadingPhoto ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif", opacity: uploadingPhoto ? 0.6 : 1 }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload(e.target.files[0])} disabled={uploadingPhoto} />
                      {uploadingPhoto ? '⏳ Uploading…' : '📷 Upload Photo'}
                    </label>
                    {form.photo_url && (
                      <button onClick={() => setF('photo_url', '')} style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", padding: 0 }}>
                        ✕ Remove photo
                      </button>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>JPG, PNG or WEBP. Recommended 800×800px.</div>
                  </div>
                </div>
              </div>

              {/* Category + Subcategory */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lStyle}>Category</label>
                  <select style={iStyle} value={form.category} onChange={e => handleFormCatChange(e.target.value)}>
                    {categories.map(c => <option key={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Subcategory *</label>
                  <select style={iStyle} value={form.subcategory} onChange={e => setF('subcategory', e.target.value)}>
                    {formSubs.length === 0 && <option value="">No subcategories — add via ⚙️</option>}
                    {formSubs.map(s => <option key={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={lStyle}>Description / Notes</label>
                <textarea style={{ ...iStyle, height: 70, resize: 'vertical' }} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Brief description or special notes…" />
              </div>

              {/* Serving + Prep */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lStyle}>Serving Size</label>
                  <input style={iStyle} value={form.serving_size} onChange={e => setF('serving_size', e.target.value)} placeholder="e.g. 12 oz" />
                </div>
                <div>
                  <label style={lStyle}>Prep Time</label>
                  <input style={iStyle} value={form.prep_time} onChange={e => setF('prep_time', e.target.value)} placeholder="e.g. 3 mins" />
                </div>
              </div>

              {/* Toggles */}
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
                {form.ingredients.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No ingredients yet.</div>}
                {form.ingredients.map((ing, i) => (
                  <IngredientRow key={i} ing={ing} onChange={val => updateIngredient(i, val)} onRemove={() => removeIngredient(i)} catalogItems={catalogItems} />
                ))}
              </div>

              {/* Packaging */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Packaging</label>
                  <button onClick={addPackaging} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add</button>
                </div>
                {(form.packaging || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No packaging yet. e.g. 12oz Cup, Lid, Straw</div>}
                {(form.packaging || []).map((pkg, i) => (
                  <IngredientRow key={i} ing={pkg} onChange={val => updatePackaging(i, val)} onRemove={() => removePackaging(i)} catalogItems={catalogItems} />
                ))}
              </div>

              {/* Assigned Employee */}
              <div>
                <label style={{ ...lStyle, marginBottom: 10 }}>Assigned Employee</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Senior Barista', 'Junior Barista - Milk Station', 'Junior Barista - Cashier', 'Executive Chef', 'Sous Chef', 'Kitchen Staff'].map(role => {
                    const selected = (form.assigned_roles || []).includes(role)
                    return (
                      <button key={role} type="button" onClick={() => toggleRole(role)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
                        background: selected ? '#fdf2f5' : 'var(--surface)',
                        color: selected ? '#ef4576' : 'var(--text-muted)',
                        border: selected ? '1.5px solid #ef4576' : '1px solid var(--border)',
                      }}>{role}</button>
                    )
                  })}
                </div>
              </div>

              {/* Steps */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Preparation Steps</label>
                  <button onClick={addStep} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add Step</button>
                </div>
                {form.steps.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No steps yet.</div>}
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>This will permanently delete this recipe. This cannot be undone.</p>
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
