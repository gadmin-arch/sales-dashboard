import { useMemo } from 'react'
import { Invoice, Customer, SalesProject, SalesPerson, SaleSummaryRow } from './types'

// Mock data - can be replaced with API calls later
const mockCustomers: Customer[] = [
  { id: '1', name: 'PLN (Persero)', email: 'contact@pln.co.id', phone: '+62-21-123-4567' },
  { id: '2', name: 'PT. Industri Maju', email: 'info@industriumaju.com', phone: '+62-21-987-6543' },
  { id: '3', name: 'PT. Sentosa Jaya', email: 'cs@sentosajaya.com', phone: '+62-31-234-5678' },
  { id: '4', name: 'PT. Mega Karya', email: 'support@megakarya.com', phone: '+62-22-345-6789' },
  { id: '5', name: 'PT. Building Pro', email: 'contact@buildingpro.com', phone: '+62-21-456-7890' },
]

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    customerId: '1',
    customer: mockCustomers[0],
    projectId: '1',
    projectName: 'Pembangunan Gardu Induk 150kV',
    amount: 250000000,
    invoiceDate: new Date('2024-05-01'),
    dueDate: new Date('2024-06-01'),
    poDate: new Date('2024-04-15'),
    paymentDate: new Date('2024-05-28'),
    status: 'paid',
    projectStatus: 'in-progress',
    paymentMethod: 'Bank Transfer',
    notes: 'Payment received on time',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    customerId: '2',
    customer: mockCustomers[1],
    projectId: '2',
    projectName: 'Instalasi Panel LVMDP',
    amount: 185000000,
    invoiceDate: new Date('2024-05-05'),
    dueDate: new Date('2024-06-05'),
    poDate: new Date('2024-04-20'),
    paymentDate: null,
    status: 'due',
    projectStatus: 'in-progress',
    paymentMethod: null,
    notes: 'Awaiting customer payment',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    customerId: '3',
    customer: mockCustomers[2],
    projectId: '3',
    projectName: 'Pengadaan & Instalasi Kabel Tray',
    amount: 128500000,
    invoiceDate: new Date('2024-04-20'),
    dueDate: new Date('2024-05-20'),
    poDate: new Date('2024-04-01'),
    paymentDate: null,
    status: 'overdue',
    projectStatus: 'in-progress',
    paymentMethod: null,
    notes: 'Payment overdue - follow up required',
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    customerId: '4',
    customer: mockCustomers[3],
    projectId: '4',
    projectName: 'Upgrade Sistem Kelistrikan Pabrik',
    amount: 98700000,
    invoiceDate: new Date('2024-05-10'),
    dueDate: new Date('2024-06-10'),
    poDate: new Date('2024-05-01'),
    paymentDate: new Date('2024-06-05'),
    status: 'paid',
    projectStatus: 'completed',
    paymentMethod: 'Credit Transfer',
    notes: 'Paid before due date',
  },
  {
    id: '5',
    invoiceNumber: 'INV-2024-005',
    customerId: '5',
    customer: mockCustomers[4],
    projectId: '5',
    projectName: 'Instalasi Lighting System',
    amount: 75300000,
    invoiceDate: new Date('2024-05-15'),
    dueDate: new Date('2024-06-15'),
    poDate: new Date('2024-05-05'),
    paymentDate: null,
    status: 'due',
    projectStatus: 'in-progress',
    paymentMethod: null,
    notes: 'Invoice sent',
  },
  {
    id: '6',
    invoiceNumber: 'INV-2024-006',
    customerId: '1',
    customer: mockCustomers[0],
    projectId: '1',
    projectName: 'Pembangunan Gardu Induk 150kV',
    amount: 320500000,
    invoiceDate: new Date('2024-04-10'),
    dueDate: new Date('2024-05-10'),
    poDate: new Date('2024-03-20'),
    paymentDate: null,
    status: 'overdue',
    projectStatus: 'in-progress',
    paymentMethod: null,
    notes: '15 days overdue',
  },
  // 2025 invoices for YoY comparison
  {
    id: '7',
    invoiceNumber: 'INV-2025-001',
    customerId: '1',
    customer: mockCustomers[0],
    projectId: '1',
    projectName: 'Pembangunan Gardu Induk 150kV',
    amount: 280000000,
    invoiceDate: new Date('2025-05-01'),
    dueDate: new Date('2025-06-01'),
    poDate: new Date('2025-04-15'),
    paymentDate: new Date('2025-05-25'),
    status: 'paid',
    projectStatus: 'completed',
    paymentMethod: 'Bank Transfer',
    notes: 'Project completed ahead of schedule',
  },
  {
    id: '8',
    invoiceNumber: 'INV-2025-002',
    customerId: '2',
    customer: mockCustomers[1],
    projectId: '2',
    projectName: 'Instalasi Panel LVMDP',
    amount: 195000000,
    invoiceDate: new Date('2025-05-05'),
    dueDate: new Date('2025-06-05'),
    poDate: new Date('2025-04-20'),
    paymentDate: new Date('2025-05-30'),
    status: 'paid',
    projectStatus: 'completed',
    paymentMethod: 'Bank Transfer',
    notes: 'Payment received',
  },
  {
    id: '9',
    invoiceNumber: 'INV-2025-003',
    customerId: '3',
    customer: mockCustomers[2],
    projectId: '3',
    projectName: 'Pengadaan & Instalasi Kabel Tray',
    amount: 142000000,
    invoiceDate: new Date('2025-05-10'),
    dueDate: new Date('2025-06-10'),
    poDate: new Date('2025-04-25'),
    paymentDate: null,
    status: 'due',
    projectStatus: 'in-progress',
    paymentMethod: null,
    notes: 'Awaiting payment',
  },
]

