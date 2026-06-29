'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Client-side incremental pagination over an already-fetched list.
 * Keeps Google Sheets reads to one-per-Apply: the full filtered set arrives
 * once, and this just reveals more rows on demand. Resets when `items` changes.
 */
export function useLoadMore<T>(items: T[], step = 25) {
  const [count, setCount] = useState(step)
  useEffect(() => { setCount(step) }, [items, step])
  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    shown: Math.min(count, items.length),
    total: items.length,
    loadMore: () => setCount((c) => c + step),
    loadAll: () => setCount(items.length),
    collapse: () => setCount(step),
    step,
  }
}

interface LoadMoreProps {
  hasMore: boolean
  shown: number
  total: number
  onClick: () => void
  onLoadAll?: () => void
  onCollapse?: () => void
  step?: number
}

export function LoadMore({ hasMore, shown, total, onClick, onLoadAll, onCollapse, step = 25 }: LoadMoreProps) {
  if (total === 0) return null
  const canCollapse = shown > step
  return (
    <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-3">
      <span className="text-xs text-muted-foreground">
        Showing {shown.toLocaleString('id-ID')} of {total.toLocaleString('id-ID')}
      </span>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onClick}>
          Load {Math.min(step, total - shown)} more
        </Button>
      )}
      {hasMore && onLoadAll && (
        <Button variant="ghost" size="sm" onClick={onLoadAll}>
          Load all
        </Button>
      )}
      {canCollapse && onCollapse && (
        <Button variant="ghost" size="sm" onClick={onCollapse}>
          Collapse
        </Button>
      )}
    </div>
  )
}
