'use client'

import { X } from 'lucide-react'

interface DateRangeFilterProps {
  label: string
  startDate: Date | null
  endDate: Date | null
  onStartDateChange: (date: Date | null) => void
  onEndDateChange: (date: Date | null) => void
  onClear?: () => void
}

type QuickRange = '1w' | '1m' | '3m' | '6m' | 'ytd' | '1y' | '5y'

const quickRanges: { value: QuickRange; label: string }[] = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1 Year' },
  { value: '5y', label: '5 Years' },
]

function getDateRange(range: QuickRange): [Date, Date] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (range) {
    case '1w':
      return [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), today]
    case '1m':
      return [new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()), today]
    case '3m':
      return [new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), today]
    case '6m':
      return [new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()), today]
    case 'ytd':
      return [new Date(today.getFullYear(), 0, 1), today]
    case '1y':
      return [new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), today]
    case '5y':
      return [new Date(today.getFullYear() - 5, today.getMonth(), today.getDate()), today]
  }
}

export function DateRangeFilter({
  label,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: DateRangeFilterProps) {
  const handleQuickRange = (range: QuickRange) => {
    const [from, to] = getDateRange(range)
    onStartDateChange(from)
    onEndDateChange(to)
  }

  return (
    <div className="flex-1">
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={startDate?.toISOString().split('T')[0] || ''}
            onChange={(e) =>
              onStartDateChange(e.target.value ? new Date(e.target.value) : null)
            }
            placeholder="From"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate?.toISOString().split('T')[0] || ''}
            onChange={(e) =>
              onEndDateChange(e.target.value ? new Date(e.target.value) : null)
            }
            placeholder="To"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          {(startDate || endDate) && onClear && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear dates"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {quickRanges.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleQuickRange(r.value)}
              className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
