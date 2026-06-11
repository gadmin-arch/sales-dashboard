// Legacy mock data types (still used by hooks.ts for invoices page)
export interface Customer {
  id: string
  name: string
  email: string
  phone: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  customerId: string
  customer: Customer
  projectId: string
  projectName: string
  amount: number
  invoiceDate: Date
  dueDate: Date
  poDate: Date
  paymentDate: Date | null
  status: 'paid' | 'due' | 'overdue'
  projectStatus: 'completed' | 'in-progress' | 'pending'
  paymentMethod: string | null
  notes: string | null
}

export interface SalesProject {
  id: string
  name: string
  customer: string
  price: number
  status: 'in-progress' | 'completed'
}

export interface SalesPerson {
  id: string
  name: string
  totalPrice: number
  projects: number
  quotations: number
}

export interface SaleSummaryRow {
  type: 'Project' | 'Service' | 'Material' | 'Total'
  totalQuotation: number
  quotationWon: number
  winRate: number
  totalProject: number
  totalPrice: number
  material: number
  service: number
}

// Re-export database types for backward compatibility
export type {
  AccessUser,
  SalesUser,
  Order,
  OrderType,
  Flag,
  Bast,
  BastLog,
  BastStatus,
  FinanceLog,
  FinanceStatus,
  ProjectLog,
  Quotation,
  QuotationStatus,
  QuotationType,
} from '@/database'
