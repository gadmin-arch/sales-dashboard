'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FileText, Briefcase, DollarSign, TrendingUp, Loader2, Search } from 'lucide-react'

interface SalesData {
  kpis: { totalProjects: number; totalSales: number; totalQuotations: number; totalQuotationValue: number }
  quotStatusBreakdown: Record<string, number>
  salesByType: { name: string; value: number }[]
  revenueTrend: { name: string; value: number; material: number; service: number }[]
  priceComposition: { name: string; material: number; service: number }[]
  poComposition: { name: string; value: number }[]
  topProjects: { prjId: string; name: string; salesOwner: string; customer: string; type: string; currency: string; total: number; material: number; service: number; poDate: string }[]
  topSalesPersons: { name: string; totalPrice: number; projectCount: number; quotationCount: number }[]
  summary: { type: string; quotationCount: number; projectCount: number; totalPrice: number; material: number; service: number }[]
  salesUserList: { id: string; name: string; email: string }[]
  currencyList: string[]
  orderTypeList: { otId: string; otDescription: string }[]
}

const PIE_COLORS = ['#38bdf8', '#00e5a0', '#fbbf24', '#f87171', '#818cf8', '#fb923c', '#a78bfa']

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return 'Rp' + (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return 'Rp' + (v / 1_000_000).toFixed(0) + 'M'
  if (v >= 1_000) return 'Rp' + (v / 1_000).toFixed(0) + 'K'
  return 'Rp' + v.toLocaleString('id-ID')
}

function formatDateDisplay(d: string) {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ── Scoped Dark Navy Styles ── */
const darkNavyStyles = {
  '--background': '#0a1628',
  '--foreground': '#f8fafc',
  '--card': '#0f1f35',
  '--card-foreground': '#f8fafc',
  '--popover': '#0f1f35',
  '--popover-foreground': '#f8fafc',
  '--primary': '#38bdf8',
  '--primary-foreground': '#0a1628',
  '--secondary': '#1e293b',
  '--secondary-foreground': '#f8fafc',
  '--muted': '#1a2d4a',
  '--muted-foreground': '#94a3b8',
  '--accent': '#1a2d4a',
  '--accent-foreground': '#f8fafc',
  '--destructive': '#7f1d1d',
  '--destructive-foreground': '#f8fafc',
  '--border': '#1e2d4a',
  '--input': '#1e2d4a',
  '--ring': '#38bdf8',
  backgroundColor: '#0a1628',
  color: '#f8fafc',
} as React.CSSProperties

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1f35] border border-[#1e2d4a] rounded-lg p-3 shadow-lg">
      <p className="text-slate-400 text-xs mb-1.5 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {fmtRp(Number(entry.value))}
        </p>
      ))}
    </div>
  )
}

