'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { fmtCurrency } from '@/lib/sales-helpers'

export interface CustomerSummaryRow {
  customer: string
  customerId: string
  totalInvoiced: number
  totalPaid: number
  outstanding: number
  overdue: number
  avgInvoiceToPaymentDays: number | null
  avgPoToInvoiceDays: number | null
  totalPo: number
  poMaterial: number
  poService: number
}

const fmtRp = (v: number) => fmtCurrency(v, 'IDR')

export const columns: ColumnDef<CustomerSummaryRow>[] = [
  {
    accessorKey: 'customer',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => (
      <div className="font-medium text-xs whitespace-normal break-words max-w-[200px]">
        {row.getValue('customer')}
      </div>
    ),
  },
  {
    accessorKey: 'totalPo',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total PO" className="justify-end" />,
    cell: ({ row }) => {
      const c = row.original
      return (
        <div className="text-right text-xs min-w-[160px]">
          <div className="font-semibold text-primary">{fmtRp(c.totalPo)}</div>
          {c.totalPo > 0 ? (
            <div className="mt-1.5 w-full space-y-1">
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-sky-500"
                  style={{ width: `${(c.poMaterial / c.totalPo) * 100}%` }}
                  title={`Material: ${((c.poMaterial / c.totalPo) * 100).toFixed(1)}%`}
                />
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(c.poService / c.totalPo) * 100}%` }}
                  title={`Service: ${((c.poService / c.totalPo) * 100).toFixed(1)}%`}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground whitespace-nowrap gap-2">
                <span className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                  Mat: {((c.poMaterial / c.totalPo) * 100).toFixed(0)}% ({fmtRp(c.poMaterial)})
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  Svc: {((c.poService / c.totalPo) * 100).toFixed(0)}% ({fmtRp(c.poService)})
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">—</div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'totalInvoiced',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoiced" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right text-xs font-medium">
        {fmtRp(row.getValue('totalInvoiced'))}
      </div>
    ),
  },
  {
    accessorKey: 'totalPaid',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Paid" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        {fmtRp(row.getValue('totalPaid'))}
      </div>
    ),
  },
  {
    accessorKey: 'outstanding',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right text-xs text-amber-600 dark:text-amber-400 font-medium">
        {fmtRp(row.getValue('outstanding'))}
      </div>
    ),
  },
  {
    accessorKey: 'overdue',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Overdue" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right text-xs text-rose-600 dark:text-rose-400 font-medium">
        {fmtRp(row.getValue('overdue'))}
      </div>
    ),
  },
  {
    accessorKey: 'avgPoToInvoiceDays',
    header: ({ column }) => <DataTableColumnHeader column={column} title="PO to Invoice" className="justify-end" />,
    cell: ({ row }) => {
      const v = row.getValue('avgPoToInvoiceDays') as number | null
      return (
        <div className="text-right text-xs text-muted-foreground font-medium">
          {v !== null ? `${v}d` : '—'}
        </div>
      )
    },
  },
  {
    accessorKey: 'avgInvoiceToPaymentDays',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice to Payment" className="justify-end" />,
    cell: ({ row }) => {
      const v = row.getValue('avgInvoiceToPaymentDays') as number | null
      return (
        <div className="text-right text-xs text-muted-foreground font-medium">
          {v !== null ? `${v}d` : '—'}
        </div>
      )
    },
  },
]