const mockSalesProjects: SalesProject[] = [
  {
    id: '1',
    name: 'Pembangunan Gardu Induk 150kV',
    customer: 'PLN (Persero)',
    price: 250000000,
    status: 'in-progress',
  },
  {
    id: '2',
    name: 'Instalasi Panel LVMDP',
    customer: 'PT. Industri Maju',
    price: 185000000,
    status: 'in-progress',
  },
  {
    id: '3',
    name: 'Pengadaan & Instalasi Kabel Tray',
    customer: 'PT. Sentosa Jaya',
    price: 128500000,
    status: 'in-progress',
  },
  {
    id: '4',
    name: 'Upgrade Sistem Kelistrikan Pabrik',
    customer: 'PT. Mega Karya',
    price: 98700000,
    status: 'completed',
  },
  {
    id: '5',
    name: 'Instalasi Lighting System',
    customer: 'PT. Building Pro',
    price: 75300000,
    status: 'in-progress',
  },
]

const mockSalesPeople: SalesPerson[] = [
  { id: '1', name: 'Andi Setiawan', totalPrice: 320500000, projects: 7, quotations: 4 },
  { id: '2', name: 'Budi Hartono', totalPrice: 218750000, projects: 4, quotations: 3 },
  { id: '3', name: 'Citra Lestari', totalPrice: 185300000, projects: 3, quotations: 2 },
  { id: '4', name: 'Devi Sartika', totalPrice: 142600000, projects: 2, quotations: 2 },
  { id: '5', name: 'Eko Prasetyo', totalPrice: 115350000, projects: 2, quotations: 1 },
]

// Invoice Hooks
export function useInvoices(): Invoice[] {
  return useMemo(() => mockInvoices, [])
}

export function usePaymentSummary(invoices: Invoice[]) {
  return useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalPaid = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0)
    const totalOutstanding = totalInvoiced - totalPaid
    const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length
    const paidThisMonth = invoices
      .filter((inv) => {
        const now = new Date()
        return (
          inv.status === 'paid' &&
          inv.paymentDate &&
          new Date(inv.paymentDate).getMonth() === now.getMonth() &&
          new Date(inv.paymentDate).getFullYear() === now.getFullYear()
        )
      })
      .reduce((sum, inv) => sum + inv.amount, 0)

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      overdueCount,
      paidThisMonth,
    }
  }, [invoices])
}

export function useCustomerInvoiceSummaries(invoices: Invoice[]) {
  return useMemo(() => {
    const customerMap = new Map<string, {
      customerId: string
      customerName: string
      totalInvoiced: number
      totalPaid: number
      outstanding: number
      overdueAmount: number
    }>()

    invoices.forEach((invoice) => {
      if (!customerMap.has(invoice.customerId)) {
        customerMap.set(invoice.customerId, {
          customerId: invoice.customerId,
          customerName: invoice.customer.name,
          totalInvoiced: 0,
          totalPaid: 0,
          outstanding: 0,
          overdueAmount: 0,
        })
      }

      const summary = customerMap.get(invoice.customerId)!
      summary.totalInvoiced += invoice.amount

      if (invoice.status === 'paid') {
        summary.totalPaid += invoice.amount
      } else {
        summary.outstanding += invoice.amount
      }

      if (invoice.status === 'overdue') {
        summary.overdueAmount += invoice.amount
      }
    })

    return Array.from(customerMap.values()).sort(
      (a, b) => b.outstanding - a.outstanding
    )
  }, [invoices])
}

