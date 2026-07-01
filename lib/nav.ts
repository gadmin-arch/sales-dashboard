// Single source of truth for dashboard navigation + the role each page requires.
// Pure data (no JSX) so both the login redirect and the sidebar can use it.

export interface NavMeta {
  href: string
  label: string
  role: RoleKey
}

export type RoleKey = 'sales' | 'finance' | 'project' | 'purchasing' | 'payroll'

export const NAV: NavMeta[] = [
  { href: '/dashboard/sales', label: 'Sales Overview', role: 'sales' },
  { href: '/dashboard/sales/activities', label: 'Sales Activities', role: 'sales' },
  { href: '/dashboard/leads-opps', label: 'Leads & Opportunities', role: 'sales' },
  { href: '/dashboard/invoices', label: 'Invoices & Receivables', role: 'finance' },
  { href: '/dashboard/payments', label: 'Payments Collection', role: 'finance' },
  { href: '/dashboard/finance-ap', label: 'Finance AP & Reimburse', role: 'finance' },
  { href: '/dashboard/projects', label: 'Projects', role: 'project' },
  { href: '/dashboard/purchasing/requests', label: 'Purchase Requests', role: 'purchasing' },
  { href: '/dashboard/purchasing/orders', label: 'Purchase Orders', role: 'purchasing' },
  { href: '/dashboard/purchasing/vendors', label: 'Vendor Scorecard', role: 'purchasing' },
]

export type Roles = Record<RoleKey, boolean>

/** First page the given roles may access, in sidebar order (null if none). */
export function firstAllowedHref(roles: Partial<Roles> | undefined): string | null {
  if (!roles) return null
  return NAV.find((n) => roles[n.role])?.href ?? null
}

/** The nav item whose page owns this pathname (most specific match first). */
export function navItemForPath(pathname: string): NavMeta | undefined {
  return [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
}
