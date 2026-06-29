'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, FileText, CreditCard, FolderOpen, LogOut, Menu, X, ListTodo, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  role: string
}

const navItems: NavItem[] = [
  { href: '/dashboard/sales', label: 'Sales Overview', icon: <BarChart3 className="h-4 w-4" />, role: 'sales' },
  { href: '/dashboard/sales/activities', label: 'Sales Activities', icon: <ListTodo className="h-4 w-4" />, role: 'sales' },
  { href: '/dashboard/leads-opps', label: 'Leads & Opportunities', icon: <Users className="h-4 w-4" />, role: 'sales' },
  { href: '/dashboard/invoices', label: 'Invoices & Receivables', icon: <FileText className="h-4 w-4" />, role: 'finance' },
  { href: '/dashboard/payments', label: 'Payments Collection', icon: <CreditCard className="h-4 w-4" />, role: 'finance' },
  { href: '/dashboard/projects', label: 'Projects', icon: <FolderOpen className="h-4 w-4" />, role: 'project' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || isLoading) return
    // Auth bypassed for development
    // if (!user && !localStorage.getItem('user')) {
    //   router.push('/login')
    // }
  }, [user, isLoading, mounted, router])

  const visibleNavItems = user
    ? navItems.filter((item) => user.roles[item.role as keyof typeof user.roles])
    : navItems

  // Route guard: match the current path to its nav item (most specific first)
  // and block access if the logged-in user lacks the required role. This stops
  // direct URL access to pages that are hidden from the menu.
  const currentItem = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
  const accessDenied = Boolean(
    user && currentItem && !user.roles[currentItem.role as keyof typeof user.roles]
  )
  const firstAllowed = visibleNavItems[0]?.href

  // Auth bypassed for development
  // if (!mounted || (!isLoading && !user && !localStorage.getItem('user'))) {
  //   return null
  // }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        {/* Header */}
        <div className="flex h-16 items-center border-b border-border px-5 shrink-0">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </div>

        {/* Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout — fixed at bottom */}
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
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
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
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-border p-3 shrink-0">
              <button
                onClick={() => { logout(); setSidebarOpen(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
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
                <Link
                  href={firstAllowed}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
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
