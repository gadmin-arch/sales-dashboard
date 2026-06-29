'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  /** Selected values. Empty array means "all" (no filter applied). */
  selected: string[]
  onChange: (values: string[]) => void
  /** Shown on the trigger and as the "select all" reset when nothing is selected. */
  allLabel?: string
  className?: string
  /** Disable the "select all" / "clear" shortcut row. */
  hideSelectAll?: boolean
}

interface Coords {
  top: number
  left: number
  width: number
  maxHeight: number
}

export function MultiSelect({
  options,
  selected,
  onChange,
  allLabel = 'All',
  className,
  hideSelectAll = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [mounted, setMounted] = React.useState(false)
  const [coords, setCoords] = React.useState<Coords | null>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setMounted(true), [])

  // Position the portaled panel beneath the trigger, sized to the trigger width.
  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      maxHeight: Math.max(160, window.innerHeight - r.bottom - 16),
    })
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    // capture:true so we also catch scrolling inside the dashboard's scroll container
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, updatePosition])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset the search box whenever the dropdown closes
  React.useEffect(() => { if (!open) setQuery('') }, [open])

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  // Select all currently-visible options (respects the active search), merged
  // with the existing selection — so users can then uncheck a few to exclude.
  const selectAll = () => {
    const set = new Set(selected)
    for (const o of filteredOptions) set.add(o.value)
    onChange([...set])
  }

  const triggerLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span className={cn('line-clamp-1 flex-1 text-left', selected.length === 0 && 'text-muted-foreground')}>
          {triggerLabel}
        </span>
        {selected.length > 0 ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="grid size-4 shrink-0 place-items-center rounded hover:bg-muted text-muted-foreground"
            aria-label="Clear selection"
          >
            <X className="size-3" />
          </span>
        ) : (
          <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {mounted && open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, maxHeight: coords.maxHeight }}
          className="z-[100] flex min-w-44 flex-col rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {options.length > 0 && (
            <div className="relative border-b border-border p-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md bg-transparent py-1 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          {!hideSelectAll && options.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs">
              <button type="button" onClick={selectAll} className="font-medium text-primary hover:underline">
                Select all{query ? ' (filtered)' : ''}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={selected.length === 0}
              >
                Clear
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filteredOptions.map((o) => {
              const checked = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="line-clamp-1 flex-1">{o.label}</span>
                </button>
              )
            })}
            {filteredOptions.length === 0 && (
              <div className="px-1.5 py-2 text-center text-xs text-muted-foreground">
                {options.length === 0 ? 'No options' : 'No matches'}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
