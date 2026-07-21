'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { fmtCurrency, fmtShortDate as fmtDate } from '@/lib/sales-helpers'

export interface InvoiceRow {
  invId: string
  invNumber: string
  prj: string
  leadTime: number | null
  customerId: string
  customer: string
  invoiceDate: string
  dueDate: string
  amount: number
  paid: number
  outstanding: number
  status: string
  statusLabel: string
  daysOverdue: number
  refName: string
  remarks: string
  completedDate: string
  paymentDate: string
  estPaymentDays: number | null
  actualPaymentDays: number | null
  dueDateToPaymentDays: number | null
}

const fmtRp = (v: number) => fmtCurrency(v, 'IDR')

const statusClass: Record<string, string> = {
  overdue_ongoing: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  on_time: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  unpaid: 'bg-muted text-muted-foreground',
}

export const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: 'invNumber',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice #" />,
    cell: ({ row }) => <div className="text-xs font-semibold text-primary">{row.getValue('invNumber')}</div>,
  },
  {
    accessorKey: 'prj',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
    cell: ({ row }) => <div className="text-xs text-muted-foreground">{row.getValue('prj')}</div>,
  },
  {
    accessorKey: 'customer',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => <div className="text-xs whitespace-normal break-words max-w-[280px]">{row.getValue('customer')}</div>,
  },
  {
    accessorKey: 'invoiceDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <div className="text-muted-foreground">{fmtDate(row.getValue('invoiceDate'))}</div>,
  },
  {
    accessorKey: 'completedDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Complete Date" />,
    cell: ({ row }) => {
      const d = row.getValue('completedDate') as string
      return <div className="text-muted-foreground">{d && d !== '-' ? fmtDate(d) : '-'}</div>
    },
  },
  {
    accessorKey: 'dueDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
    cell: ({ row }) => <div className="text-muted-foreground">{fmtDate(row.getValue('dueDate'))}</div>,
  },
  {
    accessorKey: 'paymentDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Date" />,
    cell: ({ row }) => {
      const d = row.getValue('paymentDate') as string
      return <div className="text-muted-foreground">{d && d !== '-' ? fmtDate(d) : '-'}</div>
    },
  },
  {
    accessorKey: 'leadTime',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lead Time" className="justify-end" />,
    cell: ({ row }) => {
      const v = row.getValue('leadTime') as number | null
      return <div className="text-right text-muted-foreground">{v === null ? '-' : `${v}d`}</div>
    },
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className="justify-end" />,
    cell: ({ row }) => <div className="text-right font-medium">{fmtRp(row.getValue('amount'))}</div>,
  },
  {
    accessorKey: 'paid',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Paid" className="justify-end" />,
    cell: ({ row }) => <div className="text-right font-medium text-emerald-600 dark:text-emerald-400">{fmtRp(row.getValue('paid'))}</div>,
  },
  {
    accessorKey: 'outstanding',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" className="justify-end" />,
    cell: ({ row }) => <div className="text-right font-medium">{fmtRp(row.getValue('outstanding'))}</div>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const label = row.original.statusLabel
      return (
        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${statusClass[status] || 'bg-muted text-muted-foreground'}`}>
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'daysOverdue',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Overdue (days)" className="justify-end" />,
    cell: ({ row }) => {
      const v = row.getValue('daysOverdue') as number
      return (
        <div className={`text-right font-medium ${v > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          {v > 0 ? `${v}d` : '-'}
        </div>
      )
    },
  },
]
