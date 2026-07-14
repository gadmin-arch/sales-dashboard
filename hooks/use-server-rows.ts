'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildQuery } from '@/lib/sales-helpers'

/**
 * Server-backed table state: the main payload only carries the first page of
 * rows, and sorting / searching / load-more request further slices from the
 * route's cached row view (`view=rows`). Server sorting uses the same
 * comparator as the old client-side useSort, so ordering is unchanged.
 *
 * The server slices from ONE cached sorted list per (filters, sort) — these
 * requests do not recompute the dataset, so they stay cheap on Neon.
 */
export function useServerRows<T>(opts: {
  endpoint: string
  /** Dataset params (filters etc.) — must match the page's main fetch. */
  baseParams: Record<string, string | string[]>
  initialRows: T[]
  totalRows: number
  initialSortKey: string
  initialSortDir?: 'asc' | 'desc'
  step?: number
}) {
  const { endpoint, baseParams, initialRows, totalRows, initialSortKey, initialSortDir = 'desc', step = 25 } = opts

  const [rows, setRows] = useState<T[]>(initialRows)
  const [total, setTotal] = useState(totalRows)
  const [sortKey, setSortKey] = useState(initialSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir)
  const [search, setSearchState] = useState('')
  const [busy, setBusy] = useState(false)

  // New dataset from the page (filters applied / refetched) → reset to its first page.
  useEffect(() => {
    setRows(initialRows)
    setTotal(totalRows)
    setSortKey(initialSortKey)
    setSortDir(initialSortDir)
    setSearchState('')
  }, [initialRows, totalRows, initialSortKey, initialSortDir])

  const seqRef = useRef(0)
  const baseRef = useRef(baseParams)
  baseRef.current = baseParams

  const fetchRows = useCallback(async (p: {
    sortKey: string; sortDir: 'asc' | 'desc'; q: string; offset: number; limit: number | 'all'; append: boolean
  }) => {
    const seq = ++seqRef.current
    setBusy(true)
    try {
      const res = await fetch(endpoint + '?' + buildQuery({
        ...baseRef.current,
        view: 'rows',
        sortKey: p.sortKey,
        sortDir: p.sortDir,
        ...(p.q ? { q: p.q } : {}),
        offset: String(p.offset),
        limit: String(p.limit),
      }))
      if (!res.ok) throw new Error('Failed to load rows')
      const json: { rows: T[]; totalRows: number } = await res.json()
      if (seq !== seqRef.current) return
      setRows((prev) => (p.append ? [...prev, ...json.rows] : json.rows))
      setTotal(json.totalRows)
    } catch {
      // keep current rows on failure
    } finally {
      if (seq === seqRef.current) setBusy(false)
    }
  }, [endpoint])

  const toggle = useCallback((key: string) => {
    const nextDir: 'asc' | 'desc' = key === sortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    setSortKey(key); setSortDir(nextDir)
    fetchRows({ sortKey: key, sortDir: nextDir, q: search, offset: 0, limit: Math.max(step, rows.length), append: false })
  }, [sortKey, sortDir, search, rows.length, step, fetchRows])

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSearch = useCallback((q: string) => {
    setSearchState(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchRows({ sortKey, sortDir, q, offset: 0, limit: step, append: false })
    }, 300)
  }, [sortKey, sortDir, step, fetchRows])
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  const loadMore = useCallback(() => {
    fetchRows({ sortKey, sortDir, q: search, offset: rows.length, limit: step, append: true })
  }, [sortKey, sortDir, search, rows.length, step, fetchRows])

  const loadAll = useCallback(() => {
    fetchRows({ sortKey, sortDir, q: search, offset: rows.length, limit: 'all', append: true })
  }, [sortKey, sortDir, search, rows.length, step, fetchRows])

  const collapse = useCallback(() => { setRows((prev) => prev.slice(0, step)) }, [step])

  return {
    rows, total, busy,
    sortKey, sortDir, toggle,
    search, setSearch,
    hasMore: rows.length < total,
    shown: rows.length,
    loadMore, loadAll, collapse,
    step,
  }
}