export function useFilteredInvoices(
  invoices: Invoice[],
  filters: {
    status?: string
    customerId?: string
    invoiceStatus?: string
    projectStatus?: string
    invoiceDateStart?: Date
    invoiceDateEnd?: Date
    poDateStart?: Date
    poDateEnd?: Date
    paymentDateStart?: Date
    paymentDateEnd?: Date
    filterLogic?: 'AND' | 'OR'
  }
) {
  return useMemo(() => {
    return invoices.filter((invoice) => {
      const conditions = []

      // Payment Status
      if (filters.status && invoice.status !== filters.status) {
        conditions.push(false)
      } else {
        conditions.push(true)
      }

      // Invoice Status (financial status)
      if (filters.invoiceStatus && invoice.status !== filters.invoiceStatus) {
        conditions.push(false)
      } else {
        conditions.push(true)
      }

      // Project Status
      if (filters.projectStatus && invoice.projectStatus !== filters.projectStatus) {
        conditions.push(false)
      } else {
        conditions.push(true)
      }

      // Customer
      if (filters.customerId && invoice.customerId !== filters.customerId) {
        conditions.push(false)
      } else {
        conditions.push(true)
      }

      // Invoice Date Range
      if (filters.invoiceDateStart || filters.invoiceDateEnd) {
        const invDate = new Date(invoice.invoiceDate)
        const isInRange =
          (!filters.invoiceDateStart || invDate >= filters.invoiceDateStart) &&
          (!filters.invoiceDateEnd || invDate <= filters.invoiceDateEnd)
        conditions.push(isInRange)
      } else {
        conditions.push(true)
      }

      // PO Date Range
      if (filters.poDateStart || filters.poDateEnd) {
        const poDate = new Date(invoice.poDate)
        const isInRange =
          (!filters.poDateStart || poDate >= filters.poDateStart) &&
          (!filters.poDateEnd || poDate <= filters.poDateEnd)
        conditions.push(isInRange)
      } else {
        conditions.push(true)
      }

      // Payment Date Range
      if (filters.paymentDateStart || filters.paymentDateEnd) {
        if (invoice.paymentDate) {
          const payDate = new Date(invoice.paymentDate)
          const isInRange =
            (!filters.paymentDateStart || payDate >= filters.paymentDateStart) &&
            (!filters.paymentDateEnd || payDate <= filters.paymentDateEnd)
          conditions.push(isInRange)
        } else {
          conditions.push(false)
        }
      } else {
        conditions.push(true)
      }

      // Apply logic (AND = all must be true, OR = at least one must be true)
      if (filters.filterLogic === 'OR') {
        return conditions.some((c) => c)
      } else {
        return conditions.every((c) => c)
      }
    })
  }, [invoices, filters])
}

export function useInvoiceTrendData(invoices: Invoice[]) {
  return useMemo(() => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]

    const data2024 = new Array(12).fill(0)
    const data2025 = new Array(12).fill(0)

    invoices.forEach((invoice) => {
      const year = new Date(invoice.invoiceDate).getFullYear()
      const month = new Date(invoice.invoiceDate).getMonth()

      if (year === 2024) {
        data2024[month] += invoice.amount
      } else if (year === 2025) {
        data2025[month] += invoice.amount
      }
    })

    return Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      '2024': data2024[i],
      '2025': data2025[i],
    }))
  }, [invoices])
}

export function useAgingReceivableData(invoices: Invoice[]) {
  return useMemo(() => {
    const today = new Date()
    const aging = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    }

    invoices.forEach((invoice) => {
      if (invoice.status !== 'paid') {
        const dueDate = new Date(invoice.dueDate)
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysOverdue <= 30) {
          aging['0-30'] += invoice.amount
        } else if (daysOverdue <= 60) {
          aging['31-60'] += invoice.amount
        } else if (daysOverdue <= 90) {
          aging['61-90'] += invoice.amount
        } else {
          aging['90+'] += invoice.amount
        }
      }
    })

    return [
      { name: '0-30 Days', value: aging['0-30'], percentage: 0 },
      { name: '31-60 Days', value: aging['31-60'], percentage: 0 },
      { name: '61-90 Days', value: aging['61-90'], percentage: 0 },
      { name: '90+ Days', value: aging['90+'], percentage: 0 },
    ]
  }, [invoices])
}

