'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  data: any[]
  filename?: string
  label?: string
}

export function ExportButton({ data, filename = 'export.csv', label = 'Export' }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('No data available to export')
      return
    }

    // Extract headers from the first object
    const headers = Object.keys(data[0])
    
    // Convert data to CSV string
    const csvContent = [
      headers.join(','), // Header row
      ...data.map((row) =>
        headers
          .map((fieldName) => {
            let value = row[fieldName]
            if (value === null || value === undefined) {
              value = ''
            } else if (typeof value === 'object') {
              // Convert objects/arrays to JSON string to prevent [object Object]
              value = JSON.stringify(value)
            } else {
              value = String(value)
            }
            
            // Escape quotes and wrap in quotes if it contains comma, newline, or quotes
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              value = `"${value.replace(/"/g, '""')}"`
            }
            return value
          })
          .join(',')
      )
    ].join('\n')

    // Create a Blob from the CSV string
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    
    // Create a download link and trigger click
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5" disabled={!data || data.length === 0}>
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
