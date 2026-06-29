import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapInvoice, mapPayment } from '../mappers/invoicing'
import { parseNum } from '../mappers/orders'
import type { Invoice, Payment } from '../types'

/** A payment line from payment_details (the per-invoice collection records). */
export interface PaymentDetail {
  payId: string
  invId: string
  date: string
  amount: number
}

interface InvoicingData {
  invoices: Invoice[]
  payments: Payment[]
  /** inv_id -> order number(s) (prj), from invoice_details */
  invPrjMap: Map<string, string>
  /** per-invoice payment lines, from payment_details */
  paymentDetails: PaymentDetail[]
}

// Fetch fresh on every call; the underlying client (fetchAllRows) falls back to
// the last successfully downloaded copy if a sheet read fails.
async function load(): Promise<InvoicingData> {
  const ss = GOOGLE_CONFIG.invoicing.spreadsheetId
  const s = GOOGLE_CONFIG.invoicing.sheets
  const [invRes, payRes, invDetRes, payDetRes] = await Promise.all([
    fetchAllRows(ss, s.invoices),
    fetchAllRows(ss, s.payments),
    fetchAllRows(ss, s.invoiceDetails),
    fetchAllRows(ss, s.paymentDetails),
  ])
  // Exclude soft-deleted rows: invoices deleted_at = col 36, payments deleted_at = col 16
  const invoices = invRes.rows.filter((r) => r[0] && r[0] !== 'inv_id' && !r[36]).map(mapInvoice)
  const payments = payRes.rows
    .filter((r) => r[0] && r[0] !== 'pay_id' && !r[16])
    .map(mapPayment)

  // invoice_details: invd_inv_id = col 1, invd_prj = col 3, deleted_at = col 26
  const invPrjSets = new Map<string, Set<string>>()
  for (const r of invDetRes.rows) {
    const invId = r[1]
    if (!invId || invId === 'invd_inv_id' || r[26]) continue
    const prj = (r[3] || '').trim()
    if (!prj) continue
    if (!invPrjSets.has(invId)) invPrjSets.set(invId, new Set())
    invPrjSets.get(invId)!.add(prj)
  }
  const invPrjMap = new Map<string, string>()
  for (const [k, v] of invPrjSets) invPrjMap.set(k, [...v].join(', '))

  // payment_details: pd_inv_id = col 2, pd_date = col 3, pd_total_amount = col 13, deleted_at = col 19
  const paymentDetails: PaymentDetail[] = payDetRes.rows
    .filter((r) => r[0] && r[0] !== 'pd_id' && !r[19])
    .map((r) => ({ payId: r[1] || '', invId: r[2] || '', date: r[3] || '', amount: parseNum(r[13]) }))

  return { invoices, payments, invPrjMap, paymentDetails }
}

export async function getInvoicingData(): Promise<InvoicingData> {
  return load()
}

export async function getInvoices(): Promise<Invoice[]> {
  return (await getInvoicingData()).invoices
}

export async function getPayments(): Promise<Payment[]> {
  return (await getInvoicingData()).payments
}
