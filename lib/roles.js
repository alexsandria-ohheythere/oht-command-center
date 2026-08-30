'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from './supabase'

// Central source of truth for staff job roles/positions.
// Backed by the `roles` table in Supabase — see the "Roles & Positions" tab
// in Settings for the admin UI, or roles-table.sql for the schema.
//
// `is_operational` marks roles that show up in Payroll Rate Cards, Role Task
// Templates, and Recurring Tasks (the day-to-day shift roles). Roles like
// Managing Director / CEO are kept off (is_operational:false) since they're
// not paid or scheduled through those systems, but still assignable to a
// staff record in the Staff Directory.

export const DEFAULT_ROLE_COLOR = '#7a6a50'

export async function fetchRoles(supabase, { includeInactive = false } = {}) {
  let q = supabase.from('roles').select('*').order('sort_order')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) { console.error('fetchRoles error', error); return [] }
  return data || []
}

export function roleColor(roles, name) {
  return roles.find(r => r.name === name)?.color || DEFAULT_ROLE_COLOR
}

// Client hook — gives any page a live { roles, colorMap, getRoleColor } without
// a hardcoded ROLES/ROLE_COLORS list duplicated in every file. Roles added or
// edited in Settings → Roles & Positions show up everywhere automatically.
export function useRoles({ includeInactive = false } = {}) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const data = await fetchRoles(supabase, { includeInactive })
    setRoles(data)
    setLoading(false)
  }, [includeInactive])

  useEffect(() => { refresh() }, [refresh])

  const colorMap = {}
  roles.forEach(r => { colorMap[r.name] = r.color })

  const getRoleColor = (name) => colorMap[name] || DEFAULT_ROLE_COLOR
  const operational = roles.filter(r => r.is_operational !== false)

  return { roles, operational, roleNames: roles.map(r => r.name), colorMap, getRoleColor, loading, refresh }
}
