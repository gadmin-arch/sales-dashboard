'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { PaginationState, SortingState } from '@tanstack/react-table'
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
  const [sorting, setSorting] = useState<SortingState>([{ id: initialSortKey, desc: initialSortDir === 'desc' }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: step })
  const [search, setSearchState] = useState('')
  const [busy, setBusy] = useState(false)

  // New dataset from the page (filters applied / refetched) → reset to its first page.
  useEffect(() => {
    setRows(initialRows)
    setTotal(totalRows)
    setSorting([{ id: initialSortKey, desc: initialSortDir === 'desc' }])
    setPagination({ pageIndex: 0, pageSize: step })
    setSearchState('')
  }, [initialRows, totalRows, initialSortKey, initialSortDir, step])

  const seqRef = useRef(0)
  const baseRef = useRef(baseParams)
  baseRef.current = baseParams

  const fetchRows = useCallback(async (p: {
    sortKey: string; sortDir: 'asc' | 'desc'; q: string; offset: number; limit: number
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
      setRows(json.rows)
      setTotal(json.totalRows)
    } catch {
      // keep current rows on failure
    } finally {
      if (seq === seqRef.current) setBusy(false)
    }
  }, [endpoint])

  const onSortingChange = useCallback((updater: any) => {
    setSorting((old) => {
      const next: SortingState = typeof updater === 'function' ? updater(old) : updater
      if (!next.length) return old
      fetchRows({ sortKey: next[0].id, sortDir: next[0].desc ? 'desc' : 'asc', q: search, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize })
      return next
    })
  }, [search, pagination, fetchRows])

  const onPaginationChange = useCallback((updater: any) => {
    setPagination((old) => {
      const next: PaginationState = typeof updater === 'function' ? updater(old) : updater
      const s = sorting[0] || { id: initialSortKey, desc: initialSortDir === 'desc' }
      fetchRows({ sortKey: s.id, sortDir: s.desc ? 'desc' : 'asc', q: search, offset: next.pageIndex * next.pageSize, limit: next.pageSize })
      return next
    })
  }, [sorting, search, fetchRows, initialSortKey, initialSortDir])

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSearch = useCallback((q: string) => {
    setSearchState(q)
    setPagination((old) => ({ ...old, pageIndex: 0 }))
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const s = sorting[0] || { id: initialSortKey, desc: initialSortDir === 'desc' }
      fetchRows({ sortKey: s.id, sortDir: s.desc ? 'desc' : 'asc', q, offset: 0, limit: pagination.pageSize })
    }, 300)
  }, [sorting, pagination.pageSize, fetchRows, initialSortKey, initialSortDir])
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  return {
    rows, total, busy,
    search, setSearch,
    pagination, onPaginationChange,
    sorting, onSortingChange,
    pageCount: Math.ceil(total / pagination.pageSize),
  }
}
