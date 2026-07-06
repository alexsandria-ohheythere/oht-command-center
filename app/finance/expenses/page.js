'use client'
import { useState, useEffect } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}
const PAYMENT_METHODS = ['Cash','Gcash - OHT','Union - OHT Cafe','Union - Alexsandria']

const emptyForm = today => ({
  expense_date:toISO(today), category_id:'', description:'', amount:'',
  company:'', payment_method:'', paid_by:'alex', notes:'', receipt_url:'',
  tin:'', address:'', discount:'0', vat_type:'', vatable_sales:'', vat_amount:''
})

export default function ExpensesPage() {
  const supabase = createClient()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(toISO(new Date(today.getFullYear(),today.getMonth(),1)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [allTime, setAllTime]   = useState(false)
  const [expenses, setExpenses]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [showTaxFields, setShowTaxFields] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [catFilter, setCatFilter]   = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState(emptyForm(today))
  const [catForm, setCatForm] = useState({name:'',color:'#7ab648',icon:'📦'})
  const [toast, setToast] = useState(null)

  useEffect(()=>{ fetchAll() },[dateFrom,dateTo,allTime])

  async function fetchAll() {
    setLoading(true)
    let q = supabase.from('expenses').select('*, expense_categories(name,color,icon)').order('expense_date',{ascending:false})
    if(!allTime) q = q.gte('expense_date',dateFrom).lte('expense_date',dateTo)
    const [{data:e},{data:c}] = await Promise.all([
      q,
      supabase.from('expense_categories').select('*').eq('is_active',true).order('name'),
    ])
    setExpenses(e||[]); setCategories(c||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))
  const cv = k => e => setCatForm(p=>({...p,[k]:e.target.value}))

  async function saveExpense() {
    if(!form.description||!form.amount){showToast('⚠️','Fill in description and amount');return}
    setSaving(true)
    const payload = {
      expense_date:form.expense_date,
      category_id:form.category_id||null,
      description:form.description,
      amount:parseFloat(form.amount)||0,
      company:form.company||null,
      payment_method:form.payment_method||null,
      paid_by:form.paid_by,
      notes:form.notes||null,
      receipt_url:form.receipt_url||null,
      tin:form.tin||null,
      address:form.address||null,
      discount:parseFloat(form.discount)||0,
      vat_type:form.vat_type||null,
      vatable_sales:form.vatable_sales?parseFloat(form.vatable_sales):null,
      vat_amount:form.vat_amount?parseFloat(form.vat_amount):null,
    }
    const {error}=await supabase.from('expenses').insert([payload])
    if(error){showToast('❌',error.message);setSaving(false);return}
    await fetchAll(); setShowForm(false); setShowTaxFields(false)
    setForm(emptyForm(today))
    showToast('✅','Expense added'); setSaving(false)
  }

  async function saveCategory() {
    if(!catForm.name){showToast('⚠️','Enter category name');return}
    const {error}=await supabase.from('expense_categories').insert([catForm])
    if(error){showToast('❌',error.message);return}
    await fetchAll(); setShowCatForm(false); setCatForm({name:'',color:'#7ab648',icon:'📦'})
    showToast('✅','Category added')
  }

  async function deleteExpense(id) {
    if(!confirm('Delete?'))return
    await supabase.from('expenses').delete().eq('id',id)
    setExpenses(p=>p.filter(e=>e.id!==id)); showToast('🗑️','Deleted')
  }

  const filtered = catFilter ? expenses.filter(e=>e.category_id===catFilter) : expenses
  const total = filtered.reduce((a,e)=>a+(parseFloat(e.amount)||0),0)

  // Category summary — count, total, % of grand total
  const breakdown = categories.map(c=>{
    const rows = expenses.filter(e=>e.category_id===c.id)
    return {...c, count:rows.length, total: rows.reduce((a,e)=>a+(parseFloat(e.amount)||0),0)}
  }).filter(c=>c.total>0).sort((a,b)=>b.total-a.total)
  const grandTotal = expenses.reduce((a,e)=>a+(parseFloat(e.amount)||0),0)

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Expenses</div><div className="topbar-sub">{expenses.length} entries · {allTime?'All time':`${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`}</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          {!allTime&&<>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          </>}
          <button onClick={()=>setAllTime(!allTime)} style={{background:allTime?'var(--espresso)':'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:11,fontWeight:600,color:allTime?'var(--cream)':'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>All Time</button>
          <button onClick={()=>setShowCatForm(!showCatForm)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:11,fontWeight:600,color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>⚙️ Categories</button>
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ Add Expense</button>
        </div>
      </div>

      <div className="page-content">
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:16}}>
          {/* Left: table */}
          <div>
            {/* Category filter pills */}
            <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
              <button onClick={()=>setCatFilter('')} style={{padding:'5px 11px',borderRadius:20,border:`1px solid ${!catFilter?'var(--espresso)':'var(--border)'}`,background:!catFilter?'var(--espresso)':'transparent',color:!catFilter?'var(--cream)':'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>All</button>
              {categories.map(c=>(
                <button key={c.id} onClick={()=>setCatFilter(c.id===catFilter?'':c.id)}
                  style={{padding:'5px 11px',borderRadius:20,border:`1px solid ${catFilter===c.id?c.color:'var(--border)'}`,background:catFilter===c.id?c.color+'22':'transparent',color:catFilter===c.id?c.color:'var(--text-muted)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>

            {/* Add form */}
            {showForm&&(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px',marginBottom:12}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:14}}>Add Expense</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div><label style={lStyle}>Date</label><input style={iStyle} type="date" value={form.expense_date} onChange={fv('expense_date')}/></div>
                  <div><label style={lStyle}>Amount</label><input style={iStyle} type="number" placeholder="0.00" value={form.amount} onChange={fv('amount')}/></div>
                  <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Description</label><input style={iStyle} placeholder="What was this for?" value={form.description} onChange={fv('description')}/></div>
                  <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Vendor / Company (optional)</label><input style={iStyle} placeholder="e.g. Puregold, Grab, Meralco" value={form.company} onChange={fv('company')}/></div>
                  <div>
                    <label style={lStyle}>Category</label>
                    <select style={iStyle} value={form.category_id} onChange={fv('category_id')}>
                      <option value="">Uncategorized</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Payment Method</label>
                    <select style={iStyle} value={form.payment_method} onChange={fv('payment_method')}>
                      <option value="">—</option>
                      {PAYMENT_METHODS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Paid By</label>
                    <div style={{display:'flex',gap:7}}>
                      {[['alex','Alex'],['cj','CJ']].map(([val,label])=>(
                        <div key={val} onClick={()=>setForm(p=>({...p,paid_by:val}))} style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${form.paid_by===val?'var(--matcha)':'var(--border)'}`,background:form.paid_by===val?'var(--matcha-pale)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:form.paid_by===val?'var(--matcha-dark)':'var(--text-muted)',transition:'all .15s'}}>{label}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Receipt (Google Drive link)</label><input style={iStyle} placeholder="https://drive.google.com/..." value={form.receipt_url} onChange={fv('receipt_url')}/></div>
                </div>

                <button onClick={()=>setShowTaxFields(!showTaxFields)} style={{background:'none',border:'none',color:'var(--sky)',fontSize:11,fontWeight:600,cursor:'pointer',padding:0,marginBottom:showTaxFields?10:0,fontFamily:"'DM Sans',sans-serif"}}>
                  {showTaxFields?'− Hide':'+ Add'} tax / OR details
                </button>

                {showTaxFields&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10,padding:'12px',background:'var(--surface)',borderRadius:8}}>
                    <div><label style={lStyle}>TIN</label><input style={iStyle} placeholder="000-000-000-000" value={form.tin} onChange={fv('tin')}/></div>
                    <div><label style={lStyle}>Discount</label><input style={iStyle} type="number" placeholder="0.00" value={form.discount} onChange={fv('discount')}/></div>
                    <div style={{gridColumn:'1/-1'}}><label style={lStyle}>Vendor Address</label><input style={iStyle} placeholder="Business address on the OR" value={form.address} onChange={fv('address')}/></div>
                    <div>
                      <label style={lStyle}>VAT Type</label>
                      <select style={iStyle} value={form.vat_type} onChange={fv('vat_type')}>
                        <option value="">—</option>
                        <option value="inclusive">Inclusive</option>
                        <option value="exclusive">Exclusive</option>
                      </select>
                    </div>
                    <div><label style={lStyle}>Vatable Sales</label><input style={iStyle} type="number" placeholder="0.00" value={form.vatable_sales} onChange={fv('vatable_sales')}/></div>
                    <div><label style={lStyle}>VAT Amount</label><input style={iStyle} type="number" placeholder="0.00" value={form.vat_amount} onChange={fv('vat_amount')}/></div>
                  </div>
                )}

                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-secondary" onClick={()=>{setShowForm(false);setShowTaxFields(false)}}>Cancel</button>
                  <button className="btn btn-primary" style={{flex:1}} onClick={saveExpense} disabled={saving}>{saving?'Saving…':'✓ Add Expense'}</button>
                </div>
              </div>
            )}

            {/* Category manager */}
            {showCatForm&&(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px',marginBottom:12}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:10}}>Manage Categories</div>
                <div style={{marginBottom:12}}>
                  {categories.map(c=>(
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'var(--surface)',borderRadius:8,marginBottom:5}}>
                      <span>{c.icon}</span><span style={{flex:1,fontSize:12,fontWeight:600}}>{c.name}</span>
                      <div style={{width:12,height:12,borderRadius:'50%',background:c.color}}/>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
                  <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>Add New</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:8,alignItems:'center'}}>
                    <input style={iStyle} placeholder="Category name" value={catForm.name} onChange={cv('name')}/>
                    <input style={{...iStyle,width:42,padding:'9px 6px',textAlign:'center'}} placeholder="📦" value={catForm.icon} onChange={cv('icon')}/>
                    <input type="color" value={catForm.color} onChange={cv('color')} style={{width:38,height:38,borderRadius:7,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                    <button className="btn btn-primary" onClick={saveCategory}>Add</button>
                  </div>
                </div>
              </div>
            )}

            {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:filtered.length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>🧾</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700}}>No expenses yet</div>
              </div>
            ):(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--espresso)'}}>
                    {['Date','Category','Description','Vendor','Amount','Payment',''].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map((e,i)=>{
                      const cat=e.expense_categories
                      const expanded = expandedId===e.id
                      const hasDetails = e.tin||e.address||e.vat_type||e.discount>0||e.receipt_url||e.uploader||e.owner
                      return(
                        <>
                        <tr key={e.id} style={{borderBottom:expanded?'none':'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                          <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(e.expense_date)}</td>
                          <td style={{padding:'9px 12px'}}>{cat?<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:cat.color+'22',color:cat.color}}>{cat.icon} {cat.name}</span>:<span style={{color:'var(--text-muted)',fontSize:10}}>—</span>}</td>
                          <td style={{padding:'9px 12px',fontWeight:500}}>{e.description}</td>
                          <td style={{padding:'9px 12px',color:'var(--text-muted)'}}>{e.company||'—'}</td>
                          <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#c0392b'}}>{peso(e.amount)}</td>
                          <td style={{padding:'9px 12px',color:'var(--text-muted)'}}>{e.payment_method||(e.paid_by?e.paid_by.charAt(0).toUpperCase()+e.paid_by.slice(1):'—')}</td>
                          <td style={{padding:'9px 12px',whiteSpace:'nowrap'}}>
                            {hasDetails&&<button onClick={()=>setExpandedId(expanded?null:e.id)} style={{background:'transparent',border:'none',color:'var(--sky)',cursor:'pointer',fontSize:10,fontWeight:600,marginRight:8}}>{expanded?'Hide':'Details'}</button>}
                            <button onClick={()=>deleteExpense(e.id)} style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:13}} onMouseEnter={x=>x.target.style.color='#c0392b'} onMouseLeave={x=>x.target.style.color='var(--border)'}>🗑</button>
                          </td>
                        </tr>
                        {expanded&&(
                          <tr key={e.id+'-details'} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                            <td colSpan={7} style={{padding:'4px 12px 14px 12px'}}>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'6px 18px',fontSize:11,background:'var(--cream)',borderRadius:8,padding:'10px 14px'}}>
                                {e.tin&&<div><span style={{color:'var(--text-muted)'}}>TIN: </span><span style={{fontFamily:"'DM Mono',monospace"}}>{e.tin}</span></div>}
                                {e.discount>0&&<div><span style={{color:'var(--text-muted)'}}>Discount: </span>{peso(e.discount)}</div>}
                                {e.vat_type&&<div><span style={{color:'var(--text-muted)'}}>VAT: </span>{e.vat_type} {e.vat_amount?`(${peso(e.vat_amount)})`:''}</div>}
                                {e.uploader&&<div><span style={{color:'var(--text-muted)'}}>Uploaded by: </span>{e.uploader}</div>}
                                {e.owner&&<div><span style={{color:'var(--text-muted)'}}>Owner: </span>{e.owner}</div>}
                                {e.receipt_url&&<div><a href={e.receipt_url} target="_blank" rel="noreferrer" style={{color:'var(--sky)',fontWeight:600,textDecoration:'none'}}>📎 View receipt</a></div>}
                                {e.address&&<div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Address: </span>{e.address}</div>}
                                {e.notes&&<div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Notes: </span>{e.notes}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                        </>
                      )
                    })}
                  </tbody>
                  <tfoot><tr style={{background:'var(--espresso)'}}>
                    <td colSpan={4} style={{padding:'10px 12px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                    <td style={{padding:'10px 12px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#f5a0a0'}}>{peso(total)}</td>
                    <td colSpan={2}/>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Right: category summary */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'18px'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:4}}>Total Expenses</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:700,color:'#c0392b',marginBottom:16}}>{peso(grandTotal)}</div>

              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,marginBottom:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>By Category</div>
              {breakdown.length===0?<div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No data yet</div>:breakdown.map(c=>{
                const pct=grandTotal>0?Math.round((c.total/grandTotal)*100):0
                return(
                  <div key={c.id} onClick={()=>setCatFilter(c.id===catFilter?'':c.id)} style={{marginBottom:10,cursor:'pointer'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                      <span style={{fontWeight:500}}>{c.icon} {c.name} <span style={{color:'var(--text-muted)',fontWeight:400}}>× {c.count}</span></span>
                      <span style={{fontFamily:"'DM Mono',monospace",color:c.color,fontWeight:600}}>{peso(c.total)} <span style={{color:'var(--text-muted)',fontWeight:400}}>({pct}%)</span></span>
                    </div>
                    <div style={{height:5,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:c.color,borderRadius:4}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
