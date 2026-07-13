import { fetchSheet } from '@/database/client'
import { GOOGLE_CONFIG } from '@/database/config'
import { query } from '@/database/db'
import { initDatabase } from '@/database/init'

interface SyncTarget {
  spreadsheetId: string
  sheetName: string
}

const syncTargets: SyncTarget[] = [
  // Users
  { spreadsheetId: GOOGLE_CONFIG.users.spreadsheetId, sheetName: 'users' },

  // Sales Users
  { spreadsheetId: GOOGLE_CONFIG.salesUsers.spreadsheetId, sheetName: GOOGLE_CONFIG.salesUsers.sheets.users },
  { spreadsheetId: GOOGLE_CONFIG.salesUsers.spreadsheetId, sheetName: GOOGLE_CONFIG.salesUsers.sheets.roles },
  { spreadsheetId: GOOGLE_CONFIG.salesUsers.spreadsheetId, sheetName: GOOGLE_CONFIG.salesUsers.sheets.departements },
  { spreadsheetId: GOOGLE_CONFIG.salesUsers.spreadsheetId, sheetName: GOOGLE_CONFIG.salesUsers.sheets.teams },

  // Orders
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.orders },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.orderTypes },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.flags },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.peStatuses },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.projectLog },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.basts },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.bastLog },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.bastStatuses },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.financeLog },
  { spreadsheetId: GOOGLE_CONFIG.orders.spreadsheetId, sheetName: GOOGLE_CONFIG.orders.sheets.financeStatuses },

  // Quotations
  { spreadsheetId: GOOGLE_CONFIG.quotations.spreadsheetId, sheetName: GOOGLE_CONFIG.quotations.sheets.quotations },
  { spreadsheetId: GOOGLE_CONFIG.quotations.spreadsheetId, sheetName: GOOGLE_CONFIG.quotations.sheets.quotationStatuses },
  { spreadsheetId: GOOGLE_CONFIG.quotations.spreadsheetId, sheetName: GOOGLE_CONFIG.quotations.sheets.quotationTypes },
  { spreadsheetId: GOOGLE_CONFIG.quotations.spreadsheetId, sheetName: GOOGLE_CONFIG.quotations.sheets.quotationLog },

  // Companies
  { spreadsheetId: GOOGLE_CONFIG.companies.spreadsheetId, sheetName: GOOGLE_CONFIG.companies.sheets.companies },
  { spreadsheetId: GOOGLE_CONFIG.companies.spreadsheetId, sheetName: GOOGLE_CONFIG.companies.sheets.picCompanies },

  // Sales Activities
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.activities },
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.types },
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.levels },
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.statuses },
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.log },
  { spreadsheetId: GOOGLE_CONFIG.salesActivities.spreadsheetId, sheetName: GOOGLE_CONFIG.salesActivities.sheets.evidences },

  // Leads
  { spreadsheetId: GOOGLE_CONFIG.leads.spreadsheetId, sheetName: GOOGLE_CONFIG.leads.sheets.leads },
  { spreadsheetId: GOOGLE_CONFIG.leads.spreadsheetId, sheetName: GOOGLE_CONFIG.leads.sheets.leadRatings },

  // Opportunities
  { spreadsheetId: GOOGLE_CONFIG.opportunities.spreadsheetId, sheetName: GOOGLE_CONFIG.opportunities.sheets.opportunities },

  // Invoicing & Payments
  { spreadsheetId: GOOGLE_CONFIG.invoicing.spreadsheetId, sheetName: GOOGLE_CONFIG.invoicing.sheets.invoices },
  { spreadsheetId: GOOGLE_CONFIG.invoicing.spreadsheetId, sheetName: GOOGLE_CONFIG.invoicing.sheets.invoiceDetails },
  { spreadsheetId: GOOGLE_CONFIG.invoicing.spreadsheetId, sheetName: GOOGLE_CONFIG.invoicing.sheets.payments },
  { spreadsheetId: GOOGLE_CONFIG.invoicing.spreadsheetId, sheetName: GOOGLE_CONFIG.invoicing.sheets.paymentDetails },

  // Finance AP
  { spreadsheetId: GOOGLE_CONFIG.financeAP.paymentRequestSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.paymentRequests },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.paymentRequestSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.paymentStatuses },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.paymentSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.logPayments },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.paymentSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.payments },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.reimburseSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.reimburseCashIn },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.reimburseSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.reimburseCashOut },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.typesSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.cashOutTypes },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.reimburseSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.reimburseFile },
  { spreadsheetId: GOOGLE_CONFIG.financeAP.reimburseSpreadsheetId, sheetName: GOOGLE_CONFIG.financeAP.sheets.reimburseStatus },

  // Purchasing
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.purchaseRequests },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.quotationRequests },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.qrLists },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.prStatuses },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.qrStatuses },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.overdueStatuses },
  { spreadsheetId: GOOGLE_CONFIG.purchasing.spreadsheetId, sheetName: GOOGLE_CONFIG.purchasing.sheets.paymentStatuses },

  // Procurement
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.pos },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.poLists },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.items },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.itemTypes },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.itemUnits },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.statuses },
  { spreadsheetId: GOOGLE_CONFIG.procurement.spreadsheetId, sheetName: GOOGLE_CONFIG.procurement.sheets.paymentTypes },

  // Payroll
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payroll },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payrollLists },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payrollCategories },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payrollTypes },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payrollStatus },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.occupations },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.loans },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.repayments },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mealBenefits },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mealBenefitDetails },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mbTypes },
  { spreadsheetId: GOOGLE_CONFIG.payroll.spreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.zones },
  { spreadsheetId: GOOGLE_CONFIG.payroll.paymentsSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.payrollPayments },
  { spreadsheetId: GOOGLE_CONFIG.payroll.mealReleasesSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mealReleases },
  { spreadsheetId: GOOGLE_CONFIG.payroll.mealReleasesSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mbrTypes },
  { spreadsheetId: GOOGLE_CONFIG.payroll.mealEvidencesSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.mealEvidences },
  { spreadsheetId: GOOGLE_CONFIG.payroll.travelSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.travelAllowances },
  { spreadsheetId: GOOGLE_CONFIG.payroll.taxStatusSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.userTerStatuses },
  { spreadsheetId: GOOGLE_CONFIG.payroll.terSpreadsheetId, sheetName: GOOGLE_CONFIG.payroll.sheets.ters },

  // Reports
  { spreadsheetId: GOOGLE_CONFIG.reports.spreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.reports },
  { spreadsheetId: GOOGLE_CONFIG.reports.archiveSpreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.reports },
  { spreadsheetId: GOOGLE_CONFIG.reports.overtimeSpreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.overtimes }
]

