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
      teams: 'teams',
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
      picCompanies: 'pic_companies',
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
      leadRatings: 'lead_ratings',
    },
  },

  // Opportunities data
  opportunities: {
    spreadsheetId: '1s8vKx8i5EsaNxdLCh3qrvGsuaXfBpamSNyjG-ok9yaw',
    sheets: {
      opportunities: 'opportunities',
    },
  },

  // Invoicing & payments data
  invoicing: {
    spreadsheetId: '1Ej9Ir2RB7hJ6OL1EP-XByHeke-V_iB0nvTbLlTCnUY8',
    sheets: {
      invoices: 'invoices',
      invoiceDetails: 'invoice_details',
      payments: 'payments',
      paymentDetails: 'payment_details',
    },
  },

  // Finance Account Payable & Reimbursements data
  financeAP: {
    paymentRequestSpreadsheetId: '17IGDVtFew69_JV63aCEckpMCYqf2iyIdVPHXkwzI_tQ',
    paymentSpreadsheetId: '1c-WB5QsBtNYFL9LmGuPZSsM2rI9rp6mbFrYvvxEhkGU',
    reimburseSpreadsheetId: '1rcbBN00I7Ql5SIw_DqNPfeUURiuDCFHoml5m02Us9aM',
    typesSpreadsheetId: '1UxiyfROclB1w0UOSlGKSpppSL2FCP84rEsgv9-rDW2s',
    sheets: {
      paymentRequests: 'payment_requests',
      paymentStatuses: 'payment_statuses',
      logPayments: 'log_payments',
      payments: 'payments',
      reimburseCashIn: 'ReimburseCashIn',
      reimburseCashOut: 'ReimburseCashOut',
      cashOutTypes: 'cash_out_types',
      reimburseFile: 'ReimburseFile',
      reimburseStatus: 'ReimburseStatus',
    },
  },

  // Purchasing — purchase requests, quotation requests, vendor quotes
  purchasing: {
    spreadsheetId: '1ZwynlhN0x6R9bvCLrUpthUoc8-n3bejRX8xDJB_j9hM',
    sheets: {
      purchaseRequests: 'purchase_requests',
      quotationRequests: 'quotation_requests',
      qrLists: 'qr_lists',
      prStatuses: 'pr_statuses',
      qrStatuses: 'qr_statuses',
      overdueStatuses: 'overdue_statuses',
      paymentStatuses: 'payment_statuses',
    },
  },

  // Procurement — purchase orders, PO line items, item master
  procurement: {
    spreadsheetId: '1RSd5IX6-ghSij5qM63LyKgonNFoGXX9flykXelOhXmg',
    sheets: {
      pos: 'POs',
      poLists: 'POLists',
      items: 'Items',
      itemTypes: 'ItemTypes',
      itemUnits: 'ItemUnit',
      statuses: 'Status',
      paymentTypes: 'PaymentTypes',
    },
  },

  // Payroll / HR disbursements — payroll, employee loans, meal benefits.
  // Four spreadsheets: the main payroll_db, plus the payroll-payments,
  // meal-benefit-releases, and meal-benefit-evidences ledgers.
  payroll: {
    spreadsheetId: '1KY_pc-ZNgYrdaozEPyqR0ti6wiU1aMYgQqqn2pKhUpc', // payroll_db
    paymentsSpreadsheetId: '1hBMkkUToY4Ep7qOFZPL080GGjAwxcaj0H7e-FQtdXfA', // payroll_payments_db
    mealReleasesSpreadsheetId: '1Ef2becB9JmB8CqTD7oXaVSY6FuItQfK43TGXIvt-ynA', // meal_benefit_releases_db
    mealEvidencesSpreadsheetId: '1-Pkui0EliYHxC4dXBdsPW4M19kNrBxwMi5URjkkAAs4', // meal_benefit_evidences
    travelSpreadsheetId: '1deEsKqfe2-gmM6haarhjGPy96zkQISmq8A7Gz3n-ipo', // travel_allowances
    taxStatusSpreadsheetId: '1mgTN9QE4MWbDefk-9dfQMxkdSsLkvXsruR-fpy_lI9I', // user_ter_statuses
    terSpreadsheetId: '1WNBGLClx9Jrxt954C5UY9l8c61fmadCjmZ0Ge25xTc4', // ters
    sheets: {
      // in payroll_db
      payroll: 'payroll',
      payrollLists: 'payroll_lists',
      payrollCategories: 'payroll_categories',
      payrollTypes: 'payroll_types',
      payrollStatus: 'payroll_status',
      occupations: 'occupations',
      loans: 'loans',
      repayments: 'repayments',
      mealBenefits: 'meal_benefits',
      mealBenefitDetails: 'meal_benefit_details',
      mbTypes: 'mb_types',
      zones: 'zones',
      // in payroll_payments_db
      payrollPayments: 'payroll_payments',
      // in meal_benefit_releases_db
      mealReleases: 'meal_benefit_releases',
      mbrTypes: 'mbr_types',
      // in meal_benefit_evidences
      mealEvidences: 'meal_benefit_evidences',
      // external spreadsheets mapped to config names
      travelAllowances: 'travel_allowances',
      userTerStatuses: 'user_ter_statuses',
      ters: 'ters',
    },
  },

  // Worker daily reports (field/site progress reports)
  reports: {
    spreadsheetId: '1mLwt4zNcZUjSu84_la8ZSZGFgdfD8Cww3dIG_g3Hehc',
    archiveSpreadsheetId: '1bkHV5VtoQaPwnfCQ-OogHEBTmYr0_lH-FhFsAjsVztQ',
    overtimeSpreadsheetId: '1EipjDKsudJGnbyv1GB6c4wE9nvj8z425iueozKcIBYk',
    sheets: {
      reports: 'reports',
      overtimes: 'overtimes',
      leaves: 'leaves',
      holidays: 'holidays',
    },
  },

  // Attendances
  attendances: {
    currentSpreadsheetId: '1ByxCAn-v3ephJjhx85hM1Raz6lfsuUmzIzezcMcMHmE',
    backupSpreadsheetId: '1pQ8NXL7B1FsR02glPJLarLHb1dqS3ioUcQBzjZ-CcAU',
    sheets: {
      attendances: 'attendances',
    },
  },
} as const
