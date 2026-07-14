'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table'
import { Users, Shield, Plus, Search, Edit2, X, Check, Loader2 } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { PageHeader } from '@/components/page-header'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { useSort, SortHead } from '@/components/sortable'
import { LoadMore, useLoadMore } from '@/components/load-more'
import type { AccessUser } from '@/database'
import type { Roles } from '@/lib/nav'
import { cn } from '@/lib/utils'

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal States
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null)
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formRoles, setFormRoles] = useState<Roles>({
    sales: false,
    finance: false,
    project: false,
    purchasing: false,
    payroll: false,
    'cost control': false,
    admin: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!user?.email) return
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-user-email': user.email
        }
      })
      if (!res.ok) {
        if (res.status === 403) throw new Error('Forbidden: You do not have admin permissions.')
        throw new Error('Failed to load user permissions data.')
      }
      const body = await res.json()
      if (body.success) {
        setUsers(body.users)
      } else {
        throw new Error(body.error || 'Failed to parse response.')
      }
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOpenAddModal = () => {
    setEditingUser(null)
    setFormEmail('')
    setFormName('')
    setFormRoles({
      sales: false,
      finance: false,
      project: false,
      purchasing: false,
      payroll: false,
      'cost control': false,
      admin: false
    })
    setSubmitError(null)
    setModalOpen(true)
  }

  const handleOpenEditModal = (u: AccessUser) => {
    setEditingUser(u)
    setFormEmail(u.email)
    setFormName(u.name)
    setFormRoles({
      sales: u.sales,
      finance: u.finance,
      project: u.project,
      purchasing: u.purchasing,
      payroll: u.payroll,
      'cost control': u['cost control'],
      admin: u.admin
    })
    setSubmitError(null)
    setModalOpen(true)
  }

  const handleToggleRole = (key: keyof Roles) => {
    setFormRoles(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email) return
    if (!formEmail.trim() || !formName.trim()) {
      setSubmitError('Email and Name are required.')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError(null)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({
          email: formEmail.trim().toLowerCase(),
          name: formName.trim(),
          roles: formRoles
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save user permissions.')
      }

      setModalOpen(false)
      fetchUsers()
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter & Search
  const filteredUsers = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q)
    )
  }, [users, search])

  // Sorting
  const uSort = useSort(filteredUsers, 'name', 'asc')
  const uPage = useLoadMore(uSort.sorted)

  // KPIs
  const totalUsersCount = users.length
  const adminUsersCount = users.filter(u => u.admin).length
  const totalWithAccess = users.filter(u => 
    u.sales || u.finance || u.project || u.purchasing || u.payroll || u['cost control']
  ).length

  if (loading && users.length === 0) return <PageSpinner />
  if (error) return <PageError error={error} onRetry={fetchUsers} />

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader 
            title="User Permissions & Access Management" 
            subtitle="IT Admin — Konfigurasi hak akses modul dashboard karyawan multidayamitra.co.id" 
          />
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-4 py-2 text-sm shadow cursor-pointer transition-colors w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total User</CardTitle>
              <Users className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{totalUsersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Akun terdaftar dalam database akses.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">IT Administrator</CardTitle>
              <Shield className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{adminUsersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Memiliki akses penuh ke panel manajemen user.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dashboard Active Access</CardTitle>
              <Shield className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{totalWithAccess}</div>
              <p className="text-[10px] text-muted-foreground mt-1">User dengan minimal satu akses modul aktif.</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau email..." />
        </div>

        {/* Main Users Table */}
        <Card className="shadow-sm border border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead label="Name" column="name" sortKey={uSort.sortKey} sortDir={uSort.sortDir} onSort={uSort.toggle} />
                    <SortHead label="Email Address" column="email" sortKey={uSort.sortKey} sortDir={uSort.sortDir} onSort={uSort.toggle} />
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Sales</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Finance</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Projects</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Purchasing</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Payroll</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[100px]">Cost Control</TableHead>
                    <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[90px]">Admin</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-muted-foreground w-[100px] pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uSort.sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        Tidak ada user ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    uPage.visible.map((u) => (
                      <TableRow key={u.email} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-foreground text-xs py-3">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">{u.email}</TableCell>
                        
                        {/* Modules indicators */}
                        <TableCell className="text-center">
                          {u.sales ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">Sales</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.finance ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Finance</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.project ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Projects</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.purchasing ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">Purch.</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.payroll ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">Payroll</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u['cost control'] ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400">Cost Ctrl</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.admin ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400">Admin</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="inline-flex items-center justify-center h-7 w-7 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            title="Edit Permissions"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <LoadMore
              hasMore={uPage.hasMore}
              shown={uPage.shown}
              total={uPage.total}
              onClick={uPage.loadMore}
              onLoadAll={uPage.loadAll}
              onCollapse={uPage.collapse}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/20">
              <h3 className="font-bold text-base text-foreground">
                {editingUser ? 'Edit User Permissions' : 'Add New Authorized User'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {submitError && (
                <div className="text-xs text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30">
                  {submitError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Employee Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Google Account Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. johndoe@gmail.com"
                  className={cn(
                    "w-full text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary transition-colors font-mono",
                    editingUser && "bg-muted cursor-not-allowed opacity-70"
                  )}
                />
              </div>

              {/* Roles checklists */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">Module Permission Settings</label>
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-muted/10">
                  
                  {/* Sales */}
                  <div 
                    onClick={() => handleToggleRole('sales')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Sales Module</span>
                      <span className="text-[10px] text-muted-foreground">Overview, Leads, Opportunities, and Customer Scorecard.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.sales ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles.sales && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Finance */}
                  <div 
                    onClick={() => handleToggleRole('finance')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Finance &amp; AR Module</span>
                      <span className="text-[10px] text-muted-foreground">Invoices, Collections, Receivables, and Accounts Payable.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.finance ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles.finance && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Projects */}
                  <div 
                    onClick={() => handleToggleRole('project')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Project Management Module</span>
                      <span className="text-[10px] text-muted-foreground">Projects List, Delivery Timelines, and Worker Field Reports.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.project ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles.project && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Purchasing */}
                  <div 
                    onClick={() => handleToggleRole('purchasing')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Purchasing Module</span>
                      <span className="text-[10px] text-muted-foreground">Purchase Requests, Purchase Orders, and Vendor evaluations.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.purchasing ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles.purchasing && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Payroll */}
                  <div 
                    onClick={() => handleToggleRole('payroll')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Payroll &amp; Salary Module</span>
                      <span className="text-[10px] text-muted-foreground">Employee salaries, allowances, and loan tracking.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.payroll ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles.payroll && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Cost Control */}
                  <div 
                    onClick={() => handleToggleRole('cost control')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">Cost Control Module</span>
                      <span className="text-[10px] text-muted-foreground">Material, spent values, and Worker KPIs order nominals.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles['cost control'] ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                    )}>
                      {formRoles['cost control'] && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  {/* Admin */}
                  <div 
                    onClick={() => handleToggleRole('admin')}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer select-none bg-violet-50/10"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-violet-700 dark:text-violet-400">IT Administrator Control</span>
                      <span className="text-[10px] text-muted-foreground">Add/edit users and configure overall portal permissions.</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-center h-4.5 w-4.5 rounded border border-border transition-colors",
                      formRoles.admin ? "bg-violet-600 border-violet-600 text-white" : "bg-background"
                    )}>
                      {formRoles.admin && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow cursor-pointer transition-colors"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </SalesPageShell>
  )
}
