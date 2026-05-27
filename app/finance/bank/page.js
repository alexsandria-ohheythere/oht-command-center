'use client'
import { useState, useEffect, useRef } from 'react'
import AuthShell from '../../../components/AuthShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'
const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}

export default function BankPage() {
  const supabase = createClient()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(toISO(new Date(today.getFullYear(),today.getMonth(),1)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [toast, setToast]       = useState(null)
  const fileRef = useRef()

  useEffect(()=>{ fetchRecords() },[dateFrom,dateTo])

  async function fetchRecords() {
    setLoading(true)
    const {data} = await supabase.from('bank_records').select('*').gte('transaction_date',dateFrom).lte('transaction_date',dateTo).order('transaction_date',{ascending:false})
    setRecords(data||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}

  function handleCSV(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const allLines = ev.target.result.split('\n')
      const rows = []
      const isUnionBank = allLines[0]?.includes('ACCOUNT DETAILS')

      if (isUnionBank) {
        let headerIdx = allLines.findIndex(l=>l.includes('Transaction Date'))
        if(headerIdx===-1){showToast('⚠️','Could not find headers');return}
        for(let i=headerIdx+1;i<allLines.length;i++){
          const line=allLines[i].trim(); if(!line) continue
          const vals=[]; let cur='',inQ=false
          for(let c=0;c<line.length;c++){
            if(line[c]==='"'){inQ=!inQ}
            else if(line[c]===','&&!inQ){vals.push(cur.trim());cur=''}
            else{cur+=line[c]}
          }
          vals.push(cur.trim())
          if(vals.length<8) continue
          const rawDate=vals[0]||''; if(!rawDate||!rawDate.includes('-')) continue
          const d=new Date(rawDate); if(isNaN(d)) continue
          const txDate=toISO(d)
          const desc=vals[3]||''
          const debit=parseFloat(vals[5])||0
          const credit=parseFloat(vals[6])||0
          const balance=parseFloat(vals[7])||0
          const txId=vals[2]||''
          const senderName=vals[13]||''
          let cleanDesc=desc
          if(senderName&&senderName!=='HEAD OFFICE SOL'&&senderName!=='HO TREASURY SOL'&&!desc.includes(senderName.split(' ')[0])){
            cleanDesc=desc+' — '+senderName
          }
          rows.push({transaction_date:txDate,description:cleanDesc,debit,credit,balance,reference:txId,bank_name:'UnionBank'})
        }
      } else {
        const lines=allLines.filter(l=>l.trim())
        const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''))
        for(let i=1;i<lines.length;i++){
          const vals=lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''))
          const obj={}; headers.forEach((h,idx)=>{obj[h]=vals[idx]||''})
          const rawDate=obj.date||obj.transaction_date||obj.value_date||''
          if(!rawDate) continue
          const d=new Date(rawDate); if(isNaN(d)) continue
          rows.push({transaction_date:toISO(d),description:obj.description||obj.details||'',debit:parseFloat(obj.debit||obj.debits||0)||0,credit:parseFloat(obj.credit||obj.credits||0)||0,balance:parseFloat(obj.balance||obj.ending_balance||0)||0,reference:obj.reference||obj.transaction_id||'',bank_name:'Bank'})
        }
      }
      if(!rows.length){showToast('⚠️','No valid rows found');return}
      setSaving(true)
      const {error}=await supabase.from('bank_records').insert(rows)
      if(error){showToast('❌',error.message);setSaving(false);return}
      await fetchRecords(); showToast('✅',`${rows.length} transactions imported`); setSaving(false)
    }
    reader.readAsText(file); e.target.value=''
  }

  async function clearAll() {
    if(!confirm('Delete all bank records in this date range?'))return
    await supabase.from('bank_records').delete().gte('transaction_date',dateFrom).lte('transaction_date',dateTo)
    setRecords([]); showToast('🗑️','Records cleared')
  }

  const filtered = search ? records.filter(r=>(r.description||'').toLowerCase().includes(search.toLowerCase())||(r.reference||'').toLowerCase().includes(search.toLowerCase())) : records
  const totalDebits  = filtered.reduce((a,r)=>a+(parseFloat(r.debit)||0),0)
  const totalCredits = filtered.reduce((a,r)=>a+(parseFloat(r.credit)||0),0)
  const latestBalance = filtered[0]?.balance || 0

  return (
    <AuthShell>
      <div className="topbar">
        <div><div className="topbar-title">Bank Records</div><div className="topbar-sub">{records.length} transactions · UnionBank OHT Cafe</div></div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iStyle,width:'auto',padding:'6px 10px'}}/>
          {records.length>0&&<button className="btn btn-danger" onClick={clearAll}>Clear All</button>}
          <label style={{display:'flex',alignItems:'center',gap:6,background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'var(--sky)',cursor:'pointer'}}>
            📂 Upload Statement <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}} onChange={handleCSV}/>
          </label>
        </div>
      </div>
      <div className="page-content">
        <div className="kpi-grid" style={{marginBottom:16}}>
          {[
            {label:'Latest Balance', value:peso(latestBalance),  cls:'c-matcha', icon:'💰'},
            {label:'Total Debits',   value:peso(totalDebits),    cls:'c-blush',  icon:'📤'},
            {label:'Total Credits',  value:peso(totalCredits),   cls:'c-gold',   icon:'📥'},
            {label:'Transactions',   value:filtered.length,      cls:'c-bark',   icon:'🔢'},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{fontSize:20}}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--text-muted)'}}>🔍</span>
            <input style={{...iStyle,paddingLeft:36}} placeholder="Search description or reference…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>

        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:records.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>🏦</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,marginBottom:6}}>No bank records yet</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>✅ UnionBank format supported</div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>Upload your bank statement CSV to get started</div>
          </div>
        ):(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--espresso)'}}>
                {['Date','Description','Reference','Debit','Credit','Balance'].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--matcha-light)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--white)':'var(--surface)'}}>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:600,whiteSpace:'nowrap'}}>{fmtDate(r.transaction_date)}</td>
                    <td style={{padding:'10px 14px',fontWeight:500,maxWidth:280}}>{r.description||'—'}</td>
                    <td style={{padding:'10px 14px',color:'var(--text-muted)',fontSize:10,fontFamily:"'DM Mono',monospace"}}>{r.reference||'—'}</td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:r.debit>0?'#c0392b':'var(--text-muted)',fontWeight:r.debit>0?600:400}}>{r.debit>0?peso(r.debit):'—'}</td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",color:r.credit>0?'var(--matcha-dark)':'var(--text-muted)',fontWeight:r.credit>0?600:400}}>{r.credit>0?peso(r.credit):'—'}</td>
                    <td style={{padding:'10px 14px',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{peso(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'var(--espresso)',color:'var(--cream)',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </AuthShell>
  )
}
