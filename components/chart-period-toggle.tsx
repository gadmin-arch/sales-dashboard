'use client'

interface ChartPeriodToggleProps {
  period: 'monthly' | 'weekly'
  onPeriodChange: (period: 'monthly' | 'weekly') => void
}

export function ChartPeriodToggle({ period, onPeriodChange }: ChartPeriodToggleProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onPeriodChange('monthly')}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
          period === 'monthly'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onPeriodChange('weekly')}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
          period === 'weekly'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        Weekly
      </button>
    </div>
  )
}
