'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Filter, X } from 'lucide-react'
import type { Invoice } from '@/lib/types'
import {
  useInvoices,
  usePaymentSummary,
  useCustomerInvoiceSummaries,
  useFilteredInvoices,
  useInvoiceTrendData,
  useAgingReceivableData,
  useInvoiceVsPaymentTrend,
  useDSO,
  useCollectionRate,
} from '@/lib/hooks'
import { DateRangeFilter } from '@/components/date-range-filter'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
import { StatusBadge } from '@/components/status-badge'
import { ProjectStatusBadge } from '@/components/project-status-badge'
import { SummaryCard } from '@/components/summary-card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function InvoicesDashboard() {
  const allInvoices = useInvoices()
  const paymentSummary = usePaymentSummary(allInvoices)
  const customerSummaries = useCustomerInvoiceSummaries(allInvoices)
  const trendData = useInvoiceTrendData(allInvoices)
  const agingData = useAgingReceivableData(allInvoices)
  const ivpTrendData = useInvoiceVsPaymentTrend(allInvoices)
  const dso = useDSO(allInvoices)
  const collectionRate = useCollectionRate(allInvoices)

  const getYTDDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(now.getFullYear(), 0, 1)
    return [start, today] as [Date, Date]
  }

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all')
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all')
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(getYTDDateRange())
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND')
  const [showFilters, setShowFilters] = useState(false)
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')

  // Get unique customers
  const customers = useMemo(
    () => Array.from(new Map(allInvoices.map((inv) => [inv.customerId, inv.customer])).values()),
    [allInvoices]
  )

  // Apply filters
  const filteredInvoices = useFilteredInvoices(allInvoices, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    invoiceStatus: invoiceStatusFilter === 'all' ? undefined : invoiceStatusFilter,
    projectStatus: projectStatusFilter === 'all' ? undefined : projectStatusFilter,
    customerId: customerFilter === 'all' ? undefined : customerFilter,
    invoiceDateStart: dateRange[0],
    invoiceDateEnd: dateRange[1],
    filterLogic,
  })

  const hasActiveFilters =
    statusFilter !== 'all' ||
    invoiceStatusFilter !== 'all' ||
    projectStatusFilter !== 'all' ||
    customerFilter !== 'all' ||
    dateRange[0] ||
    dateRange[1]

  function formatCurrency(amount: number | undefined): string {
  const val = amount ?? 0
  return `Rp${(val / 1000000).toLocaleString('id-ID')}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getDaysOverdue(invoice: Invoice): number | null {
  if (invoice.status !== 'overdue') return null
  const today = new Date()
  const dueDate = new Date(invoice.dueDate)
  return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
}

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Invoice & Payment Dashboard</h1>
        <p className="mt-2 text-slate-600">Monitor invoicing, payments, receivables, and cash collection performance</p>
      </div>

      {/* Filters Section - Top */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex w-full items-center justify-between lg:hidden"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600" />
            <span className="font-semibold text-slate-900">Filters</span>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-slate-600 transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className={`space-y-4 pt-4 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:pt-0 ${
          !showFilters && 'hidden lg:grid'
        }`}>
          {/* Filter Logic */}
          <div className="flex items-end gap-2 lg:col-span-1">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700">Filter Logic</label>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setFilterLogic('AND')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-1 ${
                    filterLogic === 'AND'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  AND
                </button>
                <button
                  onClick={() => setFilterLogic('OR')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-1 ${
                    filterLogic === 'OR'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  OR
                </button>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Invoice Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Invoice Status</label>
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Project Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Project Status</label>
            <select
              value={projectStatusFilter}
              onChange={(e) => setProjectStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Filter - Full Width */}
        <div className={`mt-4 pt-4 border-t border-slate-200 ${!showFilters && 'hidden lg:block'}`}>
          <DateRangeFilter
            label="Invoice Date Range"
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onStartDateChange={(date) => setDateRange([date, dateRange[1]])}
            onEndDateChange={(date) => setDateRange([dateRange[0], date])}
            onClear={() => setDateRange([null, null])}
          />
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <div className="mt-4">
            <button
              onClick={() => {
                setStatusFilter('all')
                setInvoiceStatusFilter('all')
                setProjectStatusFilter('all')
                setCustomerFilter('all')
                setDateRange(getYTDDateRange())
                setFilterLogic('AND')
              }}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Total Outstanding"
          value={paymentSummary.totalOutstanding}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="amber"
        />
        <SummaryCard
          label="Paid This Month"
          value={paymentSummary.paidThisMonth}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="green"
        />
        <SummaryCard
          label="Overdue Count"
          value={paymentSummary.overdueCount}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="red"
        />
        <SummaryCard
          label="DSO (Days)"
          value={dso}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="blue"
        />
        <SummaryCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          color="green"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invoice vs Payment Trend */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Invoice vs Payment Trend</h2>
            <ChartPeriodToggle period={chartPeriod} onPeriodChange={setChartPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ivpTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Line type="monotone" dataKey="Invoice" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="Payment" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* YoY Invoice Trend */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Invoice Trend YoY</h2>
            <ChartPeriodToggle period={chartPeriod} onPeriodChange={setChartPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Line type="monotone" dataKey="2024" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="2025" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Receivables */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Aging Receivables</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Distribution Pie */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Receivables Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={agingData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                {agingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Invoice #</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Customer</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Project</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Project Status</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Invoice Date</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Due Date</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Payment Date</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Payment Method</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-900">{invoice.customer.name}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="max-w-xs truncate" title={invoice.projectName}>
                        {invoice.projectName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <ProjectStatusBadge status={invoice.projectStatus} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(invoice.invoiceDate)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                      {invoice.status === 'overdue' && (
                        <p className="mt-1 text-xs text-red-600">
                          {getDaysOverdue(invoice)} days overdue
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {invoice.paymentDate ? formatDate(invoice.paymentDate) : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {invoice.paymentMethod || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="max-w-xs truncate" title={invoice.notes || ''}>
                        {invoice.notes || '-'}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                    No invoices found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Summary Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-6 text-xl font-bold text-slate-900">Customer Payment Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="pb-3 text-left font-semibold text-slate-700">Customer</th>
                <th className="pb-3 text-right font-semibold text-slate-700">Total Invoiced</th>
                <th className="pb-3 text-right font-semibold text-slate-700">Total Paid</th>
                <th className="pb-3 text-right font-semibold text-slate-700">Outstanding</th>
                <th className="pb-3 text-right font-semibold text-slate-700">Overdue Amount</th>
              </tr>
            </thead>
            <tbody>
              {customerSummaries.map((summary) => (
                <tr key={summary.customerId} className="border-b border-slate-100">
                  <td className="py-4 font-medium text-slate-900">{summary.customerName}</td>
                  <td className="py-4 text-right text-slate-900">
                    {formatCurrency(summary.totalInvoiced)}
                  </td>
                  <td className="py-4 text-right text-green-600 font-semibold">
                    {formatCurrency(summary.totalPaid)}
                  </td>
                  <td className="py-4 text-right text-amber-600 font-semibold">
                    {formatCurrency(summary.outstanding)}
                  </td>
                  <td className="py-4 text-right text-red-600 font-semibold">
                    {formatCurrency(summary.overdueAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
