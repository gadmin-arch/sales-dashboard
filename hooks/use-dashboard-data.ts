'use client'

import { useEffect, useRef, useState } from 'react'
import { buildQuery } from '@/lib/sales-helpers'

/**
 * The standard dashboard data-fetch loop, extracted from the 8 page copies:
 * fetches `endpoint` with the given params, sends `fresh=1` on the first load,
 * spreads the active chart cross-filter as cType/cVal, and re-fetches whenever
 * the params or chart filter change. Returns { data, loading, error }.
 */
export function useDashboardData<T>(
  endpoint: string,
  params: Record<string, string | string[]>,
  chartFilter: { type: string; value: string } | null,
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const firstLoad = useRef(true)

  // Serialize the params so the effect only re-runs on a real change.
  const key = JSON.stringify(params) + '|' + (chartFilter ? `${chartFilter.type}:${chartFilter.value}` : '')

  useEffect(() => {
    const fresh = firstLoad.current
    firstLoad.current = false
    let cancelled = false
    setLoading(true)
    setError(null)
    const q = {
      ...params,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}),
    }
    fetch(endpoint + '?' + buildQuery(q))
      .then((res) => { if (!res.ok) throw new Error('Failed to load data'); return res.json() })
      .then((d) => { if (!cancelled) setData(d as T) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key])

  return { data, loading, error }
}
