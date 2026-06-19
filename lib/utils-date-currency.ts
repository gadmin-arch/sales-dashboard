// Date utilities - shared across components
export function parseDate(str: string): Date | null {
  if (!str) return null
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, d, m, y] = dashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const iso = new Date(str)
  return isNaN(iso.getTime()) ? null : iso
}

export function formatMonth(dateStr: string): string | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

export function formatWeek(dateStr: string): string | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `W${weekNum} ${d.getFullYear()}`
}

export function sortByPeriod<T>(data: Record<string, T>, period: 'monthly' | 'weekly'): [string, T][] {
  const parseMonthKey = (key: string): number => {
    const months: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
    const parts = key.split(' ')
    if (parts.length !== 2) return 0
    return (parseInt(parts[1]) || 0) * 100 + (months[parts[0]] || 0)
  }
  const parseWeekKey = (key: string): number => {
    const match = key.match(/^W(\d+) (\d{4})$/)
    if (!match) return 0
    return (parseInt(match[2]) || 0) * 100 + (parseInt(match[1]) || 0)
  }
  return Object.entries(data).sort(([a], [b]) => period === 'weekly' ? parseWeekKey(a) - parseWeekKey(b) : parseMonthKey(a) - parseMonthKey(b))
}

// Currency utilities
export function formatCurrency(value: number, currency = 'IDR'): string {
  const prefix = currency === 'USD' ? '$ ' : currency === 'EUR' ? '€ ' : currency === 'SGD' ? 'SGD ' : 'IDR '
  if (value >= 1_000_000_000) return `${prefix}${Math.round(value / 1_000_000_000)}B`
  if (value >= 1_000_000) return `${prefix}${Math.round(value / 1_000_000)}M`
  if (value >= 1_000) return `${prefix}${Math.round(value / 1_000)}K`
  return `${prefix}${value.toLocaleString('id-ID')}`
}