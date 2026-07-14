// Route-level data cache: dashboard aggregates only change at sync time, so
// entries are keyed by the current sync version (sync_metadata.last_sync_time).
// A completed sync writes a new version → new keys → the next request recomputes
// (blocking), which preserves read-after-sync freshness for the manual sync
// button. Old-version entries are never requested again and age out via the
// revalidate window. This avoids revalidateTag entirely: in Next 16 its
// stale-while-revalidate semantics would serve one stale response after a sync.

import { unstable_cache } from 'next/cache'

import { query } from '@/database/db'

/**
 * Stable cache key from query params: sorted, empty values dropped, and
 * transport-only params stripped (`fresh` is a cache-bypass flag every page
 * sends on first load — honouring it would defeat the cache for the most
 * common request).
 */
export function canonicalParamsKey(searchParams: URLSearchParams, extraDrop: string[] = []): string {
  const drop = new Set(['fresh', ...extraDrop])
  const entries = [...searchParams.entries()]
    .filter(([k, v]) => !drop.has(k) && v !== '')
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv))
  return new URLSearchParams(entries).toString()
}

/** Current data version: timestamp of the latest sync (a few bytes from Neon). */
async function getDataVersion(): Promise<string> {
  try {
    const res = await query('SELECT last_sync_time FROM sync_metadata ORDER BY id DESC LIMIT 1;')
    const t = res.rows[0]?.last_sync_time
    return t instanceof Date ? t.toISOString() : String(t ?? 'none')
  } catch {
    // Table missing / transient failure: still cache under a fixed version so
    // the request succeeds; entries then refresh via the revalidate window.
    return 'none'
  }
}

/** Wrap a route's compute fn in the Next data cache, keyed by params + sync version. */
export function cachedRoute<T>(routeName: string, compute: (sp: URLSearchParams) => Promise<T>) {
  const cached = unstable_cache(
    async (paramsKey: string, _version: string) => compute(new URLSearchParams(paramsKey)),
    [`route:${routeName}`],
    // Freshness comes from the version key; revalidate only bounds how long
    // orphaned old-version entries linger.
    { revalidate: 60 * 60 * 26 },
  )
  return async (searchParams: URLSearchParams): Promise<T> =>
    cached(canonicalParamsKey(searchParams), await getDataVersion())
}

/**
 * In-process memo of recent full computes. Several cached PROJECTIONS of the
 * same dataset (main payload, per-tab slices, row pages, per-project details)
 * can miss the Vercel data cache in quick succession; on a warm instance this
 * memo makes them share ONE compute execution instead of re-reading every
 * sheet table from Neon per projection — that read burst is the dominant
 * Neon egress cost.
 */
function memoizeCompute<T>(compute: (sp: URLSearchParams) => Promise<T>) {
  const TTL_MS = 5 * 60 * 1000
  const MAX_ENTRIES = 3
  const memo = new Map<string, { at: number; promise: Promise<T> }>()
  return (paramsKey: string, version: string): Promise<T> => {
    const key = `${version}::${paramsKey}`
    const hit = memo.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
    const promise = compute(new URLSearchParams(paramsKey))
    promise.catch(() => memo.delete(key))
    memo.set(key, { at: Date.now(), promise })
    while (memo.size > MAX_ENTRIES) memo.delete(memo.keys().next().value!)
    return promise
  }
}

/**
 * Like cachedRoute, but stores small PROJECTIONS of one expensive compute as
 * separate cache entries (each safely under Vercel's ~2MB per-entry limit)
 * instead of one giant response that silently fails to cache.
 *
 * `viewParams` are the params that select a projection (tab, detail id, sort…);
 * they are excluded from the dataset key so every view shares the same compute,
 * and passed to `project(full, view)` to build the response.
 */
export function cachedRouteView<T, V>(
  routeName: string,
  compute: (sp: URLSearchParams) => Promise<T>,
  viewParams: string[] | { view: string[]; drop?: string[] },
  project: (full: T, view: Record<string, string>) => V,
) {
  const viewKeys = Array.isArray(viewParams) ? viewParams : viewParams.view
  // dropParams are excluded from BOTH keys: they're applied by the route handler
  // AFTER cache retrieval (e.g. offset/limit/search over a cached sorted list),
  // so they must not multiply cache entries.
  const dropKeys = Array.isArray(viewParams) ? [] : viewParams.drop ?? []
  const memoized = memoizeCompute(compute)
  const cached = unstable_cache(
    async (paramsKey: string, version: string, viewKey: string) =>
      project(await memoized(paramsKey, version), Object.fromEntries(new URLSearchParams(viewKey))),
    [`route:${routeName}`],
    { revalidate: 60 * 60 * 26 },
  )
  return async (searchParams: URLSearchParams): Promise<V> => {
    const view = new URLSearchParams()
    for (const p of viewKeys) {
      const v = searchParams.get(p)
      if (v) view.set(p, v)
    }
    return cached(canonicalParamsKey(searchParams, [...viewKeys, ...dropKeys]), await getDataVersion(), view.toString())
  }
}
