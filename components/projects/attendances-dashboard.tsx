'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DateRangeRow } from '@/components/date-range-row'
import { FilterCard } from '@/components/filter-card'
import { DonutChart } from '@/components/donut-chart'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import type { AttendanceRecord, LeaveRecord, OvertimeRecord } from '@/database/repos/attendances'
import type { AccessUser } from '@/database/types'
import { getYTD } from '@/lib/sales-helpers'
import { KPICard } from '@/components/kpi-card'
import { Clock, CalendarOff, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/multi-select'
import type { ColumnDef } from '@tanstack/react-table'

interface AttendancesDashboardProps {
  attendances: AttendanceRecord[]
  leaves: LeaveRecord[]
  overtimes: OvertimeRecord[]
  publicHolidays: string[]
  users: AccessUser[]
  userNameMap: Record<string, string>
  userSiteMap: Record<string, string>
  userJobStatusMap: Record<string, string>
  filterOptions: {
    userList: string[]
    siteList: string[]
    jobStatusList: string[]
  }
  dateFrom?: string
  dateTo?: string
}

function parseOvertimeHours(timeStr: string): number {
  if (!timeStr) return 0
  const parsed = parseFloat(timeStr)
  if (!isNaN(parsed) && !timeStr.includes(':')) {
    const hours = parsed > 16 ? 8 : parsed
    return hours
  }
  const match = timeStr.match(/(\d+):(\d+)/)
  if (match) {
    const h = parseInt(match[1]) || 0
    const m = parseInt(match[2]) || 0
    let hours = h + m / 60
    if (hours > 16) hours = 8
    return hours
  }
  return 0
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Attendance table row type ──
interface AttendanceRow {
  userId: string
  userName: string
  date: string
  workHours: number
  type: 'work' | 'holiday' | 'weekend'
  clockIn?: string
  clockOut?: string
}

// ── Columns ──
function getAttendanceColumns(): ColumnDef<AttendanceRow, any>[] {
  return [
    {
      accessorKey: 'userName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.userName}</div>
          <div className="text-xs text-muted-foreground">{row.original.userId.toUpperCase()}</div>
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'clockIn',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Clock In" />,
      cell: ({ row }) => <span className="text-sm">{row.original.clockIn || '-'}</span>,
    },
    {
      accessorKey: 'clockOut',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Clock Out" />,
      cell: ({ row }) => <span className="text-sm">{row.original.clockOut || '-'}</span>,
    },
    {
      accessorKey: 'workHours',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Hours" />,
      cell: ({ row }) => <span className="text-sm font-mono">{row.original.workHours.toFixed(1)}h</span>,
    },
    {
      accessorKey: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const t = row.original.type
        return (
          <Badge variant={t === 'work' ? 'default' : t === 'holiday' ? 'destructive' : 'secondary'} className="text-xs">
            {t === 'work' ? 'Work Day' : t === 'holiday' ? 'Public Holiday' : 'Weekend'}
          </Badge>
        )
      },
    },
  ]
}

function getLeaveColumns(): ColumnDef<LeaveRecord & { userName: string }, any>[] {
  return [
    {
      accessorKey: 'userName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.userName}</div>
          <div className="text-xs text-muted-foreground">{row.original.userId.toUpperCase()}</div>
        </div>
      ),
    },
    {
      accessorKey: 'startDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.startDate)}</span>,
    },
    {
      accessorKey: 'endDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.endDate)}</span>,
    },
    {
      accessorKey: 'totalDays',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Days" />,
      cell: ({ row }) => <span className="text-sm font-mono">{row.original.totalDays}</span>,
    },
    {
      accessorKey: 'reason',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reason || row.original.remarks || '-'}</span>,
    },
  ]
}

function getOvertimeColumns(): ColumnDef<OvertimeRecord & { userName: string; hours: number }, any>[] {
  return [
    {
      accessorKey: 'userName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.userName}</div>
          <div className="text-xs text-muted-foreground">{row.original.userId.toUpperCase()}</div>
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'hours',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Hours" />,
      cell: ({ row }) => <span className="text-sm font-mono">{row.original.hours.toFixed(1)}h</span>,
    },
    {
      accessorKey: 'reason',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reason || row.original.remarks || '-'}</span>,
    },
  ]
}

