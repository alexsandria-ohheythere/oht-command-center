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
  const [toast, setToast] = useState(null)
  const fileRef = useRef()

  useEffect(()=>{ fetchSales() },[dateFrom,dateTo])

  async function fetchSales() {
    setLoading(true)
    const { data } = await supabase.from('sales').select('*').gte('sale_date',dateFrom).lte('sale_date',dateTo).order('sale_date',{ascending:false})
    setSales(data||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  function handleCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const lines = ev.target.result.split('\n').filter(l=>l.trim())
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))
      const rows = []
      for(let i=1;i<lines.length;i++){
        const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        const obj={}; headers.forEach((h,idx)=>{obj[h]=vals[idx]||''})
        const rawDate=obj.date||obj.sale_date||obj.transaction_date||''
        if(!rawDate) continue
        const d=new Date(rawDate); if(isNaN(d)) continue
        const gross=parseFloat(obj.gross_sales||obj.gross||obj.total||obj.amount||0)
        if(!gross) continue
        rows.push({sale_date:toISO(d),source:'storehub',gross_sales:gross,net_sales:parseFloat(obj.net_sales||obj.net||gross),transaction_count:parseInt(obj.transactions||obj.transaction_count||0)||0,uploaded_by:'alex'})
      }
      if(!rows.length){showToast('⚠️','No valid rows found');return}
      setSaving(true)
      const {error}=await supabase.from('sales').insert(rows)
      if(error){showToast('❌',error.message);setSaving(false);return}
      await fetchSales(); showToast('✅',`${rows.length} records imported`); setSaving(false)
    }
    reader.readAsText(file); e.target.value=''
  }

  async function saveSale() {
    if(!form.gross_sales){showToast('⚠️','Enter gross sales');return}
    setSaving(true)
    const {error}=await supabase.from('sales').insert([{...form,gross_sales:parseFloat(form.gross_sales)||0,net_sales:parseFloat(form.net_sales||form.gross_sales)||0,transaction_count:parseInt(form.transaction_count)||0,uploaded_by:'alex'}])
    if(error){showToast('❌',error.message);setSaving(false);return}
    await fetchSales(); setShowForm(false); setForm({sale_date:toISO(today),source:'storehub',gross_sales:'',net_sales:'',transaction_count:'',notes:''})
    showToast('✅','Sale added'); setSaving(false)
  }

  async function deleteSale(id){
    if(!confirm('Delete?'))return
    await supabase.from('sales').delete().eq('id',id)
    setSales(p=>p.filter(s=>s.id!==id)); showToast('🗑️','Deleted')
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
          <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
            📂 Upload CSV <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV}/>
          </label>
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>+ Add Sale</button>
        </div>
      </div>
      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{marginBottom:16}}>
          {[
            {label:'Gross Sales',   value:peso(totalGross), cls:'c-matcha', icon:'💰'},
            {label:'Net Sales',     value:peso(totalNet),   cls:'c-gold',   icon:'📈'},
            {label:'Transactions',  value:totalTxns,        cls:'c-blush',  icon:'🧾'},
            {label:'Avg per Day',   value:peso(totalNet/Math.max(1,sales.length)), cls:'c-bark', icon:'📅'},
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

        {/* Table */}
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:sales.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>💰</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No sales records yet</div>
          </div>
        ):(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--espresso)'}}>
                {['Date','Source','Gross Sales','Net Sales','Transactions','Notes',''].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sales.map((s,i)=>{
                  const src=SOURCES.find(x=>x.id===s.source)||SOURCES[0]
                  return(
                    <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtDate(s.sale_date)}</td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:src.color+'22',color:src.color}}>{src.label}</span></td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{peso(s.gross_sales)}</td>
                      <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace"}}>{peso(s.net_sales)}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)'}}>{s.transaction_count||'—'}</td>
                      <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:11}}>{s.notes||'—'}</td>
                      <td style={{padding:'10px 14px'}}><button onClick={()=>deleteSale(s.id)} style={{background:'transparent',border:'none',color:'var(--border)',cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.target.style.color='#c0392b'} onMouseLeave={e=>e.target.style.color='var(--border)'}>🗑</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr style={{background:'var(--espresso)'}}>
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
      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
