'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Sun, Moon } from 'lucide-react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'sales-dashboard-theme'
const VALID_MODES: ThemeMode[] = ['light', 'dark']

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      : null
    const initial = stored && VALID_MODES.includes(stored) ? stored : 'light'
    setModeState(initial)
    applyTheme(initial)
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
    applyTheme(m)
  }, [])

  return { mode, setMode, mounted }
}

export function ThemeToggle() {
  const { mode, setMode, mounted } = useTheme()
  if (!mounted) return null

  const Icon = mode === 'dark' ? Moon : Sun
  const label = mode === 'dark' ? 'Dark' : 'Light'

  return (
    <button
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
      title={`Theme: ${label}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export function SalesPageShell({ children }: { children: ReactNode }) {
  return <>{children}</>
}
