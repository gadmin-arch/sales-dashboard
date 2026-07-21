// Single source of truth for dashboard navigation + the role each page requires.
// Pure data (no JSX) so both the login redirect and the sidebar can use it.

export interface NavMeta {
  href: string
  label: string
  role: RoleKey
}

export type RoleKey = 'sales' | 'finance' | 'project' | 'purchasing' | 'payroll' | 'cost control' | 'admin'

export interface NavGroup {
  label: string
  role: RoleKey
  items: NavMeta[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sales',
    role: 'sales',
    items: [
      { href: '/dashboard/sales', label: 'Sales Overview', role: 'sales' },
      { href: '/dashboard/sales/activities', label: 'Sales Activities', role: 'sales' },
      { href: '/dashboard/leads-opps', label: 'Leads & Opportunities', role: 'sales' },
      { href: '/dashboard/customers', label: 'Customer Scorecard', role: 'sales' },
    ]
  },
  {
    label: 'Finance',
    role: 'finance',
    items: [
      { href: '/dashboard/invoices', label: 'Invoices & Receivables', role: 'finance' },
      { href: '/dashboard/payments', label: 'Payments Collection', role: 'finance' },
      { href: '/dashboard/finance-ap', label: 'Finance AP & AP Reimburse', role: 'finance' },
    ]
  },
  {
    label: 'Project Management',
    role: 'project',
    items: [
      { href: '/dashboard/projects', label: 'Projects', role: 'project' },
      { href: '/dashboard/projects/attendances', label: 'Work Hours by Attendances', role: 'project' },
      { href: '/dashboard/delivery', label: 'Project Delivery', role: 'project' },
      { href: '/dashboard/reports', label: 'Worker Reports', role: 'project' },
    ]
  },
  {
    label: 'Purchasing',
    role: 'purchasing',
    items: [
      { href: '/dashboard/purchasing/requests', label: 'Purchase Requests', role: 'purchasing' },
      { href: '/dashboard/purchasing/orders', label: 'Purchase Orders', role: 'purchasing' },
      { href: '/dashboard/purchasing/vendors', label: 'Vendor Scorecard', role: 'purchasing' },
    ]
  },
  {
    label: 'Payroll',
    role: 'payroll',
    items: [
      { href: '/dashboard/payroll', label: 'Payroll & Salaries', role: 'payroll' },
    ]
  },
  {
    label: 'Cost Control',
    role: 'cost control',
    items: [
      { href: '/dashboard/cost-control', label: 'Cost Control Overview', role: 'cost control' },
      { href: '/dashboard/cost-control/workers', label: 'Worker KPIs', role: 'cost control' },
    ]
  },
  {
    label: 'Admin',
    role: 'admin',
    items: [
      { href: '/dashboard/admin/users', label: 'User Management', role: 'admin' },
    ]
  }
]

export const NAV: NavMeta[] = NAV_GROUPS.flatMap((g) => g.items)

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
