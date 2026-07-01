'use client'

export type BadgeTone = 'green' | 'amber' | 'red' | 'sky' | 'blue' | 'violet' | 'muted'

export const BADGE_TONE: Record<BadgeTone, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  muted: 'bg-muted text-muted-foreground',
}

/** The small status pill used in dashboard tables. */
export function StatusBadge({ label, tone = 'muted' }: { label: string; tone?: BadgeTone | string }) {
  const cls = BADGE_TONE[(tone as BadgeTone)] || BADGE_TONE.muted
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
}
