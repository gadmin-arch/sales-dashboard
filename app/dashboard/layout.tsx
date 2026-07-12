'use client'

import { useAuth } from '@/lib/auth-context'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, FileText, CreditCard, FolderOpen, LogOut, Menu, X, ListTodo, Users, Lock, ClipboardList, ShoppingCart, Store, Loader2, CalendarClock, ClipboardCheck, Banknote, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV, navItemForPath, firstAllowedHref, type Roles } from '@/lib/nav'

// Icons live here (JSX) keyed by the pure NAV entries in lib/nav.
const ICONS: Record<string, ReactNode> = {
  '/dashboard/sales': <BarChart3 className="h-4 w-4" />,
  '/dashboard/sales/activities': <ListTodo className="h-4 w-4" />,
  '/dashboard/leads-opps': <Users className="h-4 w-4" />,
  '/dashboard/invoices': <FileText className="h-4 w-4" />,
  '/dashboard/customers': <Users className="h-4 w-4" />,
  '/dashboard/payments': <CreditCard className="h-4 w-4" />,
  '/dashboard/finance-ap': <CreditCard className="h-4 w-4" />,
  '/dashboard/projects': <FolderOpen className="h-4 w-4" />,
  '/dashboard/delivery': <CalendarClock className="h-4 w-4" />,
  '/dashboard/reports': <ClipboardCheck className="h-4 w-4" />,
  '/dashboard/purchasing/requests': <ClipboardList className="h-4 w-4" />,
  '/dashboard/purchasing/orders': <ShoppingCart className="h-4 w-4" />,
  '/dashboard/purchasing/vendors': <Store className="h-4 w-4" />,
  '/dashboard/payroll': <Banknote className="h-4 w-4" />,
  '/dashboard/cost-control': <Gauge className="h-4 w-4" />,
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isValidated, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const roles = user?.roles as Roles | undefined
  const visibleNavItems = roles ? NAV.filter((item) => roles[item.role]) : []

  // Route guard: block direct access to a page whose role the user lacks.
  const currentItem = navItemForPath(pathname)
  const accessDenied = Boolean(user && currentItem && roles && !roles[currentItem.role])
  const firstAllowed = firstAllowedHref(roles)

  // Redirect to login if user is not authenticated and loading is complete
  useEffect(() => {
    if (!isLoading && isValidated && !user) {
      window.location.href = '/login'
    }
  }, [user, isLoading, isValidated])

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
      {visibleNavItems.map((item) => {
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
            {ICONS[item.href]}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex h-16 items-center border-b border-border px-5 shrink-0">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </div>
        {navList()}
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
    </div>
  )
}
