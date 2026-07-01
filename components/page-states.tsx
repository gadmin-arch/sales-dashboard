'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Full-height centered spinner for the initial page load. */
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
      <p className="text-destructive">{error}</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  )
}
