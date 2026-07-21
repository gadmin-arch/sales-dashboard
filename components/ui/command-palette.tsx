'use client'

import * as React from 'react'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { NAV, type Roles } from '@/lib/nav'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { user } = useAuth()
  
  const roles = user?.roles as Roles | undefined

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  // Filter NAV items based on user roles
  const visibleNav = React.useMemo(() => {
    if (!roles) return []
    return NAV.filter(item => roles[item.role])
  }, [roles])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-black/50 backdrop-blur-sm p-4">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden="true" />
      
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Global Command Palette"
        className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <Command 
          className="flex h-full w-full flex-col overflow-hidden bg-transparent"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input 
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Type a command or search..." 
              autoFocus
            />
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
              {visibleNav.map((navItem) => (
                <Command.Item
                  key={navItem.href}
                  value={navItem.label}
                  onSelect={() => {
                    runCommand(() => router.push(navItem.href))
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-muted/80 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background">
                      <span className="text-[10px] font-bold uppercase">{navItem.role.substring(0,2)}</span>
                    </div>
                    {navItem.label}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
            
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
