'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'

const SOURCES = [
  { id:'storehub', label:'StoreHub', color:'#4a90c4' },
  { id:'utak',     label:'Utak',     color:'#7ab648' },
  { id:'peddler',  label:'Peddler',  color:'#e8845a' },
  { id:'manual',   label:'Manual',   color:'#8e44ad' },
]

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}
const lStyle = {display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}

export default function SalesPage() {
  const supabase = createClient()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(toISO(new Date(today.getFullYear(),today.getMonth(),1)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [sales, setSales]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({sale_date:toISO(today),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
  const [toast, setToast]       = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [deleteModal, setDeleteModal] = useState(null) // { mode:'single'|'bulk', id? }
  const fileRef = useRef()

  useEffect(()=>{ fetchSales() },[dateFrom,dateTo])

  async function fetchSales() {
    setLoading(true)
    const { data } = await supabase.from('sales').select('*').gte('sale_date',dateFrom).lte('sale_date',dateTo).order('sale_date',{ascending:false})
    setSales(data||[])
    setSelected(new Set())
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  // Parse StoreHub date: "1 May 2026 (Fri)" → "2026-05-01"
  function parseStoreHubDate(raw) {
    const clean = raw.replace(/\s*\(.*?\)/, '').trim()
    const d = new Date(clean)
    return isNaN(d) ? null : toISO(d)
  }

  function handleCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const text = ev.target.result.replace(/^\uFEFF/, '') // strip BOM
      const lines = text.split('\n').filter(l=>l.trim())
      const rawHeaders = lines[0].split(',').map(h=>h.trim())

      // Map StoreHub exact column names
      const col = {}
      rawHeaders.forEach((h, i) => {
        const n = h.toLowerCase()
        if (n === 'date / time' || n === 'date')  col.date = i
        if (n === 'total sales')                   col.gross = i
        if (n === 'net sales')                     col.net = i
        if (n === 'total transactions')            col.txns = i
        if (n === 'total discount')                col.discount = i
        if (n === 'tax')                           col.tax = i
      })

      if (col.date === undefined) {
        showToast('⚠️', 'Date column not found — is this a StoreHub CSV?')
        return
      }

      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const rawDate = vals[col.date] || ''
        if (!rawDate) continue
        const saleDate = parseStoreHubDate(rawDate)
        if (!saleDate) continue
        const gross = parseFloat(vals[col.gross] || 0)
        if (!gross) continue
        const notes = [
          col.discount !== undefined && parseFloat(vals[col.discount]||0) ? `Discount: ₱${parseFloat(vals[col.discount]).toFixed(2)}` : '',
          col.tax      !== undefined && parseFloat(vals[col.tax]||0)      ? `Tax: ₱${parseFloat(vals[col.tax]).toFixed(2)}`           : '',
        ].filter(Boolean).join(' · ')
        rows.push({
          sale_date:         saleDate,
          source:            'storehub',
          gross_sales:       gross,
          net_sales:         parseFloat(vals[col.net] || gross),
          transaction_count: parseInt(vals[col.txns]  || 0) || 0,
          notes:             notes || null,
          uploaded_by:       'alex',
        })
      }

      if (!rows.length) { showToast('⚠️', 'No valid rows found'); return }
      setSaving(true)
      const { error } = await supabase.from('sales').insert(rows)
      if (error) { showToast('❌', error.message); setSaving(false); return }
      await fetchSales()
      showToast('✅', `${rows.length} StoreHub records imported`)
      setSaving(false)
    }
    reader.readAsText(file); e.target.value = ''
  }

  async function saveSale() {
    if(!form.gross_sales){showToast('⚠️','Enter gross sales');return}
    setSaving(true)
    const {error}=await supabase.from('sales').insert([{...form,gross_sales:parseFloat(form.gross_sales)||0,net_sales:parseFloat(form.net_sales||form.gross_sales)||0,transaction_count:parseInt(form.transaction_count)||0,uploaded_by:'alex'}])
    if(error){showToast('❌',error.message);setSaving(false);return}
    await fetchSales(); setShowForm(false); setForm({sale_date:toISO(today),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
    showToast('✅','Sale added'); setSaving(false)
  }

  async function confirmDeleteAction() {
    if (!deleteModal) return
    setSaving(true)
    if (deleteModal.mode === 'single') {
      await supabase.from('sales').delete().eq('id', deleteModal.id)
      setSales(p=>p.filter(s=>s.id!==deleteModal.id))
      showToast('🗑️','Record deleted')
    } else {
      const ids = [...selected]
      await supabase.from('sales').delete().in('id', ids)
      setSales(p=>p.filter(s=>!ids.includes(s.id)))
      setSelected(new Set())
      showToast('🗑️',`${ids.length} records deleted`)
    }
    setDeleteModal(null)
    setSaving(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === sales.length) setSelected(new Set())
    else setSelected(new Set(sales.map(s=>s.id)))
  }

  const totalGross = sales.reduce((a,s)=>a+(parseFloat(s.gross_sales)||0),0)
  const totalNet   = sales.reduce((a,s)=>a+(parseFloat(s.net_sales)||0),0)
  const totalTxns  = sales.reduce((a,s)=>a+(parseInt(s.transaction_count)||0),0)

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Sales</div><div className="topbar-sub">{sales.length} records · {fmtDate(dateFrom)} – {fmtDate(dateTo)}</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <label style={{display:'flex',alignItems:'center',gap:6,background:'#e8f0fb',border:'1px solid #4a90c4',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'#4a90c4',cursor:'pointer',whiteSpace:'nowrap'}}>
            {saving ? '⏳ Importing…' : '📂 Upload StoreHub CSV'}
            <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV} disabled={saving}/>
          </label>
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ Add Sale</button>
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{marginBottom:16}}>
          {[
            {label:'Gross Sales',  value:peso(totalGross), cls:'c-matcha', icon:'💰'},
            {label:'Net Sales',    value:peso(totalNet),   cls:'c-gold',   icon:'📈'},
            {label:'Transactions', value:totalTxns,        cls:'c-blush',  icon:'🧾'},
            {label:'Avg per Day',  value:peso(totalNet/Math.max(1,sales.length)), cls:'c-bark', icon:'📅'},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showForm&&(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>Add Sale Record</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
              <div><label style={lStyle}>Date</label><input style={iStyle} type="date" value={form.sale_date} onChange={fv('sale_date')}/></div>
              <div><label style={lStyle}>Gross Sales</label><input style={iStyle} type="number" placeholder="0.00" value={form.gross_sales} onChange={fv('gross_sales')}/></div>
              <div><label style={lStyle}>Net Sales</label><input style={iStyle} type="number" placeholder="Same as gross" value={form.net_sales} onChange={fv('net_sales')}/></div>
              <div><label style={lStyle}>Transactions</label><input style={iStyle} type="number" placeholder="0" value={form.transaction_count} onChange={fv('transaction_count')}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'end'}}>
              <div>
                <label style={lStyle}>Source</label>
                <div style={{display:'flex',gap:7}}>
                  {SOURCES.map(src=>(
                    <div key={src.id} onClick={()=>setForm(p=>({...p,source:src.id}))} style={{padding:'7px 12px',borderRadius:8,border:`1.5px solid ${form.source===src.id?src.color:'var(--border)'}`,background:form.source===src.id?src.color+'22':'var(--surface)',cursor:'pointer',fontSize:11,fontWeight:600,color:form.source===src.id?src.color:'var(--text-muted)',transition:'all .15s'}}>
                      {src.label}
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSale} disabled={saving}>{saving?'Saving…':'✓ Add'}</button>
            </div>
          </div>
        )}

        {/* Bulk delete bar */}
        {selected.size > 0 && (
          <div style={{background:'#fdeaea',border:'1px solid #f5c6c6',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:12,fontWeight:600,color:'#c0392b',flex:1}}>{selected.size} record{selected.size!==1?'s':''} selected</span>
            <button onClick={()=>setSelected(new Set())} style={{background:'none',border:'1px solid #f5c6c6',borderRadius:7,padding:'5px 12px',fontSize:11,color:'#c0392b',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              Deselect all
            </button>
            <button onClick={()=>setDeleteModal({mode:'bulk'})} style={{background:'#c0392b',border:'none',borderRadius:7,padding:'6px 14px',fontSize:11,fontWeight:700,color:'white',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              🗑️ Delete {selected.size} record{selected.size!==1?'s':''}
            </button>
          </div>
        )}

        {/* Table */}
        {loading?(
          <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>
        ):sales.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>💰</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No sales records yet</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Upload a StoreHub CSV or add a record manually</div>
          </div>
        ):(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--espresso)'}}>
                <th style={{padding:'11px 14px',width:36}}>
                  <input type="checkbox" checked={selected.size===sales.length&&sales.length>0} onChange={toggleSelectAll}
                    style={{cursor:'pointer',accentColor:'#EF4576'}}/>
                </th>
                {['Date','Source','Gross Sales','Net Sales','Transactions','Notes',''].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sales.map((s,i)=>{
                  const src=SOURCES.find(x=>x.id===s.source)||SOURCES[0]
                  const isSelected = selected.has(s.id)
                  return(
                    <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:isSelected?'#fef3f3':i%2===0?'var(--white)':'var(--surface)',transition:'background .1s'}}>
                      <td style={{padding:'10px 14px'}}>
                        <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(s.id)}
                          style={{cursor:'pointer',accentColor:'#EF4576'}}/>
                      </td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(s.sale_date)}</td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:src.color+'22',color:src.color}}>{src.label}</span></td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{peso(s.gross_sales)}</td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace"}}>{peso(s.net_sales)}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)'}}>{s.transaction_count||'—'}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:11,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.notes||'—'}</td>
                      <td style={{padding:'10px 14px'}}>
                        <button onClick={()=>setDeleteModal({mode:'single',id:s.id})}
                          style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14,transition:'color .15s'}}
                          onMouseEnter={e=>e.target.style.color='#c0392b'}
                          onMouseLeave={e=>e.target.style.color='var(--border)'}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr style={{background:'var(--espresso)'}}>
                <td/>
                <td colSpan={2} style={{padding:'11px 14px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totalGross)}</td>
                <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672'}}>{peso(totalNet)}</td>
                <td style={{padding:'11px 14px',color:'var(--matcha-light)',fontFamily:"'DM Mono',monospace"}}>{totalTxns}</td>
                <td colSpan={2}/>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
          <div style={{background:'var(--white)',borderRadius:16,padding:'28px 32px',maxWidth:380,width:'90%',boxShadow:'0 24px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontSize:28,marginBottom:12,textAlign:'center'}}>🗑️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:8,textAlign:'center'}}>
              {deleteModal.mode==='bulk' ? `Delete ${selected.size} records?` : 'Delete this record?'}
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:24,textAlign:'center',lineHeight:1.6}}>
              {deleteModal.mode==='bulk'
                ? `This will permanently remove ${selected.size} sales record${selected.size!==1?'s':''} from the database.`
                : 'This will permanently remove this sales record from the database.'}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDeleteModal(null)}
                style={{flex:1,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9,padding:11,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                Cancel
              </button>
              <button onClick={confirmDeleteAction} disabled={saving}
                style={{flex:1,background:'#c0392b',border:'none',borderRadius:9,padding:11,fontSize:12,fontWeight:700,color:'white',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
