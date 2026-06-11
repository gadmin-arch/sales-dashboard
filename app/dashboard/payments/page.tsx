'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Filter, X, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import {
  useInvoices,
  usePaymentSummary,
  useInvoiceVsPaymentTrend,
  useDSO,
  useCollectionRate,
} from '@/lib/hooks'
import { DateRangeFilter } from '@/components/date-range-filter'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
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

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    paid: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Paid',
    },
    due: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      icon: <Clock className="h-4 w-4" />,
      label: 'Due',
    },
    overdue: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      icon: <AlertCircle className="h-4 w-4" />,
      label: 'Overdue',
    },
  }

  const config = statusConfig[status as keyof typeof statusConfig]

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${config.bg} ${config.text}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'amber'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {typeof value === 'number'
              ? `Rp${(value / 1000000000).toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}B`
              : value}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{Icon}</div>
      </div>
    </div>
  )
}

export default function PaymentsDashboard() {
  const allInvoices = useInvoices()
  const paymentSummary = usePaymentSummary(allInvoices)
  const trendData = useInvoiceVsPaymentTrend(allInvoices)
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
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(getYTDDateRange())
  const [showFilters, setShowFilters] = useState(false)
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')

  const customers = useMemo(
    () => Array.from(new Map(allInvoices.map((inv) => [inv.customerId, inv.customer])).values()),
    [allInvoices]
  )

  // Filter invoices with payments
  const filteredPayments = useMemo(() => {
    return allInvoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false
      if (customerFilter !== 'all' && invoice.customerId !== customerFilter) return false

      if (dateRange[0] || dateRange[1]) {
        if (!invoice.paymentDate) return false
        const payDate = new Date(invoice.paymentDate)
        if (dateRange[0] && payDate < dateRange[0]) return false
        if (dateRange[1] && payDate > dateRange[1]) return false
      }

      return true
    })
  }, [allInvoices, statusFilter, customerFilter, dateRange])

  // Payment method distribution
  const paymentMethodDistribution = useMemo(() => {
    const methods: Record<string, number> = {}
    allInvoices
      .filter((inv) => inv.paymentDate)
      .forEach((invoice) => {
        const method = invoice.paymentMethod || 'Unknown'
        methods[method] = (methods[method] || 0) + invoice.amount
      })

    return Object.entries(methods).map(([name, value]) => ({
      name,
      value,
    }))
  }, [allInvoices])

  const formatCurrency = (amount: number) => {
    return `Rp${(amount / 1000000).toLocaleString('id-ID')}`
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const hasActiveFilters =
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    dateRange[0] ||
    dateRange[1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Payment Dashboard</h1>
        <p className="mt-2 text-slate-600">Track payment collection, methods, and cash flow</p>
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

        <div className={`space-y-4 pt-4 lg:flex lg:space-y-0 lg:gap-4 lg:pt-0 ${
          !showFilters && 'hidden lg:flex'
        }`}>
          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
            >
              <option value="all">All Customers</option>
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
            label="Payment Date Range"
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
                setCustomerFilter('all')
                setDateRange(getYTDDateRange())
              }}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Total Paid"
          value={paymentSummary.totalPaid}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="green"
        />
        <SummaryCard
          label="Pending Payments"
          value={paymentSummary.totalOutstanding}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="amber"
        />
        <SummaryCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4a1 1 0 011-1h16a1 1 0 011 1v2.757a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.757a1 1 0 00-.293-.707L3.293 7.464A1 1 0 013 6.757V4z" />
            </svg>
          }
          color="blue"
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
          label="Total Outstanding"
          value={paymentSummary.overdueCount}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invoice vs Payment Trend */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Invoice vs Payment Monthly Trend</h2>
            <ChartPeriodToggle period={chartPeriod} onPeriodChange={setChartPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Invoice" fill="#3b82f6" />
              <Bar dataKey="Payment" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Payment Methods</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMethodDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
              >
                {paymentMethodDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Payment Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                {
                  status: 'Paid',
                  amount: allInvoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
                  count: allInvoices.filter((inv) => inv.status === 'paid').length,
                },
                {
                  status: 'Due',
                  amount: allInvoices.filter((inv) => inv.status === 'due').reduce((sum, inv) => sum + inv.amount, 0),
                  count: allInvoices.filter((inv) => inv.status === 'due').length,
                },
                {
                  status: 'Overdue',
                  amount: allInvoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0),
                  count: allInvoices.filter((inv) => inv.status === 'overdue').length,
                },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="amount" fill="#3b82f6" name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Collection Efficiency */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Collection Summary</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Collection Rate</span>
                <span className="text-sm font-bold text-slate-900">{collectionRate}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-xs text-slate-600">Total Invoiced</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {formatCurrency(paymentSummary.totalInvoiced)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Total Collected</p>
                <p className="mt-1 text-lg font-bold text-green-600">
                  {formatCurrency(paymentSummary.totalPaid)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Invoice #</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-700">Customer</th>
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
              {filteredPayments.length > 0 ? (
                filteredPayments.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-900">{invoice.customer.name}</td>
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
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No payments found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
