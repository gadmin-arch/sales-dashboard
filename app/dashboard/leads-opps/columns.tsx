'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { fmtCurrency } from '@/lib/sales-helpers'

export interface LeadRow {
  leadId: string
  name: string
  company: string
  contactPerson: string
  phone: string
  email: string
  status: string
  source: string
  assignedName: string
  createdAt: string
  leadDate: string
  notes: string
}

export interface OppRow {
  oId: string
  leadId: string
  name: string
  description: string
  company: string
  value: number
  stage: string
  probability: number
  closeDate: string
  status: string
  assignedName: string
  createdAt: string
  contactPerson: string
  phone: string
  email: string
}

export const leadColumns: ColumnDef<LeadRow>[] = [
  {
    accessorKey: 'leadId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lead ID" />,
    cell: ({ row }) => <div className="text-xs font-semibold text-primary">{row.getValue('leadId')}</div>,
  },
  {
    accessorKey: 'leadDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <div className="text-xs whitespace-nowrap">{row.getValue('leadDate')}</div>,
  },
  {
    accessorKey: 'company',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
    cell: ({ row }) => <div className="text-xs max-w-[140px] truncate">{row.getValue('company')}</div>,
  },
  {
    accessorKey: 'contactPerson',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Person" />,
    cell: ({ row }) => {
      const p = row.original
      return (
        <div className="text-xs">
          <span className="font-medium">{p.contactPerson || '-'}</span>
          {(p.phone || p.email) && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {p.phone} {p.phone && p.email && '|'} {p.email}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
    cell: ({ row }) => (
      <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">
        {(row.getValue('status') as string) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'source',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
    cell: ({ row }) => <div className="text-xs">{row.getValue('source')}</div>,
  },
  {
    accessorKey: 'notes',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Remarks" />,
    cell: ({ row }) => (
      <div className="text-xs max-w-[200px] truncate" title={row.getValue('notes')}>
        {(row.getValue('notes') as string) || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'assignedName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned To" />,
    cell: ({ row }) => <div className="text-xs">{row.getValue('assignedName')}</div>,
  },
]

export const oppColumns: ColumnDef<OppRow>[] = [
  {
    accessorKey: 'oId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Opp ID" />,
    cell: ({ row }) => <div className="text-xs font-semibold text-primary">{row.getValue('oId')}</div>,
  },
  {
    accessorKey: 'leadId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lead ID" />,
    cell: ({ row }) => <div className="text-xs font-medium text-muted-foreground">{(row.getValue('leadId') as string) || '-'}</div>,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => <div className="max-w-[150px] truncate" title={row.getValue('name')}>{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'company',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
    cell: ({ row }) => <div className="text-xs max-w-[120px] truncate">{row.getValue('company')}</div>,
  },
  {
    accessorKey: 'contactPerson',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Person" />,
    cell: ({ row }) => {
      const o = row.original
      return (
        <div className="text-xs">
          <span className="font-medium">{o.contactPerson || '-'}</span>
          {(o.phone || o.email) && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {o.phone} {o.phone && o.email && '|'} {o.email}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Value" className="justify-end" />,
    cell: ({ row }) => <div className="text-right text-xs font-medium">{fmtCurrency(row.getValue('value'))}</div>,
  },
  {
    accessorKey: 'closeDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Close Date" />,
    cell: ({ row }) => <div className="text-xs whitespace-nowrap">{row.getValue('closeDate')}</div>,
  },
  {
    accessorKey: 'stage',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">
        {(row.getValue('stage') as string) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'probability',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Probability" />,
    cell: ({ row }) => <div className="text-xs font-medium">{row.getValue('probability')}%</div>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">
        {(row.getValue('status') as string) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'assignedName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned To" />,
    cell: ({ row }) => <div className="text-xs">{row.getValue('assignedName')}</div>,
  },
]
