// Domain types derived from the Google Sheets schema

// ── access users sheet (for login + roles) ──
export interface AccessUser {
  email: string
  name: string
  sales: boolean
  finance: boolean
  project: boolean
  purchasing: boolean
  payroll: boolean
}

// ── sales users sheet (employee directory) ──
export interface SalesUser {
  userId: string
  email: string
  name: string
  statusId: string
  departementId: string
  siteId: string
  divisionId: string
  teamId: string
  roleId: string
  phone: string
  nik: string
  formalEmail: string
  photo: string
}

export interface SalesRole {
  roleId: string
  roleName: string
  roleLevel: number
}

export interface Departement {
  departementId: string
  departementName: string
}

// ── orders sheet ──
export interface Order {
  prjId: string
  prjName: string
  prjLeadId: string
  prjOId: string
  prjQId: string
  prjType: string
  prjCompanyId: string
  prjEndUserId: string
  prjPiccId: string
  prjOtId: string
  prjPoNumber: string
  prjPoDate: string
  prjPoFile: string
  poCurrency: string
  prjPoMaterial: number
  prjPoService: number
  prjPoTotal: number
  prjEstPoMaterial: number
  prjEstPoService: number
  prjProjectCost: number
  prjFlag: string
  prjStartDate: string
  prjDueDate: string
  prjStartDatePlan: string
  prjDueDatePlan: string
  prjStartDateActual: string
  prjEndDateActual: string
  prjPeStatus: string
  prjFStatus: string
  prjOwner: string
  createdBy: string
  createdAt: string
  deletedAt?: string
}

// ── reference sheets (orders spreadsheet) ──
export interface OrderType {
  otId: string
  otDescription: string
}

export interface Flag {
  flagId: string
  flagDesc: string
}

export interface PeStatus {
  pesId: string
  pesDescription: string
  pesLevel: number
}

export interface ProjectLog {
  plId: string
  plPrjId: string
  plStatusOld: string
  plStatusNew: string
  createdBy: string
  createdAt: string
}

export interface Bast {
  bastId: string
  bastNumber: string
  bastPrjId: string
  bastFile: string
  bastCreatedDate: string
  bastSubmitDate: string
  bastReceivedDate: string
  bastStatus: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  deletedAt: string
}

export interface BastLog {
  blId: string
  blBastId: string
  blStatusOld: string
  blStatusNew: string
  createdBy: string
  createdAt: string
}

export interface BastStatus {
  bsId: string
  bsDescription: string
}

export interface FinanceLog {
  flId: string
  flPrjId: string
  flStatusOld: string
  flStatusNew: string
  createdBy: string
  createdAt: string
}

export interface FinanceStatus {
  fsId: string
  fsDescription: string
}

// ── quotations sheet ──
export interface Quotation {
  qId: string
  qDescription: string
  qQdId: string
  qRfqId: string
  qLeadId: string
  qOId: string
  qCId: string
  qPiccId: string
  qWorkUnit: string
  qCurrency: string
  qBarecostService: number
  qServicePrice: number
  qBarecostMaterial: number
  qMaterialPrice: number
  qBarecostFinal: number
  qFinalPrice: number
  qFlag: string
  qFile: string
  qType: string
  qDate: string
  qStatus: string
  qReferences: string
  qPurchaseService: string
  qRemarks: string
  qOwner: string
  createdBy: string
  deletedAt?: string
}

export interface Company {
  companyId: string
  companyName: string
}

export interface QuotationStatus {
  qsId: string
  qsDescription: string
}

export interface QuotationType {
  qtId: string
  qtDesc: string
}

export interface QuotationLog {
  qlId: string
  qlQId: string
  qlStatusOld: string
  qlStatusNew: string
  createdBy: string
  createdAt: string
}

// ── sales activities sheet ──
export interface SalesActivity {
  saId: string
  saLeadId: string
  saOId: string
  saRfqId: string
  saQId: string
  saPrjId: string
  saDescription: string
  saDate: string
  saType: string
  saLevel: string
  saStatus: string
  saUserId: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  deletedAt?: string
}

export interface SalesActivityType {
  satId: string
  satDescription: string
}

export interface SalesActivityLevel {
  salId: string
  salDescription: string
}

export interface SalesActivityStatus {
  sasId: string
  sasDescription: string
}

export interface SalesActivityLog {
  salogId: string
  salogSaId: string
  salogStatusOld: string
  salogStatusNew: string
  createdBy: string
  createdAt: string
}

export interface SalesActivityEvidence {
  saeId: string
  saeSaId: string
  saeDescription: string
  saeFile: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  deletedAt?: string
}

// ── leads sheet ──
export interface Lead {
  leadId: string
  name: string
  company: string
  contactPerson: string
  phone: string
  email: string
  address: string
  notes: string
  status: string
  source: string
  assignedTo: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  leadDate: string
}

// ── opportunities sheet ──
export interface Opportunity {
  oId: string
  leadId: string
  name: string
  description: string
  company: string
  value: number
  stage: string
  probability: number
  closeDate: string
  assignedTo: string
  status: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  contactPerson?: string
  phone?: string
  email?: string
}

export interface PicCompany {
  piccId: string
  piccCompanyId: string
  piccName: string
  piccContact: string
  piccEmail: string
  piccOccupation: string
}

// ── invoicing spreadsheet ──
export interface Invoice {
  invId: string
  invNumber: string
  invDate: string
  invEstPaymentDate: string
  invCompanyId: string
  invCurrency: string
  invTotal: number
  invNet: number
  invAmount: number
  invPaymentAmount: number
  invPaymentPercentage: number
  invRefName: string
  invRefDescription: string
  invRemarks: string
}

