'use client'

import { Loader2, AlertCircle, FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton'

export { DashboardSkeleton }

/** Full-height centered spinner for the initial page load (fallback). */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  )
}

/** Full-height error state with a Retry action. */
export function PageError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4 text-center px-4">
      <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="text-muted-foreground text-sm max-w-md">{error}</p>
      <Button variant="outline" onClick={onRetry} className="mt-4">
        Try Again
      </Button>
    </div>
  )
}

/** Empty state component for tables and lists. */
export function EmptyState({ title = "No results found", description = "Try adjusting your filters or search query." }: { title?: string, description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4 border-2 border-dashed rounded-lg border-muted/60 bg-muted/20">
      <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
        <FileSearch className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
    </div>
  )
}
