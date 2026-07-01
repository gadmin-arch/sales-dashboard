// Shared Recharts styling tokens — previously spelled out inline on every chart.

export const AXIS = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
export const AXIS_LINE = { stroke: 'var(--border)' } as const
export const TIP = {
  contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
} as const
export const GRID = { strokeDasharray: '3 3', stroke: 'var(--border)' } as const
