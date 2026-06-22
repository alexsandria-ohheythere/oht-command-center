'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { can } from '../lib/auth'
import { useState, useEffect } from 'react'

const ROLE_PROFILES = {
  'ohheythere.matcha@gmail.com': { name:'Alex',     role:'Managing Director', color:'#7ab648', initials:'A' },
  'ohheythere.group@gmail.com':  { name:'CJ',       role:'CEO',               color:'#4a90c4', initials:'CJ' },
  'hr.ohtgroup@gmail.com':       { name:'Richelle', role:'Human Resources',   color:'#e8845a', initials:'R'  },
}

export default function Sidebar({ user, userRole, onClose }) {
  const router   = useRouter()
  const pathname = usePathname()
  const role     = userRole?.role || 'staff'
  const [navOverrides, setNavOverrides] = useState({})

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('value').eq('key','sidebar_nav').single()
      .then(({ data }) => {
        if (data?.value) {
          const saved = JSON.parse(data.value)
          const map = {}
          saved.forEach(item => { map[item.id] = item })
          setNavOverrides(map)
        }
      })
  }, [])

  const profile = ROLE_PROFILES[user?.email] || {
    name: user?.email?.split('@')[0] || 'User',
    role: role.charAt(0).toUpperCase() + role.slice(1),
    color: '#7ab648',
    initials: (user?.email||'U')[0].toUpperCase(),
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isActive = href => {
    if (href === '/dashboard') return pathname === href
    if (href === '/finance') return pathname === '/finance'
    return pathname.startsWith(href)
  }

  const NAV_BASE = [
    { type:'section', label:'Overview' },
    { type:'link', id:'dashboard',        href:'/dashboard',              icon:'🏠', label:'Dashboard',           show: true },

    { type:'section', label:'Finance', show: can(role,'finance') },
    { type:'link', id:'finance',          href:'/finance',                icon:'📊', label:'Financial Statement',  show: can(role,'finance') },
    { type:'link', id:'sales',            href:'/finance/sales',          icon:'💰', label:'Sales',                show: can(role,'finance') },
    { type:'link', id:'expenses',         href:'/finance/expenses',       icon:'🧾', label:'Expenses',             show: can(role,'finance') },
    { type:'link', id:'forecast',         href:'/finance/forecast',       icon:'📈', label:'Forecast',             show: can(role,'finance') },
    { type:'link', id:'bank',             href:'/finance/bank',           icon:'🏦', label:'Bank Records',         show: can(role,'finance') },
    { type:'link', id:'cogs',             href:'/finance/cogs',           icon:'🧮', label:'Cost of Goods (COGS)', show: can(role,'admin') },

    { type:'section', label:'Operations' },
    { type:'link', id:'schedule',         href:'/schedule',               icon:'📅', label:'Scheduling',           show: can(role,'schedule') },
    { type:'link', id:'tasks',            href:'/tasks',                  icon:'📋', label:'Job Orders',           show: can(role,'tasks') },
    { type:'link', id:'leave',            href:'/leave',                  icon:'🗓️', label:'Leave & Unavail.',     show: can(role,'leaveReview') },
    { type:'link', id:'dayoff',           href:'/dayoff',                 icon:'📆', label:'Day-Off',               show: can(role,'schedule') },
    { type:'link', id:'roles',            href:'/roles',                  icon:'📝', label:'Role Tasks',           show: can(role,'roles') },
    { type:'link', id:'checkin',          href:'/checkin',                icon:'✔️', label:'Daily Check-In',       show: can(role,'checkin') },
    { type:'link', id:'payroll',          href:'/payroll',                icon:'💸', label:'Payroll',              show: can(role,'payrollUpload') },
    { type:'link', id:'staff',            href:'/staff',                  icon:'👥', label:'Staff',                show: can(role,'staffView') },

    { type:'section', label:'Inventory' },
    { type:'link', id:'inv-catalog',      href:'/inventory/catalog',      icon:'📦', label:'Catalog',              show: can(role,'admin') },
    { type:'link', id:'inv-support',      href:'/inventory/support',      icon:'🛒', label:'Purchase Queue',       show: can(role,'admin') },
    { type:'link', id:'inv-approve',      href:'/inventory/approve',      icon:'✅', label:'Purchase Approvals',   show: can(role,'admin') },
    { type:'link', id:'inv-templates', href:'/inventory/templates',            icon:'📝', label:'Templates',           show: can(role,'admin') },
    { type:'link', id:'inv-reports',   href:'/inventory/reports',              icon:'📊', label:'Inventory Reports',    show: can(role,'admin') },
    { type:'link', id:'inv-approvals', href:'/inventory/inventory-approvals',  icon:'✅', label:'Inventory Approvals',  show: can(role,'admin') },
    { type:'link', id:'inv-recipes',   href:'/inventory/recipes',              icon:'📒', label:'Recipes',              show: can(role,'admin') },

    { type:'section', label:'Reports', show: can(role,'incidentReports') },
    { type:'link', id:'reports-incident', href:'/reports',                icon:'⚠️', label:'Incident Reports',     show: can(role,'incidentReports') },
    { type:'link', id:'reports-wastage',  href:'/reports/wastage',        icon:'🗑️', label:'Wastage Reports',       show: can(role,'incidentReports') },
    { type:'link', id:'sanctions',        href:'/hr/sanctions',           icon:'⚖️', label:'Sanctions',             show: can(role,'admin') },
    { type:'link', id:'handbook',         href:'/hr/handbook',            icon:'📖', label:'Handbook',              show: can(role,'admin') },

    { type:'section', label:'Documents', show: can(role,'admin') },
    { type:'link', id:'contracts',        href:'/contracts',              icon:'📄', label:'Contracts',            show: can(role,'admin') },
    { type:'link', id:'files',            href:'/files',                  icon:'📁', label:'Files · 201',          show: can(role,'admin') },

    { type:'section', label:'Comms' },
    { type:'link', id:'announce',         href:'/announce',               icon:'📣', label:'Announcements',        show: can(role,'announcements') },

    { type:'section', label:'Admin', show: can(role,'settings') },
    { type:'link', id:'settings',         href:'/settings',               icon:'⚙️', label:'Settings',             show: can(role,'settings') },
  ]

  const NAV = NAV_BASE.map(item => {
    if (item.type !== 'link' || !item.id) return item
    const override = navOverrides[item.id]
    if (!override) return item
    return {
      ...item,
      label: override.label || item.label,
      show: override.hidden ? false : item.show,
    }
  })

  return (
    <div style={{ width:220, flexShrink:0, background:'#EF4576', display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.2)', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:900, color:'white', letterSpacing:.5 }}>Oh Hey There</div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,.65)', letterSpacing:2.5, textTransform:'uppercase', marginTop:3 }}>Command Center</div>
      </div>

      <div style={{ margin:'12px 12px 4px', background:'rgba(0,0,0,.15)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:profile.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>{profile.initials}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile.name}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.65)', marginTop:1 }}>{profile.role}</div>
          <div style={{ fontSize:8, fontWeight:700, letterSpacing:1, color:'rgba(255,255,255,.5)', textTransform:'uppercase', marginTop:1 }}>
            {role==='admin'?'Admin Access':role==='hr'?'HR Access':''}
          </div>
        </div>
      </div>

      <nav style={{ flex:1, overflowY:'auto', padding:'8px 0 16px' }}>
        {NAV.map((item, i) => {
          if (item.show === false) return null
          if (item.type === 'section') return (
            <div key={i} style={{ fontSize:9, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,.4)', padding:'14px 18px 5px', marginTop:i===0?0:4 }}>
              {item.label}
            </div>
          )
          if (item.type === 'link') {
            const active = isActive(item.href)
            return (
              <a key={item.href} href={item.href}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 18px', textDecoration:'none', color:'white', fontWeight:active?700:400, opacity:active?1:0.8, background:active?'rgba(0,0,0,.18)':'transparent', borderLeft:`3px solid ${active?'white':'transparent'}`, fontSize:12, transition:'all .15s' }}
                onMouseEnter={e=>{ if(!active){e.currentTarget.style.opacity='1';e.currentTarget.style.background='rgba(0,0,0,.1)'} }}
                onMouseLeave={e=>{ if(!active){e.currentTarget.style.opacity='0.8';e.currentTarget.style.background='transparent'} }}>
                <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span style={{ color:'white' }}>{item.label}</span>
              </a>
            )
          }
          return null
        })}
      </nav>

      <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,.15)', flexShrink:0 }}>
        <button onClick={signOut} style={{ width:'100%', background:'rgba(0,0,0,.15)', border:'1px solid rgba(255,255,255,.2)', color:'white', padding:'8px', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
