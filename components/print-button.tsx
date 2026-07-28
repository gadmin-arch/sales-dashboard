'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PrintButtonProps {
  label?: string
}

export function PrintButton({ label = 'Print' }: PrintButtonProps) {
  const handlePrint = () => {
    window.dispatchEvent(new Event('beforeprint'))
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        window.dispatchEvent(new Event('afterprint'))
      }, 500)
    }, 100)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="h-8 gap-1.5 print:hidden cursor-pointer"
      title="Print entire page top-to-bottom without menus"
    >
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
