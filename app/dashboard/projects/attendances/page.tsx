import { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { AttendancesDashboard } from '@/components/projects/attendances-dashboard'
import { getAllAccessUsers } from '@/database/repos/users'
import { getAllSalesUsers } from '@/database/repos/sales-users'
import { getAttendancesData, getLeavesData, getOvertimesData, getPublicHolidays } from '@/database/repos/attendances'

export const metadata: Metadata = {
  title: 'Work Hours by Attendances | Sales Dashboard',
  description: 'Track employee work hours based on attendances',
}

export const dynamic = 'force-dynamic'

export default async function AttendancesPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; site?: string }>
}) {
  const [users, salesUsers] = await Promise.all([
    getAllAccessUsers(),
    getAllSalesUsers(),
  ])
  
  const params = await searchParams;
  let dateFrom = params.dateFrom
  const dateTo = params.dateTo
  if (!dateFrom && !dateTo) {
    const d = new Date()
    d.setMonth(d.getMonth() - 2)
    d.setDate(1)
    dateFrom = d.toISOString().split('T')[0]
  }

  const [attendances, leaves, overtimes, holidaysSet] = await Promise.all([
    getAttendancesData(dateFrom, dateTo),
    getLeavesData(dateFrom, dateTo),
    getOvertimesData(dateFrom, dateTo),
    getPublicHolidays(),
  ])

  const siteFilter = params.site?.toUpperCase()

  // Build userId -> name, userId -> siteId, and userId -> jobStatus maps for the client
  const userNameMap: Record<string, string> = {}
  const userSiteMap: Record<string, string> = {}
  const userJobStatusMap: Record<string, string> = {}
  
  const uniqueSites = new Set<string>()
  const uniqueJobStatuses = new Set<string>()
  
  for (const u of salesUsers) {
    if (u.userId) {
      const key = u.userId.toLowerCase()
      userNameMap[key] = u.name
      
      const site = (u.siteId || '').toUpperCase()
      userSiteMap[key] = site
      if (site) uniqueSites.add(site)
        
      const status = (u.jobStatus || '').toUpperCase()
      userJobStatusMap[key] = status
      if (status) uniqueJobStatuses.add(status)
    }
  }

  const filterOptions = {
    userList: Array.from(new Set(salesUsers.map(u => u.name).filter(Boolean))).sort(),
    siteList: Array.from(uniqueSites).sort(),
    jobStatusList: Array.from(uniqueJobStatuses).sort()
  }
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Work Hours by Attendances" 
        description="Track employee work hours, holidays, and overtime based on Google Sheets data."
      />
      <AttendancesDashboard 
        attendances={attendances}
        leaves={leaves}
        overtimes={overtimes}
        publicHolidays={Array.from(holidaysSet)}
        users={users}
        userNameMap={userNameMap}
        userSiteMap={userSiteMap}
        userJobStatusMap={userJobStatusMap}
        filterOptions={filterOptions}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}
