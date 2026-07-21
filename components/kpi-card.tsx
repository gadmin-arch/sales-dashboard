'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/info-tooltip'

interface KPITrend {
  value: number | string
  label: string
  positive: boolean
}

interface KPICardProps {
  title: string
  value: string
  icon?: React.ReactNode
  /** Optional sub-line: e.g. { value: 92.7, label: 'collected', positive: true } */
  trend?: KPITrend
  tooltip?: string
}

export function KPICard({ title, value, icon, trend, tooltip }: KPICardProps) {
  return (
    <Card 
      className="overflow-visible transition-all hover:shadow-md hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`${title}, ${value}${trend ? `. Trend: ${trend.value} ${trend.label} (${trend.positive ? 'positive' : 'negative'})` : ''}`}
      tabIndex={0}
      role="region"
    >
      <CardContent className="pt-5" aria-hidden="true">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {tooltip && <InfoTooltip tooltip={tooltip} />}
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trend.positive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className={cn('text-sm font-medium', trend.positive ? 'text-emerald-500' : 'text-destructive')}>
                  {trend.value}
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
