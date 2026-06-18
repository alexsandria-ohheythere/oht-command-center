'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const CATEGORIES = ['Bar', 'Kitchen', 'Pastry', 'Other']
const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cup', 'oz', 'slice', 'pack']

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

const CATEGORY_COLORS = {
  Bar: { bg: '#e8f4fd', text: '#2563eb', border: '#bfdbfe' },
  Kitchen: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  Pastry: { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8' },
  Other: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
}

function CategoryBadge({ cat }) {
  const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, letterSpacing: 0.5 }}>
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

const blank = () => ({
  name: '', category: 'Bar', description: '', serving_size: '', prep_time: '',
  junior_visible: false, is_active: true, ingredients: [], steps: [],
})

export default function RecipesPage() {
  const supabase = createClient()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [filterCat, setFilterCat] = useState('All')
  const [filterJunior, setFilterJunior] = useState('All')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)

  const [viewRecipe, setViewRecipe] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('category')
      .order('name')
    if (error) showToast('Failed to load recipes', 'error')
    else setRecipes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(blank())
    setShowForm(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '',
      category: r.category || 'Bar',
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

  function addIngredient() {
    setF('ingredients', [...form.ingredients, { name: '', qty: '', unit: 'g' }])
  }
  function updateIngredient(i, val) {
    const arr = [...form.ingredients]; arr[i] = val; setF('ingredients', arr)
  }
  function removeIngredient(i) {
    setF('ingredients', form.ingredients.filter((_, idx) => idx !== i))
  }

  function addStep() {
    setF('steps', [...form.steps, ''])
  }
  function updateStep(i, val) {
    const arr = [...form.steps]; arr[i] = val; setF('steps', arr)
  }
  function removeStep(i) {
    setF('steps', form.steps.filter((_, idx) => idx !== i))
  }

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
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) return showToast('Delete failed', 'error')
    showToast('Recipe deleted')
    setConfirmDelete(null)
    setViewRecipe(null)
    load()
  }

  const filtered = recipes.filter(r => {
    if (filterCat !== 'All' && r.category !== filterCat) return false
    if (filterJunior === 'Junior Only' && !r.junior_visible) return false
    if (filterJunior === 'Senior Only' && r.junior_visible) return false
    if (search && !`${r.name} ${r.category} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const recs = filtered.filter(r => r.category === cat)
    if (recs.length > 0) acc[cat] = recs
    return acc
  }, {})

  const btnStyle = (primary) => ({
    padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
    background: primary ? '#ef4576' : 'var(--surface)', color: primary ? 'white' : 'var(--text-primary)',
    border: primary ? 'none' : '1px solid var(--border)',
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
          <button onClick={openNew} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>+</span> New Recipe
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...iStyle, width: 220 }}
            placeholder="🔍  Search recipes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={{ ...iStyle, width: 140 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={{ ...iStyle, width: 160 }} value={filterJunior} onChange={e => setFilterJunior(e.target.value)}>
            <option value="All">All Access Levels</option>
            <option value="Junior Only">Junior-visible only</option>
            <option value="Senior Only">Senior/Full access only</option>
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Recipe Grid by Category */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Loading recipes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>No recipes found. Add your first recipe!</div>
        ) : (
          Object.entries(grouped).map(([cat, recs]) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CategoryBadge cat={cat} />
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{recs.length} recipe{recs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {recs.map(r => (
                  <div key={r.id} onClick={() => setViewRecipe(r)} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'box-shadow .15s', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>{r.name}</div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {r.junior_visible && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#d1fae5', color: '#065f46', letterSpacing: 0.5 }}>JUNIOR ✓</span>
                        )}
                        {!r.is_active && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', letterSpacing: 0.5 }}>INACTIVE</span>
                        )}
                      </div>
                    </div>
                    {r.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{r.description.length > 90 ? r.description.slice(0, 90) + '…' : r.description}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.serving_size && <span>🍽 {r.serving_size}</span>}
                      {r.prep_time && <span>⏱ {r.prep_time}</span>}
                      {Array.isArray(r.ingredients) && r.ingredients.length > 0 && <span>🧂 {r.ingredients.length} ingredients</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* VIEW MODAL */}
        <Modal open={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.name || ''} wide>
          {viewRecipe && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <CategoryBadge cat={viewRecipe.category} />
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
                <button onClick={() => { setConfirmDelete(viewRecipe.id) }} style={{ ...btnStyle(false), color: '#dc2626', border: '1px solid #fecaca' }}>Delete</button>
                <button onClick={() => { openEdit(viewRecipe); setViewRecipe(null) }} style={btnStyle(false)}>Edit</button>
                <button onClick={() => setViewRecipe(null)} style={btnStyle(true)}>Close</button>
              </div>
            </div>
          )}
        </Modal>

        {/* FORM MODAL */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Recipe' : 'New Recipe'} wide>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lStyle}>Recipe Name *</label>
                <input style={iStyle} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Matcha Latte" />
              </div>
              <div>
                <label style={lStyle}>Category</label>
                <select style={iStyle} value={form.category} onChange={e => setF('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
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

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.junior_visible} onChange={e => setF('junior_visible', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
                <span>Visible to Junior staff</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Junior Baristas, Sous Chef, Kitchen Staff)</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4576' }} />
                <span>Active</span>
              </label>
            </div>

            {/* Ingredients */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...lStyle, marginBottom: 0 }}>Ingredients</label>
                <button onClick={addIngredient} style={{ fontSize: 12, background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                <span>Ingredient</span><span>Qty</span><span>Unit</span><span></span>
              </div>
              {form.ingredients.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No ingredients yet.</div>}
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
              {form.steps.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No steps yet.</div>}
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