export function useInvoiceVsPaymentTrend(invoices: Invoice[]) {
  return useMemo(() => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]

    const invoiceData = new Array(12).fill(0)
    const paymentData = new Array(12).fill(0)

    invoices.forEach((invoice) => {
      // Invoice data
      const invMonth = new Date(invoice.invoiceDate).getMonth()
      invoiceData[invMonth] += invoice.amount

      // Payment data
      if (invoice.paymentDate) {
        const payMonth = new Date(invoice.paymentDate).getMonth()
        paymentData[payMonth] += invoice.amount
      }
    })

    return Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      Invoice: invoiceData[i],
      Payment: paymentData[i],
    }))
  }, [invoices])
}

// Sales Hooks
export function useSalesData() {
  return useMemo(() => {
    const kpis = {
      quotation: 56,
      projects: 18,
      sales: 982500000,
      materialPrice: 612300000,
      servicePrice: 370200000,
    }

    const chartData = {
      revenueTrend: [
        { name: 'May 1', value: 75000000 },
        { name: 'May 6', value: 165000000 },
        { name: 'May 11', value: 125000000 },
        { name: 'May 16', value: 95000000 },
        { name: 'May 21', value: 155000000 },
        { name: 'May 26', value: 145000000 },
        { name: 'May 31', value: 175000000 },
      ],
      salesByType: [
        { name: 'Project', value: 612300000 },
        { name: 'Service', value: 370200000 },
      ],
      priceComposition: [
        { name: 'May 1', material: 35000000, service: 40000000 },
        { name: 'May 6', material: 85000000, service: 80000000 },
        { name: 'May 11', material: 65000000, service: 60000000 },
        { name: 'May 16', material: 45000000, service: 50000000 },
        { name: 'May 21', material: 80000000, service: 75000000 },
        { name: 'May 26', material: 75000000, service: 70000000 },
        { name: 'May 31', material: 95000000, service: 80000000 },
      ],
    }

    return {
      kpis,
      chartData,
      topProjects: mockSalesProjects,
      topSalesPeople: mockSalesPeople,
      summary: [
        {
          type: 'Project' as const,
          totalQuotation: 32,
          quotationWon: 14,
          winRate: 43.8,
          totalProject: 14,
          totalPrice: 612300000,
          material: 365700000,
          service: 246600000,
        },
        {
          type: 'Service' as const,
          totalQuotation: 20,
          quotationWon: 9,
          winRate: 45.0,
          totalProject: 9,
          totalPrice: 370200000,
          material: 246600000,
          service: 123600000,
        },
        {
          type: 'Material' as const,
          totalQuotation: 4,
          quotationWon: 3,
          winRate: 75.0,
          totalProject: 0,
          totalPrice: 0,
          material: 0,
          service: 0,
        },
        {
          type: 'Total' as const,
          totalQuotation: 56,
          quotationWon: 26,
          winRate: 46.4,
          totalProject: 23,
          totalPrice: 982500000,
          material: 612300000,
          service: 370200000,
        },
      ] as SaleSummaryRow[],
    }
  }, [])
}

// DSO (Days Sales Outstanding) - average days to collect payment
export function useDSO(invoices: Invoice[]) {
  return useMemo(() => {
    const paidInvoices = invoices.filter((inv) => inv.paymentDate)
    
    if (paidInvoices.length === 0) return 0
    
    const totalDays = paidInvoices.reduce((sum, inv) => {
      const invoiceDate = new Date(inv.invoiceDate)
      const paymentDate = new Date(inv.paymentDate!)
      const days = Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
      return sum + days
    }, 0)
    
    return Math.round(totalDays / paidInvoices.length)
  }, [invoices])
}

// Collection Rate - percentage of invoiced amount collected
export function useCollectionRate(invoices: Invoice[]) {
  return useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalCollected = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0)
    
    if (totalInvoiced === 0) return 0
    return ((totalCollected / totalInvoiced) * 100).toFixed(1)
  }, [invoices])
}

// Uninvoiced Amount - from projects not yet invoiced (projected)
export function useUninvoicedAmount(invoices: Invoice[], projects: SalesProject[]) {
  return useMemo(() => {
    const invoicedProjectIds = new Set(invoices.map((inv) => inv.projectId))
    
    const uninvoicedProjects = projects.filter((proj) => !invoicedProjectIds.has(proj.id))
    
    const uninvoicedAmount = uninvoicedProjects.reduce((sum, proj) => {
      // Assume uninvoiced is the difference between estimated total and invoiced
      const estimatedTotal = Math.floor(Math.random() * 500000000) + 100000000
      return sum + estimatedTotal
    }, 0)
    
    return uninvoicedAmount
  }, [invoices, projects])
}
