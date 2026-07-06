'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱' + (parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'

const PRODUCT_VIEWS = [
  { id:'product',  label:'By Products' },
  { id:'category', label:'By Categories' },
  { id:'variant',  label:'By Variant' },
  { id:'sku',      label:'By SKU' },
]

export default function ProductPerformancePage() {
  const supabase = createClient()
  const [productPerf, setProductPerf] = useState([])
  const [productView, setProductView] = useState('product')
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState(null)
  const productFileRef = useRef()

  useEffect(() => { fetchProductPerf() }, [])

  async function fetchProductPerf() {
    const { data: pp } = await supabase.from('product_performance').select('*').order('net_sales', {ascending:false})
    setProductPerf(pp||[])
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),3500) }

  // ── PRODUCT PERFORMANCE CSV UPLOAD ──
  // StoreHub exports 4 separate pre-aggregated reports (Sales by Product/Category/Variant/SKU).
  // Each upload replaces the existing snapshot for that breakdown type.
  const num = v => { const n = parseFloat(String(v).replace(/,/g,'')); return isNaN(n) ? 0 : n }
  const clean = v => { const s = (v||'').trim(); return (!s || s.toUpperCase()==='N/A') ? null : s }

  function parsePeriodFromFilename(name) {
    const m = name.match(/(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/)
    return m ? [m[1], m[2]] : [null, null]
  }

  function detectBreakdownType(headers) {
    const h = headers.map(x=>x.toLowerCase())
    if (h.includes('variant_group_name')) return 'variant'
    if (h.includes('product_sku')) return 'sku'
    if (h.includes('product_name')) return 'product'
    if (h.includes('product_category')) return 'category'
    return null
  }

  function handleProductCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const lines = ev.target.result.replace(/^\uFEFF/,'').split('\n').filter(l=>l.trim())
      if (lines.length < 2) { showToast('⚠️','CSV appears to be empty'); return }
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))
      const breakdownType = detectBreakdownType(headers)
      if (!breakdownType) { showToast('❌',"Couldn't recognize this CSV — expected a StoreHub Sales by Product/Category/Variant/SKU export"); return }
      const [periodStart, periodEnd] = parsePeriodFromFilename(file.name)

      const idx = {}; headers.forEach((h,i)=>idx[h]=i)
      const val = (row, key) => idx[key]!==undefined ? row[idx[key]] : ''

      const rows = []
      for (let i=1;i<lines.length;i++) {
        const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        if (!vals.length || vals.every(v=>!v)) continue

        const base = {
          breakdown_type: breakdownType,
          quantity:          num(val(vals,'total_items_sold') || val(vals,'total_variant_options')),
          gross_sales:       num(val(vals,'total_sales')),
          sales_returned:    num(val(vals,'total_sales_returned')),
          discount_amount:   num(val(vals,'total_discount')),
          discount_pct:      num(val(vals,'discount')),
          net_sales:         num(val(vals,'item_net_sales')),
          avg_cost:          num(val(vals,'average_cost')),
          avg_net_sales:     num(val(vals,'average_net_sales')),
          gross_profit:      num(val(vals,'gross_profit')),
          gross_profit_pct:  num(val(vals,'gross_profit_')),
          period_start: periodStart,
          period_end:   periodEnd,
          uploaded_by: 'alex',
        }

        if (breakdownType==='category') {
          base.category = clean(val(vals,'product_category'))
        } else if (breakdownType==='product') {
          base.product_name = clean(val(vals,'product_name'))
          base.category     = clean(val(vals,'product_category'))
          base.sku          = clean(val(vals,'sku_id'))
          if (!base.product_name) continue
        } else if (breakdownType==='sku') {
          base.product_name = clean(val(vals,'product_name'))
          base.category     = clean(val(vals,'product_category'))
          base.sku           = clean(val(vals,'product_sku')) || clean(val(vals,'sku_id'))
          if (!base.product_name) continue
        } else if (breakdownType==='variant') {
          base.variant_group  = clean(val(vals,'variant_group_name'))
          base.variant_option = clean(val(vals,'variant_options'))
        }
        rows.push(base)
      }

      if (!rows.length) { showToast('⚠️','No valid rows found in CSV'); return }
      setSaving(true)
      const { error: delErr } = await supabase.from('product_performance').delete().eq('breakdown_type', breakdownType)
      if (delErr) { showToast('❌',delErr.message); setSaving(false); return }
      const { error } = await supabase.from('product_performance').insert(rows)
      if (error) { showToast('❌',error.message); setSaving(false); return }
      await fetchProductPerf()
      setProductView(breakdownType)
      showToast('✅',`${rows.length} rows imported — ${PRODUCT_VIEWS.find(v=>v.id===breakdownType)?.label}`)
      setSaving(false)
    }
    reader.readAsText(file)
    e.target.value=''
  }

  const rows = productPerf.filter(r=>r.breakdown_type===productView)
  const totalQty    = rows.reduce((a,r)=>a+(parseFloat(r.quantity)||0),0)
  const totalGrossP = rows.reduce((a,r)=>a+(parseFloat(r.gross_sales)||0),0)
  const totalNetP   = rows.reduce((a,r)=>a+(parseFloat(r.net_sales)||0),0)
  const totalNetAll = totalNetP || 1
  const periodStart = rows[0]?.period_start
  const periodEnd   = rows[0]?.period_end

  // Column config per breakdown type
  const colConfig = {
    product:  { nameLabel:'Product',  getName:r=>r.product_name||'—', getSub:r=>r.category||'Uncategorized' },
    category: { nameLabel:'Category', getName:r=>r.category||'Uncategorized', getSub:null },
    variant:  { nameLabel:'Variant',  getName:r=>r.variant_option||'—', getSub:r=>r.variant_group||'Ungrouped' },
    sku:      { nameLabel:'SKU',      getName:r=>r.sku||'No SKU', getSub:r=>r.product_name||'—' },
  }[productView]

  return (
    <AuthShell>
      <div className="topbar">
        <div>
          <div className="topbar-title">Product Performance</div>
          <div className="topbar-sub">StoreHub sales breakdown by product, category, variant &amp; SKU</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text-muted)'}}>{totalQty.toLocaleString()} units</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--matcha-dark)',fontWeight:700}}>{peso(totalNetP)} net</div>
          <label style={{display:'flex',alignItems:'center',gap:6,background:'#e8f0fb',border:'1px solid #4a90c4',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'#4a90c4',cursor:'pointer',whiteSpace:'nowrap'}}>
            {saving ? '⏳ Importing…' : '📂 Upload StoreHub Report CSV'}
            <input type="file" accept=".csv" ref={productFileRef} style={{display:'none'}} onChange={handleProductCSV} disabled={saving}/>
          </label>
        </div>
      </div>

      <div className="page-content">
        {periodStart && (
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14}}>
            📅 Report period: <strong>{fmtDate(periodStart)} – {fmtDate(periodEnd)}</strong> (from last upload — re-upload a new StoreHub export to update)
          </div>
        )}

        <div style={{display:'flex',gap:5,marginBottom:16}}>
          {PRODUCT_VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setProductView(v.id)}
              style={{padding:'7px 14px',borderRadius:7,border:`1px solid ${productView===v.id?'var(--espresso)':'var(--border)'}`,background:productView===v.id?'var(--espresso)':'transparent',color:productView===v.id?'var(--cream)':'var(--text-muted)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
              {v.label}
            </button>
          ))}
        </div>

        {rows.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>🛍️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No {PRODUCT_VIEWS.find(v=>v.id===productView)?.label.replace('By ','').toLowerCase()} data yet</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>Upload the matching StoreHub "Sales by {PRODUCT_VIEWS.find(v=>v.id===productView)?.label.replace('By ','')}" export CSV</div>
          </div>
        ):(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'var(--espresso)'}}>
                  {[colConfig.nameLabel,'Qty Sold','Gross Sales','Net Sales','Gross Profit %','% of Net'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>{
                  const pct = (parseFloat(r.net_sales)||0)/totalNetAll*100
                  return (
                  <tr key={r.id||i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600}}>{colConfig.getName(r)}</div>
                      {colConfig.getSub && <div style={{fontSize:10,color:'var(--text-muted)'}}>{colConfig.getSub(r)}</div>}
                    </td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--text-muted)'}}>{(parseFloat(r.quantity)||0).toLocaleString()}</td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:'var(--matcha-dark)',fontWeight:600}}>{peso(r.gross_sales)}</td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace"}}>{peso(r.net_sales)}</td>
                    <td style={{padding:'10px 14px',color:'var(--text-muted)'}}>{(parseFloat(r.gross_profit_pct)||0).toFixed(1)}%</td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,maxWidth:80,height:6,borderRadius:3,background:'var(--surface)',overflow:'hidden'}}>
                          <div style={{width:`${Math.min(100,pct)}%`,height:'100%',background:'var(--matcha-dark)'}}/>
                        </div>
                        <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'DM Mono',monospace"}}>{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--espresso)'}}>
                  <td style={{padding:'11px 14px',color:'var(--matcha-light)',fontWeight:700,fontSize:11}}>TOTAL</td>
                  <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{totalQty.toLocaleString()}</td>
                  <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--matcha-light)'}}>{peso(totalGrossP)}</td>
                  <td style={{padding:'11px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'#a8d672'}}>{peso(totalNetP)}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
