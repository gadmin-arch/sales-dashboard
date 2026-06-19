'use client'

interface SummaryCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'amber'
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
}

export function SummaryCard({ label, value, icon, color = 'blue' }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {typeof value === 'number'
              ? `Rp${(value / 1000000000).toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}B`
              : value}
          </p>
        </div>
        {icon && <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>}
      </div>
    </div>
  )
}