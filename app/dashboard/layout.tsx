'use client'

import { useAuth } from '@/lib/auth-context'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, FileText, CreditCard, FolderOpen, LogOut, Menu, X, ListTodo, Users, Lock, ClipboardList, ShoppingCart, Store, Loader2, CalendarClock, ClipboardCheck, Banknote, Gauge, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV, NAV_GROUPS, navItemForPath, firstAllowedHref, type Roles } from '@/lib/nav'

// Group icons mapped by department/role key
const GROUP_ICONS: Record<string, ReactNode> = {
  'sales': <BarChart3 className="h-4 w-4" />,
  'finance': <CreditCard className="h-4 w-4" />,
  'project': <FolderOpen className="h-4 w-4" />,
  'purchasing': <ShoppingCart className="h-4 w-4" />,
  'payroll': <Banknote className="h-4 w-4" />,
  'cost control': <Gauge className="h-4 w-4" />,
  'admin': <Shield className="h-4 w-4 text-violet-500" />,
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isValidated, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null)
  const [syncHistory, setSyncHistory] = useState<any[]>([])
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  const roles = user?.roles as Roles | undefined
  const visibleNavItems = roles ? NAV.filter((item) => roles[item.role]) : []

  // Track collapsible group open states
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    if (roles) {
      NAV_GROUPS.forEach(g => {
        initial[g.role] = g.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
      })
    }
    return initial
  })

  // Ensure active group automatically expands when pathname changes
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')))
    if (activeGroup) {
      setOpenGroups(prev => {
        if (prev[activeGroup.role]) return prev
        return {
          ...prev,
          [activeGroup.role]: true
        }
      })
    }
  }, [pathname])

  const toggleGroup = (role: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [role]: !prev[role]
    }))
  }

  // Route guard: block direct access to a page whose role the user lacks.
  const currentItem = navItemForPath(pathname)
  const accessDenied = Boolean(user && currentItem && roles && !roles[currentItem.role])
  const firstAllowed = firstAllowedHref(roles)

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync/status')
      const data = await res.json()
      if (data.success) {
        if (data.lastSyncTime) {
          const date = new Date(data.lastSyncTime)
          setLastSynced(date.toLocaleString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }))
        }
        setSyncStatus(data.status || null)
        setSyncErrorMessage(data.errorMessage || null)
        setSyncHistory(data.history || [])
      }
    } catch (e) {
      console.error('Failed to fetch sync status', e)
    }
  }

  // Redirect to login if user is not authenticated and loading is complete
  useEffect(() => {
    if (!isLoading && isValidated && !user) {
      window.location.href = '/login'
    }
  }, [user, isLoading, isValidated])

  useEffect(() => {
    if (user) {
      fetchSyncStatus()
    }
  }, [user])

  const handleManualSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/sync/manual', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchSyncStatus()
        window.location.reload()
      } else {
        alert('Sync failed: ' + (data.error || 'Unknown error'))
      }
    } catch (e) {
      console.error(e)
      alert('Sync failed. Please check connection.')
    } finally {
      setSyncing(false)
    }
  }

  // Block the first paint until roles are confirmed against the server, so a stale
  // cached role can never briefly render a page the user is no longer allowed to see.
  // Also block rendering if there is no authenticated user.
  if (isLoading || !isValidated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const navList = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {NAV_GROUPS.map((group) => {
        if (!roles || !roles[group.role]) return null

        if (group.items.length === 1) {
          const item = group.items[0]
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {GROUP_ICONS[group.role]}
              {item.label}
            </Link>
          )
        }

        const isOpen = !!openGroups[group.role]
        return (
          <div key={group.role} className="space-y-1">
            <button
              onClick={() => toggleGroup(group.role)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <div className="flex items-center gap-3">
                {GROUP_ICONS[group.role]}
                <span>{group.label}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
              )}
            </button>
            {isOpen && (
              <div className="ml-[38px] border-l border-border pl-3 space-y-1 py-0.5 font-sans">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        isActive 
                          ? 'text-primary font-semibold bg-primary/5' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const syncPanel = (
    <div className="border-t border-border px-4 py-3 bg-muted/20">
      <div className="flex flex-col gap-1.5">
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold shadow-sm transition-all border border-primary/10",
            syncing
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow cursor-pointer"
          )}
        >
          {syncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <CalendarClock className="h-3 w-3" />
              Sync Google Sheets
            </>
          )}
        </button>
        {lastSynced && (
          <div className="flex flex-col gap-1 mt-0.5 items-center">
            <span className="text-[10px] text-muted-foreground text-center font-medium">
              Last updated: {lastSynced}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {syncStatus === 'SUCCESS' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Success
                </span>
              )}
              {syncStatus === 'FAILED' && (
                <span 
                  title={syncErrorMessage || 'Unknown sync error'}
                  className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30 px-1.5 py-0.5 rounded cursor-help"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-bounce" />
                  Failed
                </span>
              )}
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="text-[9px] text-primary hover:underline font-semibold"
              >
                History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Syncing Backdrop Overlay */}
      {syncing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
          <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-card border border-border shadow-2xl max-w-sm text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Syncing Google Sheets</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Downloading latest data to Neon PostgreSQL. Dashboard will reload automatically when finished.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex h-16 items-center border-b border-border px-5 shrink-0">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </div>
        {navList()}
        {syncPanel}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-border bg-card px-4">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-muted-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 flex flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center border-b border-border px-5 shrink-0">
              <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
            </div>
            {navList(() => setSidebarOpen(false))}
            {syncPanel}
            <div className="border-t border-border p-3 shrink-0">
              <button onClick={() => { logout(); setSidebarOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content — scrollable */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {accessDenied ? (
            <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                You don&apos;t have permission to view this page. Please contact your administrator if you believe this is a mistake.
              </p>
              {firstAllowed && (
                <Link href={firstAllowed} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Go to my dashboard
                </Link>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Sync History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
              <h3 className="font-semibold text-lg text-foreground font-sans">Sync History & Status</h3>
              <button 
                onClick={() => setHistoryModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
                <p className="font-medium text-foreground mb-1">Vercel Cron Information</p>
                <p>Scheduled: <code className="bg-background px-1 py-0.5 rounded font-mono text-[11px]">0 23 * * *</code> UTC (06:00 WIB daily).</p>
                <p className="mt-1">Below are the last 5 sync execution records stored in the database.</p>
              </div>

              <div className="space-y-3">
                {syncHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No sync records found in the database.</p>
                ) : (
                  syncHistory.map((run) => {
                    const runDate = new Date(run.lastSyncTime)
                    const formattedDate = runDate.toLocaleString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short'
                    })
                    const isSuccess = run.status === 'SUCCESS'

                    return (
                      <div 
                        key={run.id} 
                        className={cn(
                          "p-3 rounded-xl border transition-all text-sm",
                          isSuccess 
                            ? "bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30" 
                            : "bg-rose-50/30 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-[11px] text-muted-foreground">ID: #{run.id}</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                            isSuccess 
                              ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" 
                              : "text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30"
                          )}>
                            {run.status}
                          </span>
                        </div>
                        <div className="text-foreground font-medium text-xs mb-1">
                          {formattedDate}
                        </div>
                        {run.errorMessage && (
                          <div className="mt-1.5 bg-rose-100/40 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs p-2 rounded border border-rose-200/50 dark:border-rose-900/30 font-mono overflow-x-auto whitespace-pre-wrap">
                            {run.errorMessage}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            {/* Footer */}
            <div className="border-t border-border p-4 bg-muted/10 flex justify-end font-sans">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors border border-border cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
