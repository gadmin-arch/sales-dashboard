'use client'

import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { fmtCurrency } from '@/lib/sales-helpers'

const COLORS: string[] = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

interface DonutChartProps {
  data: { name: string; value: number }[]
  height?: number
  total?: number
  formatValue?: (value: number, name: string) => string
  donut?: boolean
  currency?: string
  onSliceClick?: (name: string) => void
}

// Custom tooltip: name on top, color + formatted value below
function DonutTooltip({ active, payload, total, currency }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name = item.name || 'Blank'
  const value = item.value
  const color = item.payload?.fill || item.color
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
  const valDisplay = currency ? fmtCurrency(value, currency) : value

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{name}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="font-mono font-medium text-foreground tabular-nums">
          {valDisplay} ({pct}%)
        </span>
      </div>
    </div>
  )
}

export function DonutChart({ data, height = 260, total, formatValue, donut = true, currency, onSliceClick }: DonutChartProps) {
  // Replace empty names with "Blank" and filter out zero values
  const cleanData = data
    .filter(d => d.value > 0)
    .map(d => ({
      ...d,
      name: d.name?.trim() || 'Blank',
    }))
  const computedTotal = total ?? cleanData.reduce((s, d) => s + d.value, 0)

  return (
    <ChartContainer config={{}} className={`h-[${height}px] w-full`}>
      <PieChart>
        <Pie
          data={cleanData}
          cx="50%"
          cy="50%"
          innerRadius={donut ? 50 : 0}
          outerRadius={donut ? 70 : 80}
          paddingAngle={0}
          dataKey="value"
          stroke="none"
          nameKey="name"
          onClick={(_, index) => {
            if (onSliceClick && cleanData[index]) {
              onSliceClick(cleanData[index].name)
            }
          }}
          style={onSliceClick ? { cursor: 'pointer' } : undefined}
        >
          {cleanData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<DonutTooltip total={computedTotal} currency={currency} />} />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
}