export async function syncAllSheets(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  console.log('[sync] Starting Google Sheets synchronization...')
  try {
    // 1. Initialize tables
    await initDatabase()

    let syncedCount = 0

    // 2. Fetch and save each sheet
    for (const target of syncTargets) {
      const key = `${target.spreadsheetId}::${target.sheetName}`
      console.log(`[sync] Syncing sheet: ${target.sheetName} (${target.spreadsheetId.substring(0, 8)}...)`)
      
      try {
        const rawData = await fetchSheet(target.spreadsheetId, `${target.sheetName}!A:ZZZ`)
        
        const headers = rawData.length > 0 ? rawData[0] : []
        const rows = rawData.length > 1 ? rawData.slice(1) : []

        await query(`
          INSERT INTO sheets_cache (key, headers, rows, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (key) DO UPDATE
          SET headers = EXCLUDED.headers,
              rows = EXCLUDED.rows,
              updated_at = NOW();
        `, [key, JSON.stringify(headers), JSON.stringify(rows)])

        syncedCount++
      } catch (sheetErr) {
        console.error(`[sync] Failed to sync sheet "${target.sheetName}":`, sheetErr)
        // Continue with other sheets if one fails to keep partial availability
      }
    }

    // 3. Log success metadata
    await query(`
      INSERT INTO sync_metadata (status, last_sync_time)
      VALUES ('SUCCESS', NOW());
    `)

    console.log(`[sync] Sync completed successfully. Synced ${syncedCount}/${syncTargets.length} sheets.`)
    return { success: true, syncedCount }
  } catch (err: any) {
    console.error('[sync] Global sync engine error:', err)
    
    // Log failure metadata
    try {
      await query(`
        INSERT INTO sync_metadata (status, error_message, last_sync_time)
        VALUES ('FAILED', $1, NOW());
      `, [err?.message || String(err)])
    } catch (metaErr) {
      console.error('[sync] Failed to log failure metadata:', metaErr)
    }

    return { success: false, syncedCount: 0, error: err?.message || String(err) }
  }
}
