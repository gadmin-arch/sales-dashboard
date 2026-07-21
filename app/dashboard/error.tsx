'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/page-states'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Dashboard Error Boundary caught an error:', error)
  }, [error])

  return (
    <PageError 
      error={error.message || "An unexpected error occurred in the dashboard."} 
      onRetry={() => reset()} 
    />
  )
}
