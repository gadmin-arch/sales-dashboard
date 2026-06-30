import { useState, useCallback } from 'react'

export type ChartFilter = { type: string; value: string; label: string } | null

export function useChartFilter(
  targetElementId: string = 'table-list',
  onFilterChange?: (type: string, value: string) => void,
  scroll: boolean = true,
) {
  const [chartFilter, setChartFilter] = useState<ChartFilter>(null)

  const handleChartClick = useCallback((type: string, value: string, label: string) => {
    setChartFilter((prev) => {
      if (prev?.type === type && prev?.value === value) {
        return null
      }
      // Scroll the table into view on filter — unless the caller opts out.
      if (scroll) {
        setTimeout(() => {
          document.getElementById(targetElementId)?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
      if (onFilterChange) onFilterChange(type, value)
      return { type, value, label }
    })
  }, [targetElementId, onFilterChange, scroll])

  return { chartFilter, setChartFilter, handleChartClick }
}
