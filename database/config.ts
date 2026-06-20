// Google Sheets configuration — all sheet IDs and ranges centralized here

export const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'placeholder',

  getServiceAccountCredentials: () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not set')
    try { return JSON.parse(raw) }
    catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON') }
  },

  // User access control (who can log in + roles)
  users: {
    spreadsheetId: '1uTAIhh89eS5XlxGEvmRYZw3cDvMAHP1jejzZIs5oVP4',
    range: 'users!A:E',
  },

  // Sales users (employee directory: id, name, email, role, department)
  salesUsers: {
    spreadsheetId: '1RQXhFN3ifmxExaUtSe78ZpGhuWSQWjnrYFGOExhyRsU',
    sheets: {
      users: 'users',
      roles: 'roles',
      departements: 'departements',
    },
  },

  // Orders / projects data
  orders: {
    spreadsheetId: '13FLiQhCtntVTijB41m5N3lyAQDnq19ML8sVejfLAUDY',
    sheets: {
      orders: 'orders',
      orderTypes: 'order_types',
      flags: 'flags',
      peStatuses: 'pe_statuses',
      projectLog: 'project_log',
      basts: 'basts',
      bastLog: 'bast_log',
      bastStatuses: 'bast_statuses',
      financeLog: 'finance_log',
      financeStatuses: 'finance_statuses',
    },
  },

  // Quotations data
  quotations: {
    spreadsheetId: '1uUMyAtXgAXLKBmTdXuozHlVGyi7JlX83S2Nj-nrhEuk',
    sheets: {
      quotations: 'quotations',
      quotationStatuses: 'quotation_statuses',
      quotationTypes: 'quotation_types',
      quotationLog: 'quotation_log',
    },
  },

  // Companies / customers data
  companies: {
    spreadsheetId: '13qHO4SAo1f4Qv7RRLMeaw4An7GxGX7zaQxsj-mYZsn8',
    sheets: {
      companies: 'companies',
    },
  },

  // Sales activities data
  salesActivities: {
    spreadsheetId: '1w6U9qZgQC85RX1nDDWDKJmpQFpt0HyAn8i4A58gUBM0',
    sheets: {
      activities: 'sales_activities',
      types: 'sa_types',
      levels: 'sa_levels',
      statuses: 'sa_stauses',
      log: 'sa_log',
      evidences: 'sa_evidences',
    },
  },

  // Leads data
  leads: {
    spreadsheetId: '1ocSRpU9XU9qnxOrLTn_ZJ7NFYsMdkd20b_iHsmPRJFo',
    sheets: {
      leads: 'leads',
    },
  },

  // Opportunities data
  opportunities: {
    spreadsheetId: '1s8vKx8i5EsaNxdLCh3qrvGsuaXfBpamSNyjG-ok9yaw',
    sheets: {
      opportunities: 'opportunities',
    },
  },
} as const