export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')
  const [tableSearch, setTableSearch] = useState('')
  const [tableCustomerFilter, setTableCustomerFilter] = useState('all')
  const [tableSalesOwnerFilter, setTableSalesOwnerFilter] = useState('all')
  const [tableOrderTypeFilter, setTableOrderTypeFilter] = useState('all')

  const getYTDDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(now.getFullYear(), 0, 1)
    return {
      dateFrom: start.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0]
    }
  }

  const [dateFrom, setDateFrom] = useState(getYTDDateRange().dateFrom)
  const [dateTo, setDateTo] = useState(getYTDDateRange().dateTo)
  const [salesUser, setSalesUser] = useState('all')
  const [currency, setCurrency] = useState('all')
  const [orderType, setOrderType] = useState('all')

  const [localDateFrom, setLocalDateFrom] = useState(dateFrom)
  const [localDateTo, setLocalDateTo] = useState(dateTo)
  const [localSalesUser, setLocalSalesUser] = useState(salesUser)
  const [localCurrency, setLocalCurrency] = useState(currency)
  const [localOrderType, setLocalOrderType] = useState(orderType)

  const fetchData = useCallback(async (params: Record<string, string>) => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'all') p.set(k, v)
      })
      const res = await fetch('/api/sales/overview?' + p.toString())
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData({
      dateFrom,
      dateTo,
      salesUser: salesUser === 'all' ? '' : salesUser,
      currency: currency === 'all' ? '' : currency,
      orderType: orderType === 'all' ? '' : orderType,
      period: chartPeriod
    })
  }, [fetchData])

  const handlePeriodChange = (p: 'monthly' | 'weekly') => {
    setChartPeriod(p)
    fetchData({
      dateFrom,
      dateTo,
      salesUser: salesUser === 'all' ? '' : salesUser,
      currency: currency === 'all' ? '' : currency,
      orderType: orderType === 'all' ? '' : orderType,
      period: p
    })
  }

  const handleApplyFilters = () => {
    setDateFrom(localDateFrom)
    setDateTo(localDateTo)
    setSalesUser(localSalesUser)
    setCurrency(localCurrency)
    setOrderType(localOrderType)
    fetchData({
      dateFrom: localDateFrom,
      dateTo: localDateTo,
      salesUser: localSalesUser === 'all' ? '' : localSalesUser,
      currency: localCurrency === 'all' ? '' : localCurrency,
      orderType: localOrderType === 'all' ? '' : localOrderType,
      period: chartPeriod
    })
  }

  const handleClearFilters = () => {
    const defaultRange = getYTDDateRange()
    setLocalDateFrom(defaultRange.dateFrom)
    setLocalDateTo(defaultRange.dateTo)
    setLocalSalesUser('all')
    setLocalCurrency('all')
    setLocalOrderType('all')

    setDateFrom(defaultRange.dateFrom)
    setDateTo(defaultRange.dateTo)
    setSalesUser('all')
    setCurrency('all')
    setOrderType('all')

    fetchData({
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
      salesUser: '',
      currency: '',
      orderType: '',
      period: chartPeriod
    })
  }

  const setQuickRange = (range: 'thisMonth' | 'last30' | '6month' | '1year' | 'lastYear' | 'YTD') => {
    const today = new Date()
    let from = ''
    let to = today.toISOString().split('T')[0]
    
    if (range === 'YTD') {
      from = `${today.getFullYear()}-01-01`
    } else if (range === 'thisMonth') {
      from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    } else if (range === 'last30') {
      const past = new Date()
      past.setDate(today.getDate() - 30)
      from = past.toISOString().split('T')[0]
    } else if (range === '6month') {
      const past = new Date()
      past.setMonth(today.getMonth() - 6)
      from = past.toISOString().split('T')[0]
    } else if (range === '1year') {
      const past = new Date()
      past.setFullYear(today.getFullYear() - 1)
      from = past.toISOString().split('T')[0]
    } else if (range === 'lastYear') {
      const lastYear = today.getFullYear() - 1
      from = `${lastYear}-01-01`
      to = `${lastYear}-12-31`
    }
    
    setLocalDateFrom(from)
    setLocalDateTo(to)
  }

  const filteredProjects = useMemo(() => {
    if (!data) return []
    let projects = data.topProjects

    // 1. Search
    if (tableSearch) {
      const q = tableSearch.toLowerCase()
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        p.salesOwner.toLowerCase().includes(q) ||
        p.prjId.toLowerCase().includes(q)
      )
    }

    // 2. Customer
    if (tableCustomerFilter && tableCustomerFilter !== 'all') {
      projects = projects.filter(p => p.customer === tableCustomerFilter)
    }

    // 3. Sales Owner
    if (tableSalesOwnerFilter && tableSalesOwnerFilter !== 'all') {
      projects = projects.filter(p => p.salesOwner === tableSalesOwnerFilter)
    }

    // 4. Order Type
    if (tableOrderTypeFilter && tableOrderTypeFilter !== 'all') {
      projects = projects.filter(p => p.type === tableOrderTypeFilter)
    }

    return projects.slice(0, 10)
  }, [data, tableSearch, tableCustomerFilter, tableSalesOwnerFilter, tableOrderTypeFilter])

  const uniqueCustomers = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.topProjects.forEach(p => {
      if (p.customer) set.add(p.customer)
    })
    return Array.from(set).sort()
  }, [data])

  const uniqueSalesOwners = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.topProjects.forEach(p => {
      if (p.salesOwner) set.add(p.salesOwner)
    })
    return Array.from(set).sort()
  }, [data])

  const uniqueOrderTypes = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.topProjects.forEach(p => {
      if (p.type) set.add(p.type)
    })
    return Array.from(set).sort()
  }, [data])

  const salesByTypeTotal = useMemo(() => {
    return data?.salesByType?.reduce((s, x) => s + x.value, 0) || 0
  }, [data])

  const poCompositionTotal = useMemo(() => {
    return data?.poComposition?.reduce((s, x) => s + x.value, 0) || 0
  }, [data])

  const summaryTotals = useMemo(() => {
    if (!data || !data.summary) return { projectCount: 0, material: 0, service: 0, totalPrice: 0 }
    return data.summary.reduce(
      (acc, row) => {
        acc.projectCount += row.projectCount
        acc.material += row.material
        acc.service += row.service
        acc.totalPrice += row.totalPrice
        return acc
      },
      { projectCount: 0, material: 0, service: 0, totalPrice: 0 }
    )
  }, [data])

  // Custom select arrow styles
  const selectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1rem',
    paddingRight: '2.25rem',
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-[#0a1628] text-slate-100">
        <Loader2 className="animate-spin h-8 w-8 text-[#38bdf8]" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#0a1628] text-slate-100">
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={() => handleClearFilters()}>Retry</Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="dark bg-background text-foreground min-h-screen p-8 space-y-6" style={darkNavyStyles}>
      <style>{`
        @keyframes loadingSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .loading-bar-inner {
          animation: loadingSlide 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p>
        </div>
      </div>

      {/* Loading line indicator */}
      {loading && data && (
        <div className="w-full h-1 bg-[#1e2d4a] overflow-hidden rounded-full mb-6 relative">
          <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-[#38bdf8] to-[#00e5a0] rounded-full loading-bar-inner" />
        </div>
      )}

      {/* Filter Card */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range Inputs */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={localDateFrom}
                  onChange={(e) => setLocalDateFrom(e.target.value)}
                  className="w-full rounded-md border border-[#1e2d4a] bg-[#0a1628] px-3 py-1.5 text-sm text-foreground outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={localDateTo}
                  onChange={(e) => setLocalDateTo(e.target.value)}
                  className="w-full rounded-md border border-[#1e2d4a] bg-[#0a1628] px-3 py-1.5 text-sm text-foreground outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                />
              </div>
              {/* Quick Date Range Buttons */}
              <div className="flex flex-wrap gap-1 mt-2">
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('thisMonth')}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('last30')}>
                  Last 30 Days
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('6month')}>
                  6 Months
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('1year')}>
                  1 Year
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('lastYear')}>
                  Last Year
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-input hover:bg-slate-800" onClick={() => setQuickRange('YTD')}>
                  YTD
                </Button>
              </div>
            </div>

            {/* Sales Person Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Sales Owner</label>
              <select
                value={localSalesUser}
                onChange={(e) => setLocalSalesUser(e.target.value)}
                className="w-full rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1.5 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={selectStyle}
              >
                <option value="all" className="bg-[#0f1f35] text-[#f8fafc]">All Sales Owners</option>
                {data.salesUserList.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#0f1f35] text-[#f8fafc]">{u.name}</option>
                ))}
              </select>
            </div>

            {/* Currency Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Currency</label>
              <select
                value={localCurrency}
                onChange={(e) => setLocalCurrency(e.target.value)}
                className="w-full rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1.5 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={selectStyle}
              >
                <option value="all" className="bg-[#0f1f35] text-[#f8fafc]">All Currencies</option>
                {data.currencyList.map((c) => (
                  <option key={c} value={c} className="bg-[#0f1f35] text-[#f8fafc]">{c}</option>
                ))}
              </select>
            </div>

            {/* Order Type Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Order Type</label>
              <select
                value={localOrderType}
                onChange={(e) => setLocalOrderType(e.target.value)}
                className="w-full rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1.5 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={selectStyle}
              >
                <option value="all" className="bg-[#0f1f35] text-[#f8fafc]">All Order Types</option>
                {data.orderTypeList.map((ot) => (
                  <option key={ot.otId} value={ot.otId} className="bg-[#0f1f35] text-[#f8fafc]">{ot.otDescription}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Apply & Clear buttons */}
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={handleClearFilters} className="bg-transparent text-foreground border-input hover:bg-slate-800">
              Clear Filters
            </Button>
            <Button onClick={handleApplyFilters} className="bg-[#38bdf8] text-[#0a1628] hover:bg-[#38bdf8]/90 font-semibold">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Projects"
          value={data.kpis.totalProjects.toString()}
          icon={<Briefcase className="h-5 w-5" />}
        />
        <KPICard
          title="Total Sales"
          value={fmtRp(data.kpis.totalSales)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          title="Total Quotations"
          value={data.kpis.totalQuotations.toString()}
          icon={<FileText className="h-5 w-5" />}
        />
        <KPICard
          title="Quotation Value"
          value={fmtRp(data.kpis.totalQuotationValue)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Charts Grid 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sales Revenue Trends */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Sales Revenue Trends</CardTitle>
            <ChartPeriodToggle period={chartPeriod} onPeriodChange={handlePeriodChange} />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.revenueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMaterial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00e5a0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#1e2d4a' }} className="text-xs" />
                <YAxis stroke="#94a3b8" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="material" stackId="1" stroke="#38bdf8" fillOpacity={1} fill="url(#colorMaterial)" name="PO Material" />
                <Area type="monotone" dataKey="service" stackId="1" stroke="#00e5a0" fillOpacity={1} fill="url(#colorService)" name="PO Service" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Type (Donut) */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Sales by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.salesByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return percent > 0.05 ? (
                      <text x={x} y={y} fill="#0a1628" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {data.salesByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const pct = salesByTypeTotal > 0 ? (Number(value) / salesByTypeTotal * 100).toFixed(1) : '0.0'
                    return [`${fmtRp(Number(value))} (${pct}%)`, name]
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const item = data.salesByType.find((entry) => entry.name === value)
                    const pct = (item && salesByTypeTotal > 0) ? (item.value / salesByTypeTotal * 100).toFixed(1) : '0.0'
                    return <span className="text-xs text-slate-300">{value} ({pct}%)</span>
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PO Composition (Donut) */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">PO Composition</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.poComposition}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return percent > 0.05 ? (
                      <text x={x} y={y} fill="#0a1628" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {data.poComposition.map((entry, index) => {
                    const COMP_COLORS: Record<string, string> = { 'PO Material': '#38bdf8', 'PO Service': '#00e5a0' }
                    return <Cell key={`cell-${entry.name}`} fill={COMP_COLORS[entry.name] || '#38bdf8'} />
                  })}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const pct = poCompositionTotal > 0 ? (Number(value) / poCompositionTotal * 100).toFixed(1) : '0.0'
                    return [`${fmtRp(Number(value))} (${pct}%)`, name]
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const item = data.poComposition.find((entry) => entry.name === value)
                    const pct = (item && poCompositionTotal > 0) ? (item.value / poCompositionTotal * 100).toFixed(1) : '0.0'
                    return <span className="text-xs text-slate-300">{value} ({pct}%)</span>
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Price Composition */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Price Composition (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.priceComposition} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#1e2d4a' }} className="text-xs" />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="material" stackId="a" fill="#38bdf8" name="Material %" />
                <Bar dataKey="service" stackId="a" fill="#00e5a0" name="Service %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quotation Status */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Quotation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(data.quotStatusBreakdown).map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                >
                  {Object.keys(data.quotStatusBreakdown).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Projects & Top Sales Persons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top Projects Table */}
        <Card className="lg:col-span-2 border-border overflow-hidden">
          <CardHeader className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base font-semibold text-foreground">Top Projects</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full rounded-md border border-input bg-[#0a1628] pl-8 pr-3 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <select
                value={tableCustomerFilter}
                onChange={(e) => setTableCustomerFilter(e.target.value)}
                className="rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1 text-xs outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={{ ...selectStyle, paddingRight: '1.75rem', backgroundPosition: 'right 0.5rem center' }}
              >
                <option value="all" className="bg-[#0f1f35]">All Customers</option>
                {uniqueCustomers.map(c => (
                  <option key={c} value={c} className="bg-[#0f1f35]">{c}</option>
                ))}
              </select>
              <select
                value={tableSalesOwnerFilter}
                onChange={(e) => setTableSalesOwnerFilter(e.target.value)}
                className="rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1 text-xs outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={{ ...selectStyle, paddingRight: '1.75rem', backgroundPosition: 'right 0.5rem center' }}
              >
                <option value="all" className="bg-[#0f1f35]">All Sales Owners</option>
                {uniqueSalesOwners.map(so => (
                  <option key={so} value={so} className="bg-[#0f1f35]">{so}</option>
                ))}
              </select>
              <select
                value={tableOrderTypeFilter}
                onChange={(e) => setTableOrderTypeFilter(e.target.value)}
                className="rounded-md border border-[#1e2d4a] bg-[#0a1628] text-[#f8fafc] px-3 py-1 text-xs outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] appearance-none cursor-pointer"
                style={{ ...selectStyle, paddingRight: '1.75rem', backgroundPosition: 'right 0.5rem center' }}
              >
                <option value="all" className="bg-[#0f1f35]">All Types</option>
                {uniqueOrderTypes.map(ot => (
                  <option key={ot} value={ot} className="bg-[#0f1f35]">{ot}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sales Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No projects found
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr key={p.prjId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#38bdf8]">{p.prjId}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate" title={p.name}>{p.name}</td>
                        <td className="px-4 py-3">{p.customer}</td>
                        <td className="px-4 py-3">{p.salesOwner}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-200 border border-slate-700">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#f8fafc]">{fmtRp(p.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Sales Persons List */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Top Sales Persons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topSalesPersons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data found</p>
            ) : (
              data.topSalesPersons.map((sp, i) => {
                const maxPrice = data.topSalesPersons[0]?.totalPrice || 1
                const pct = (sp.totalPrice / maxPrice) * 100
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 border border-slate-700 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{sp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sp.projectCount} projects · {sp.quotationCount} quotations
                      </p>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${PIE_COLORS[i % PIE_COLORS.length]}, ${PIE_COLORS[i % PIE_COLORS.length]}88)`
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-bold text-foreground shrink-0">{fmtRp(sp.totalPrice)}</div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Sales Summary by Type (Orders Only) */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-foreground">Sales Summary by Type</CardTitle>
          <span className="inline-flex rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
            Orders Only
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Projects</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Material</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Service</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.summary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No data
                    </td>
                  </tr>
                ) : (
                  data.summary.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground">{row.type}</td>
                      <td className="px-6 py-3 text-right">{row.projectCount}</td>
                      <td className="px-6 py-3 text-right text-sky-400">{fmtRp(row.material)}</td>
                      <td className="px-6 py-3 text-right text-emerald-400">{fmtRp(row.service)}</td>
                      <td className="px-6 py-3 text-right font-bold text-foreground">{fmtRp(row.totalPrice)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.summary.length > 0 && (
                <tfoot className="border-t border-border bg-slate-800/50 font-semibold">
                  <tr>
                    <td className="px-6 py-3 text-left text-foreground">Total</td>
                    <td className="px-6 py-3 text-right text-foreground">{summaryTotals.projectCount}</td>
                    <td className="px-6 py-3 text-right text-sky-400 font-bold">{fmtRp(summaryTotals.material)}</td>
                    <td className="px-6 py-3 text-right text-emerald-400 font-bold">{fmtRp(summaryTotals.service)}</td>
                    <td className="px-6 py-3 text-right font-extrabold text-[#f8fafc]">{fmtRp(summaryTotals.totalPrice)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
