// Domain types derived from the Google Sheets schema

// ── access users sheet (for login + roles) ──
export interface AccessUser {
  email: string
  name: string
  sales: boolean
  finance: boolean
  project: boolean
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
