'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface KPICardProps {
  title: string
  value: string
  change?: number
  icon?: React.ReactNode
  trend?: 'up' | 'down'
}

export function KPICard({ title, value, change, icon, trend = 'up' }: KPICardProps) {
  const isPositive = trend === 'up'

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className={cn('text-sm font-medium', isPositive ? 'text-emerald-500' : 'text-destructive')}>
                  {isPositive ? '+' : ''}{change}%
                </span>
              </div>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