export function AttendancesDashboard({
  attendances,
  leaves,
  overtimes,
  publicHolidays,
  users,
  userNameMap,
  userSiteMap,
  userJobStatusMap,
  filterOptions,
  dateFrom,
  dateTo
}: AttendancesDashboardProps) {
  const router = useRouter()
  
  const [localFrom, setLocalFrom] = useState(dateFrom || '')
  const [localTo, setLocalTo] = useState(dateTo || '')
  
  // -- Filter states --
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>([])
  const [selectedDayType, setSelectedDayType] = useState<string>('all')

  const [showAttTable, setShowAttTable] = useState(false)
  const [showLeaveTable, setShowLeaveTable] = useState(false)
  const [showOtTable, setShowOtTable] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'workHours' | 'holidayHours' | 'overtime' | null>(null)

  const handleBarClick = (data: any, type: 'workHours' | 'holidayHours' | 'overtime') => {
    const clickedMonth = data?.payload?.month || data?.month;
    if (!clickedMonth) return;

    if (selectedMonth === clickedMonth && selectedType === type) {
      setSelectedMonth(null)
      setSelectedType(null)
    } else {
      setSelectedMonth(clickedMonth)
      setSelectedType(type)
      
      // Auto expand relevant table
      if (type === 'workHours' || type === 'holidayHours') {
        setShowAttTable(true)
      } else if (type === 'overtime') {
        setShowOtTable(true)
      }
    }
  }

  const getName = (userId: string) => userNameMap[userId.toLowerCase()] || userId.toUpperCase()

  const applyFilters = (from: string, to: string) => {
    setLocalFrom(from)
    setLocalTo(to)
    const params = new URLSearchParams(window.location.search)
    if (from) params.set('dateFrom', from)
    else params.delete('dateFrom')
    if (to) params.set('dateTo', to)
    else params.delete('dateTo')
    
    router.push(`?${params.toString()}`, { scroll: false })
  }
  
  const filteredAttendances = useMemo(() => {
    const holidaysSet = new Set(publicHolidays)
    return attendances.filter(a => {
      const u = a.userId.toLowerCase()
      if (selectedUsers.length > 0 && !selectedUsers.includes(userNameMap[u])) return false
      const site = (userSiteMap[u] || '').toUpperCase()
      if (selectedSites.length > 0 && !selectedSites.includes(site)) return false
      const job = (userJobStatusMap[u] || '').toUpperCase()
      if (selectedJobStatuses.length > 0 && !selectedJobStatuses.includes(job)) return false
      
      const day = new Date(a.date).getDay()
      const isPublicHoliday = holidaysSet.has(a.date)
      const isHO = !site || site === 'HO'
      const isWeekend = isHO ? (day === 0 || day === 6) : (day === 0)
      
      if (selectedDayType === 'workday' && (isPublicHoliday || isWeekend)) return false
      if (selectedDayType === 'holiday' && (!isPublicHoliday && !isWeekend)) return false
      
      return true
    })
  }, [attendances, selectedUsers, selectedSites, selectedJobStatuses, selectedDayType, userNameMap, userSiteMap, userJobStatusMap, publicHolidays])

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      const u = l.userId.toLowerCase()
      if (selectedUsers.length > 0 && !selectedUsers.includes(userNameMap[u])) return false
      const site = (userSiteMap[u] || '').toUpperCase()
      if (selectedSites.length > 0 && !selectedSites.includes(site)) return false
      const job = (userJobStatusMap[u] || '').toUpperCase()
      if (selectedJobStatuses.length > 0 && !selectedJobStatuses.includes(job)) return false
      
      // Note: leaves don't have a specific "dayType", so we skip the selectedDayType filter or just allow them
      if (selectedDayType === 'workday' || selectedDayType === 'holiday') return false // if they filter by day type, maybe don't show leaves? Or maybe we just ignore it. Let's ignore it for now.
      
      return true
    })
  }, [leaves, selectedUsers, selectedSites, selectedJobStatuses, selectedDayType, userNameMap, userSiteMap, userJobStatusMap])

  const filteredOvertimes = useMemo(() => {
    const holidaysSet = new Set(publicHolidays)
    return overtimes.filter(o => {
      const u = o.userId.toLowerCase()
      if (selectedUsers.length > 0 && !selectedUsers.includes(userNameMap[u])) return false
      const site = (userSiteMap[u] || '').toUpperCase()
      if (selectedSites.length > 0 && !selectedSites.includes(site)) return false
      const job = (userJobStatusMap[u] || '').toUpperCase()
      if (selectedJobStatuses.length > 0 && !selectedJobStatuses.includes(job)) return false
      
      const day = new Date(o.date).getDay()
      const isPublicHoliday = holidaysSet.has(o.date)
      const isHO = !site || site === 'HO'
      const isWeekend = isHO ? (day === 0 || day === 6) : (day === 0)
      
      if (selectedDayType === 'workday' && (isPublicHoliday || isWeekend)) return false
      if (selectedDayType === 'holiday' && (!isPublicHoliday && !isWeekend)) return false
      
      return true
    })
  }, [overtimes, selectedUsers, selectedSites, selectedJobStatuses, selectedDayType, userNameMap, userSiteMap, userJobStatusMap, publicHolidays])

  const processedData = useMemo(() => {
    const holidaysSet = new Set(publicHolidays)
    
    // Per-user site check: HO or blank = Sat+Sun off, others = Sun only
    const isUserWeekend = (userId: string, dayOfWeek: number) => {
      const site = userSiteMap[userId.toLowerCase()] || ''
      const isHO = !site || site === 'HO'
      return isHO ? (dayOfWeek === 0 || dayOfWeek === 6) : (dayOfWeek === 0)
    }
    
    const monthlyData = new Map<string, { month: string, workHours: number, holidayHours: number, overtime: number }>()
    
    for (const a of filteredAttendances) {
      const d = new Date(a.date)
      const day = d.getDay()
      const isPublicHoliday = holidaysSet.has(a.date)
      const isWeekend = isUserWeekend(a.userId, day)
      
      const monthKey = getMonthKey(a.date)
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: monthKey, workHours: 0, holidayHours: 0, overtime: 0 })
      }
      const entry = monthlyData.get(monthKey)!
      
      if (isPublicHoliday || isWeekend) {
        entry.holidayHours += a.workHours
      } else {
        entry.workHours += a.workHours
      }
    }
    
    for (const o of filteredOvertimes) {
      const monthKey = getMonthKey(o.date)
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: monthKey, workHours: 0, holidayHours: 0, overtime: 0 })
      }
      const entry = monthlyData.get(monthKey)!
      entry.overtime += parseOvertimeHours(o.timeStr)
    }
    
    const result = Array.from(monthlyData.values())
    result.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    
    return result
  }, [filteredAttendances, filteredOvertimes, publicHolidays, userSiteMap])
  
  const totalLeaveDays = useMemo(() => {
    let total = 0
    for (const l of filteredLeaves) {
      total += l.totalDays
    }
    return total
  }, [filteredLeaves])
  
  const totalWorkHours = processedData.reduce((acc, curr) => acc + curr.workHours, 0)
  const totalHolidayHours = processedData.reduce((acc, curr) => acc + curr.holidayHours, 0)
  const totalOvertime = processedData.reduce((acc, curr) => acc + curr.overtime, 0)
  
  const proportionData = useMemo(() => [
    { name: 'Work Hours', value: totalWorkHours },
    { name: 'Holiday Work', value: totalHolidayHours },
    { name: 'Overtime', value: totalOvertime }
  ].filter(d => d.value > 0), [totalWorkHours, totalHolidayHours, totalOvertime])

  const attendanceTableData = useMemo<AttendanceRow[]>(() => {
    const holidaysSet = new Set(publicHolidays)
    return filteredAttendances
      .filter(a => !selectedMonth || getMonthKey(a.date) === selectedMonth)
      .map(a => {
        const d = new Date(a.date)
        const day = d.getDay()
        const isPublicHoliday = holidaysSet.has(a.date)
        const site = userSiteMap[a.userId.toLowerCase()] || ''
        const isHO = !site || site === 'HO'
        const isWeekend = isHO ? (day === 0 || day === 6) : (day === 0)
        let type: 'work' | 'holiday' | 'weekend' = 'work'
        if (isPublicHoliday) type = 'holiday'
        else if (isWeekend) type = 'weekend'
        return {
          userId: a.userId,
          userName: getName(a.userId),
          date: a.date,
          workHours: a.workHours,
          type,
        }
      })
      .filter(a => {
        if (selectedType === 'workHours') return a.type === 'work'
        if (selectedType === 'holidayHours') return a.type === 'holiday' || a.type === 'weekend'
        if (selectedType === 'overtime') return false
        return true
      })
  }, [filteredAttendances, publicHolidays, userSiteMap, userNameMap, selectedMonth, selectedType])

  const leaveTableData = useMemo(() => {
    return filteredLeaves
      .filter(l => !selectedMonth || getMonthKey(l.startDate) === selectedMonth || getMonthKey(l.endDate) === selectedMonth)
      .filter(l => !selectedType)
      .map(l => ({ ...l, userName: getName(l.userId) }))
  }, [filteredLeaves, userNameMap, selectedMonth, selectedType])

  const overtimeTableData = useMemo(() => {
    return filteredOvertimes
      .filter(o => !selectedMonth || getMonthKey(o.date) === selectedMonth)
      .filter(o => {
        if (selectedType === 'workHours' || selectedType === 'holidayHours') return false
        return true
      })
      .map(o => ({ ...o, userName: getName(o.userId), hours: parseOvertimeHours(o.timeStr) }))
  }, [filteredOvertimes, userNameMap, selectedMonth, selectedType])

  const attColumns = useMemo(() => getAttendanceColumns(), [])
  const leaveColumns = useMemo(() => getLeaveColumns(), [])
  const otColumns = useMemo(() => getOvertimeColumns(), [])

  return (
    <div className="space-y-6">
      <FilterCard 
        from={localFrom}
        to={localTo}
        onDateChange={(from, to) => { setLocalFrom(from); setLocalTo(to) }}
        onApply={() => applyFilters(localFrom, localTo)}
        onClear={() => {
          const d = getYTD()
          setLocalFrom(d.from)
          setLocalTo(d.to)
          applyFilters(d.from, d.to)
        }}
        hasUnapplied={localFrom !== (dateFrom || '') || localTo !== (dateTo || '')}
        dateLabel="Date Range"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">User Site</label>
            <MultiSelect 
              allLabel="All Sites" 
              selected={selectedSites} 
              onChange={setSelectedSites} 
              options={filterOptions.siteList.map(s => ({ label: s, value: s }))} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Worker</label>
            <MultiSelect 
              allLabel="All Workers" 
              selected={selectedUsers} 
              onChange={setSelectedUsers} 
              options={filterOptions.userList.map(u => ({ label: u, value: u }))} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Job Status</label>
            <MultiSelect 
              allLabel="All Job Statuses" 
              selected={selectedJobStatuses} 
              onChange={setSelectedJobStatuses} 
              options={filterOptions.jobStatusList.map(j => ({ label: j, value: j }))} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Day Type</label>
            <Select value={selectedDayType} onValueChange={setSelectedDayType}>
              <SelectTrigger className="w-full text-xs h-9 bg-background"><SelectValue>All Days</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Days</SelectItem>
                <SelectItem value="workday">Normal Workday</SelectItem>
                <SelectItem value="holiday">Holiday & Weekend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Work Hours"
          value={Math.round(totalWorkHours).toLocaleString()}
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          description="Normal working days"
        />
        <KPICard
          title="Holiday Work Hours"
          value={Math.round(totalHolidayHours).toLocaleString()}
          icon={<CalendarCheck className="w-5 h-5 text-orange-500" />}
          description="Weekends & Public Holidays"
        />
        <KPICard
          title="Total Overtime"
          value={Math.round(totalOvertime).toLocaleString() + ' hrs'}
          icon={<Clock className="w-5 h-5 text-purple-500" />}
          description="Approved overtime"
        />
        <KPICard
          title="Total Leave/Sick"
          value={totalLeaveDays.toLocaleString() + ' days'}
          icon={<CalendarOff className="w-5 h-5 text-red-500" />}
          description="Approved leaves"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Work Hours Trend
                {selectedMonth && (
                  <Badge 
                    variant="default" 
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 font-mono" 
                    onClick={(e) => { e.stopPropagation(); setSelectedMonth(null); setSelectedType(null); }}
                  >
                    {selectedMonth} ({selectedType === 'workHours' ? 'Work' : selectedType === 'holidayHours' ? 'Holiday' : 'Overtime'}) ✕
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Monthly breakdown of working hours, holiday work, and overtime (Click bar to filter tables below)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                />
                <Legend />
                <Bar 
                  dataKey="workHours" 
                  name="Work Hours" 
                  stackId="a" 
                  fill="#3b82f6" 
                  radius={[0, 0, 4, 4]} 
                  onClick={(data) => handleBarClick(data, 'workHours')}
                  cursor="pointer"
                >
                  {processedData.map((entry, index) => {
                    const isDimmed = selectedMonth && (selectedMonth !== entry.month || selectedType !== 'workHours')
                    return <Cell key={`cell-work-${index}`} fill="#3b82f6" fillOpacity={isDimmed ? 0.2 : 1} />
                  })}
                </Bar>
                <Bar 
                  dataKey="holidayHours" 
                  name="Holiday Work" 
                  stackId="a" 
                  fill="#f97316" 
                  onClick={(data) => handleBarClick(data, 'holidayHours')}
                  cursor="pointer"
                >
                  {processedData.map((entry, index) => {
                    const isDimmed = selectedMonth && (selectedMonth !== entry.month || selectedType !== 'holidayHours')
                    return <Cell key={`cell-holiday-${index}`} fill="#f97316" fillOpacity={isDimmed ? 0.2 : 1} />
                  })}
                </Bar>
                <Bar 
                  dataKey="overtime" 
                  name="Overtime" 
                  stackId="a" 
                  fill="#a855f7" 
                  radius={[4, 4, 0, 0]} 
                  onClick={(data) => handleBarClick(data, 'overtime')}
                  cursor="pointer"
                >
                  {processedData.map((entry, index) => {
                    const isDimmed = selectedMonth && (selectedMonth !== entry.month || selectedType !== 'overtime')
                    return <Cell key={`cell-ot-${index}`} fill="#a855f7" fillOpacity={isDimmed ? 0.2 : 1} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Hours Distribution</CardTitle>
            <CardDescription>Proportion of worked hours</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pt-6">
            <div className="w-full max-w-[280px]">
              <DonutChart 
                data={proportionData}
                donut={true}
                total={totalWorkHours + totalHolidayHours + totalOvertime}
                formatValue={(val) => Math.round(val).toLocaleString() + 'h'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Attendances Data Table ── */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowAttTable(!showAttTable)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Attendance Records
                <Badge variant="secondary" className="text-xs font-mono">{attendanceTableData.length.toLocaleString()}</Badge>
                {selectedMonth && (
                  <Badge variant="outline" className="text-xs ml-2 bg-muted/50">
                    Filtered: {selectedMonth} {selectedType === 'workHours' ? '(Work)' : selectedType === 'holidayHours' ? '(Holiday)' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Individual attendance entries with hours worked</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showAttTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showAttTable && (
          <CardContent className="p-0">
            <DataTable columns={attColumns} data={attendanceTableData} />
          </CardContent>
        )}
      </Card>

      {/* ── Leaves Data Table ── */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowLeaveTable(!showLeaveTable)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Leave Records
                <Badge variant="secondary" className="text-xs font-mono">{leaveTableData.length.toLocaleString()}</Badge>
                {selectedMonth && (
                  <Badge variant="outline" className="text-xs ml-2 bg-muted/50">
                    Filtered: {selectedMonth}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Approved leave and sick day entries</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showLeaveTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showLeaveTable && (
          <CardContent className="p-0">
            <DataTable columns={leaveColumns} data={leaveTableData} />
          </CardContent>
        )}
      </Card>

      {/* ── Overtime Data Table ── */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowOtTable(!showOtTable)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Overtime Records
                <Badge variant="secondary" className="text-xs font-mono">{overtimeTableData.length.toLocaleString()}</Badge>
                {selectedMonth && selectedType === 'overtime' && (
                  <Badge variant="outline" className="text-xs ml-2 bg-muted/50">
                    Filtered: {selectedMonth} (Overtime)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Approved overtime entries with hours</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showOtTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showOtTable && (
          <CardContent className="p-0">
            <DataTable columns={otColumns} data={overtimeTableData} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
