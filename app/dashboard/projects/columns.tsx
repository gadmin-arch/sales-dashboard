'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

// We duplicate the interface here to avoid circular imports, 
// or ideally we could export it from the page or a shared types file.
export interface ProjectDashboardCalculated {
  prjId: string
  prjName: string
  budgetMaterial: number
  budgetService: number
  budgetTotal: number
  spentMaterial: number
  spentService: number
  spentMeal: number
  reimburseMaterialSpent: number
  reimburseServiceSpent: number
  reimburseCount: number
  mealCount: number
  overtimeHours: number
  reportCount: number
  reportHours: number
  pePicName: string
  peTeamName: string
  
  // calculated dynamically
  spentTotal: number
  overtimeCost: number
  reportCost: number
  calculatedWorkforceCost: number
  matPct: number
  svcPct: number
  totalPct: number
  totalItems: number
}

export const columns: ColumnDef<ProjectDashboardCalculated>[] = [
  {
    accessorKey: 'prjName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Project" className="w-[160px] max-w-[180px]" />,
    cell: ({ row }) => (
      <div className="max-w-[180px]">
        <div className="font-semibold truncate text-xs text-foreground" title={row.getValue('prjName')}>
          {row.getValue('prjName')}
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">
          {row.original.prjId}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'pePicName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="PE PIC" className="w-[110px]" />,
    cell: ({ row }) => (
      <div className="max-w-[110px] truncate text-xs font-medium">
        {row.getValue('pePicName') || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'peTeamName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="PE Team" className="w-[80px]" />,
    cell: ({ row }) => (
      <div className="max-w-[80px] truncate text-xs text-muted-foreground">
        {row.getValue('peTeamName') || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'reportCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reports" className="justify-end w-[90px]" />,
    cell: ({ row }) => (
      <div className="text-right">
        <div className="font-medium text-xs text-foreground">{row.getValue('reportCount')}</div>
        <div className="text-[9px] text-muted-foreground">{row.original.reportHours.toFixed(1)} hrs</div>
      </div>
    ),
  },
  {
    accessorKey: 'overtimeHours',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Overtime" className="justify-end w-[90px]" />,
    cell: ({ row }) => (
      <div className="text-right">
        <div className="font-medium text-xs text-amber-600 dark:text-amber-400">
          {(row.getValue('overtimeHours') as number).toFixed(1)}h
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'matPct',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Material Util %" className="justify-end w-[110px]" />,
    cell: ({ row }) => {
      const v = row.getValue('matPct') as number
      return (
        <div className="text-right font-mono text-xs text-foreground">
          {v > 0 ? `${v.toFixed(1)}%` : '-'}
        </div>
      )
    },
  },
  {
    accessorKey: 'svcPct',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Service Util %" className="justify-end w-[110px]" />,
    cell: ({ row }) => {
      const v = row.getValue('svcPct') as number
      return (
        <div className="text-right font-mono text-xs text-foreground">
          {v > 0 ? `${v.toFixed(1)}%` : '-'}
        </div>
      )
    },
  },
  {
    accessorKey: 'totalPct',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total Util %" className="justify-end w-[130px] font-bold" />,
    cell: ({ row }) => {
      const pct = row.getValue('totalPct') as number
      return (
        <div className="text-right font-bold">
          <div className="flex items-center justify-end gap-2">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-[50px] hidden sm:block">
              <div 
                className={`h-full ${pct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(pct, 100)}%` }} 
              />
            </div>
            <span className={`font-mono text-xs ${pct > 100 ? 'text-red-600 font-bold' : 'text-foreground'}`}>
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>
      )
    },
  },
]
