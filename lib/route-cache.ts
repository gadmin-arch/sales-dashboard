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
export function canonicalParamsKey(searchParams: URLSearchParams): string {
  const drop = new Set(['fresh'])
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