export interface Payment {
  payId: string
  payCompanyId: string
  payDate: string
  payCurrency: string
  payAmount: number
  payTotalAmount: number
  payRemarks: string
  deletedAt: string
}

export interface LeadRating {
  lrId: string
  lrDescription: string
}

// ── purchasing spreadsheet ──
export interface PurchaseRequest {
  prId: string
  prPrfId: string
  prItemId: string
  prQuantity: number
  prQuantityPurchased: number
  prEstimatedPrice: number
  prPurchasedPrice: number
  prVariance: number
  prDuedate: string
  prRemarks: string
  prApprovalStatus: string
  prStatus: string
  prCompletedAt: string
  prOverdueStatus: string
  prProjectId: string
  prHandleBy: string
  prUserId: string
  createdAt: string
  updatedAt: string
  deletedAt: string
}

export interface QuotationRequest {
  qrId: string
  qrQrfId: string
  qrItemId: string
  qrQuantity: number
  qrDuedate: string
  qrRemarks: string
  qrStatus: string
  qrSubmittedAt: string
  qrOverdueStatus: string
  qrHandleBy: string
  qrUserId: string
  createdAt: string
  updatedAt: string
  deletedAt: string
}

export interface QrList {
  qrlId: string
  qrlQrId: string
  qrlPrId: string
  qrlItemId: string
  qrlQuantity: number
  qrlUnit: string
  qrlPrice: number
  qrlTotalPrice: number
  qrlVendor: string
  qrlRemarks: string
  qrlEta: string
  qrlDueDate: string
  qrlStatusId: string
  qrlApprovedAt: string
  qrlApproverId: string
  createdAt: string
  deletedAt: string
}

// reference rows (id + name), shared shape
export interface RefRow {
  id: string
  name: string
}

// ── procurement spreadsheet (POs) ──
export interface PurchaseOrder {
  poNumber: string
  poDate: string
  poCurrency: string
  poCompanyId: string
  poCompanyName: string
  poPaymentType: string
  poDpPercent: number
  poDpTotal: number
  poPaymentProgress: number
  poAmountPayment: number
  poPaymentDueDate: string
  poGross: number
  poDiscount: number
  poNet: number
  poPpn: number
  poPph: number
  poAmount: number
  poDeliveryDate: string
  poReceivedDate: string
  poStatus: string
  poWStatus: string
  poUserId: string
  poUserName: string
}

export interface PoLine {
  polId: string
  polPoNumber: string
  polVendorId: string
  polPrId: string
  polItemId: string
  polItemName: string
  polItemTypeId: string
  polQty: number
  polPrice: number
  polTotal: number
  polPrjId: string
  polLocationId: string
  deletedAt: string
}

export interface ProcItem {
  itemId: string
  itemTypeId: string
  itemName: string
  itemBrand: string
  itemCategory: string
  itemUnit: string
}

// ── Payroll / HR disbursements ──

export interface Payroll {
  userId: string
  payrollAccountId: string
  startDate: string
  endDate: string
  idPayroll: string
  description: string
  reductionAmount: number
  receiptAmount: number
  totalReceipts: number
  thpReduction: number
  thpReceipt: number
  takeHomePay: number
  releasedPrice: number
  file: string
  status: string // R=Release, U=Unrelease, S=Show
  createdBy: string
  updatedAt: string
  createdAt: string
  deletedAt: string
}

// Actual payroll disbursement (payroll_payments_db).
export interface PayrollPayment {
  ppId: string
  payrollId: string
  amount: number
  createdAt: string
  deletedAt: string
}

// A line item on a payslip (allowance / deduction).
export interface PayrollListItem {
  id: string
  payrollId: string
  faId: string
  categoryId: string
  typeId: string // P-1 Pemasukan (+), P-2 Pengurangan (−), …
  amount: number
  remarks: string
  deletedAt: string
}

export interface Occupation {
  occupationId: string
  userId: string
  name: string
  salaryFixed: string
  salaryFix: number
  salaryMeal: number
}

export interface Loan {
  loanId: string
  date: string
  userId: string
  amount: number
  tenor: number
  paid: number
  count: number
  thp: string
  remarks: string
  createdAt: string
  deletedAt: string
}

export interface Repayment {
  repaymentId: string
  date: string
  loanId: string
  userId: string
  amount: number
  thp: string
  count: number
  remarks: string
  createdAt: string
  deletedAt: string
}

export interface MealBenefit {
  mbId: string
  date: string
  startDate: string
  endDate: string
  totalDays: number
  type: string // m-1 Meeting, m-2 PM, m-3 Luar Kota
  totalUser: number
  total: number
  approve: number
  releasePrice: number
  projectId: string
  zone: string
  city: string
  notes: string
  remarks: string
  status: string // A=Approved
  userId: string
  approver: string
  approvedAt: string
  createdAt: string
  deletedAt: string
}

export interface MealBenefitDetail {
  mbdId: string
  mbId: string
  amount: number
  approved: number
  projectId: string
  type: string
  date: string
  userId: string
  userName: string
  deletedAt: string
}

// Disbursement/payback against a meal benefit (meal_benefit_releases_db).
export interface MealBenefitRelease {
  mbrId: string
  mbId: string
  amount: number
  status: string
  type: string // R=Release (+), P=Payback (−)
  createdAt: string
  deletedAt: string
}


