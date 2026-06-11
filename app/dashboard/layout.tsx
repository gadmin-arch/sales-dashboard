'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, FileText, CreditCard, FolderOpen, LogOut, Menu, X } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  role: string
}

const navItems: NavItem[] = [
  {
    href: '/dashboard/sales',
    label: 'Sales Overview',
    icon: <BarChart3 className="h-5 w-5" />,
    role: 'sales',
  },
  {
    href: '/dashboard/invoices',
    label: 'Invoices & Receivables',
    icon: <FileText className="h-5 w-5" />,
    role: 'finance',
  },
  {
    href: '/dashboard/payments',
    label: 'Payments Collection',
    icon: <CreditCard className="h-5 w-5" />,
    role: 'finance',
  },
  {
    href: '/dashboard/projects',
    label: 'Projects',
    icon: <FolderOpen className="h-5 w-5" />,
    role: 'project',
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Determine if we're on the dark sales page
  const isSalesPage = pathname === '/dashboard/sales'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null

    if (!isLoading && !user && !storedUser) {
      router.push('/login')
    } else if (storedUser || user) {
      setShowContent(true)
    }
  }, [user, isLoading, mounted, router])

  const visibleNavItems = navItems.filter((item) => {
    if (!user) return false
    return user.roles[item.role as keyof typeof user.roles]
  })

  if (!mounted || !showContent) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: isSalesPage ? '#0a1628' : undefined }}>
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (isSalesPage) {
    return (
      <div className="flex min-h-screen" style={{ background: '#0a1628' }}>
        {/* Dark sidebar for sales */}
        <div className="hidden lg:block w-60 flex-shrink-0" style={{ background: '#0f1a2e', borderRight: '1px solid #1a2d4a' }}>
          <div className="flex flex-col h-full">
            <div className="p-5" style={{ borderBottom: '1px solid #1a2d4a' }}>
              <h1 className="text-base font-bold" style={{ color: '#e2e8f0' }}>Dashboard</h1>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      color: isActive ? '#38bdf8' : '#7c8db5',
                      background: isActive ? '#38bdf810' : 'transparent',
                      borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-4" style={{ borderTop: '1px solid #1a2d4a' }}>
              <div className="rounded-lg p-3" style={{ background: '#111d32' }}>
                {user && user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="mb-2 h-9 w-9 rounded-full"
                    style={{ border: '2px solid #1a2d4a' }}
                  />
                )}
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{user?.name || 'User'}</p>
                <p className="text-xs" style={{ color: '#4a5b7a' }}>{user?.email || 'No email'}</p>
              </div>
              <button
                onClick={logout}
                className="mt-3 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: '#f87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8717115')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile header for sales */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3" style={{ background: '#0f1a2e', borderBottom: '1px solid #1a2d4a' }}>
          <h1 className="text-sm font-bold" style={{ color: '#e2e8f0' }}>Dashboard</h1>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: '#7c8db5' }}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 p-4" style={{ background: '#0f1a2e' }}>
              <nav className="mt-12 space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium"
                      style={{ color: isActive ? '#38bdf8' : '#7c8db5' }}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto lg:pt-0 pt-14">
          {children}
        </div>
      </div>
    )
  }

  // Default light layout for other pages
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex flex-col h-full">
          <div className="border-b border-gray-200 p-6">
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-6">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              {user && user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="mb-2 h-10 w-10 rounded-full"
                />
              )}
              <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'No email'}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
