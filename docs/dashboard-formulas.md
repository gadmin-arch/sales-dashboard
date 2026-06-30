# Dokumentasi Rumus — Semua Dashboard

Tujuan: setiap angka (KPI/scorecard, chart, kolom tabel) ditulis sebagai **rumus konkret** —
`SUM(kolom) WHERE syarat` — memakai nama kolom asli di Google Sheet. Semua perhitungan ada di
API route (`app/api/.../route.ts`); halaman hanya menampilkan.

## Cara baca rumus (legend)

| Notasi | Arti |
|---|---|
| `SUM(Sheet.kolom)` | jumlahkan nilai kolom (semua baris yang lolos filter) |
| `COUNT(rows WHERE ...)` | hitung jumlah baris yang memenuhi syarat |
| `DISTINCT_COUNT(Sheet.kolom)` | jumlah nilai unik |
| `GROUP BY kolom` | dikelompokkan per nilai kolom (untuk chart) |
| `setelah filter` | **selalu** = setelah filter rentang tanggal + filter dropdown + cross-filter (klik chart) diterapkan |
| angka uang | di-parse `parseNum` → "Rp", titik, koma, "%" dibuang (`"Rp72,000"`→72000, `"100.00%"`→100) |
| tanggal | di-parse `parseDate` → dukung `MM/DD/YYYY`, `DD-MM-YYYY`, ISO, `"03 Jan 2023"` |

**Proses umum tiap request:** baca sheet (cache 5 menit, `?fresh=1` paksa baca ulang) → buang baris
`deleted_at` terisi (soft-delete) → terapkan filter → hitung. Default rentang tanggal = **YTD**.
Label kode→teks diambil dari tab referensi masing-masing (mis. status PO `A`→`Approved`).

---

## 1. Sales Overview — `/dashboard/sales`
**Sumber:** `orders` (project) + `quotations`. **Tanggal:** order = `prj_po_date`, quotation = `q_date`.
**Filter:** sales user, currency, order type, project status (`prj_pe_status`), invoice status (`prj_f_status`).

| Metrik | Rumus |
|---|---|
| Total Projects | `COUNT(orders)` setelah filter |
| Total Sales | `SUM(orders.prj_po_total)` |
| Total Quotations | `COUNT(quotations)` setelah filter |
| Total Quotation Value | `SUM(quotations.q_final_price)` |
| Quotation Status (donut) | `COUNT(quotations) GROUP BY q_status` |
| Sales by Order Type | `SUM(prj_po_total) GROUP BY prj_ot_id` |
| Revenue Trend (bulanan) | `SUM(prj_po_total) GROUP BY bulan(prj_po_date)` (tooltip: material=`SUM(prj_po_material)`, service=`SUM(prj_po_service)`) |
| Price Composition (100%) | per bulan: material% = `SUM(prj_po_material) / (SUM(prj_po_material)+SUM(prj_po_service)) × 100`; service% = `100 − material%` |
| PO Composition (donut) | PO Material = `SUM(prj_po_material)`, PO Service = `SUM(prj_po_service)` |
| Top Projects (tabel) | baris order diurut `prj_po_total` desc |
| Top Sales Persons | per `prj_owner` (atau owner quotation terhubung): total=`SUM(prj_po_total)`, projectCount=`COUNT(orders)`, quotationCount=`COUNT(quotations milik owner)` |
| Summary by Type | per order type: projectCount, `SUM(prj_po_total)`, `SUM(prj_po_material)`, `SUM(prj_po_service)` |

**Quotation Summary by Type** (per `q_type`):
- Total Quotation = `COUNT(quotations of type)`
- Total Won = `COUNT(quotations of type WHERE ada order dengan prj_q_id = q_id)`
- Won % = `Won / Total × 100`
- Won Final Price = `SUM(q_final_price WHERE won)`
- Order Price from Quotation = `SUM(orders.prj_po_total WHERE prj_q_id ∈ won quotations)`
- Order/Won Price % = `Order Price from Quotation / Won Final Price × 100`

---

## 2. Sales Activities — `/dashboard/sales/activities`
**Sumber:** `sales_activities`. **Tanggal:** `sa_date`. Status: `D`=Done, `TD`=To Do, `H`=Hold, `C`=Cancel; level `H`=High.

| Metrik | Rumus |
|---|---|
| Total Activities | `COUNT(rows)` setelah filter |
| Completion Rate | `COUNT(sa_status='D') / Total × 100` |
| Activities This Week | `COUNT(rows WHERE sa_date ≥ hari_ini − 7 hari)` |
| High Priority | `COUNT(rows WHERE sa_level='H')` |
| Done / To Do / Hold / Cancel | `COUNT(rows WHERE sa_status = 'D' / 'TD' / 'H' / 'C')` |
| By Type / Status / Level (donut) | `COUNT(rows) GROUP BY sa_type / sa_status / sa_level` |
| Trend | `COUNT(rows) GROUP BY bulan(sa_date)` (atau minggu) |
| By User (tabel) | per `sa_user_id`: total, done, todo, hold, cancel, completionRate=`done/total×100` (top 10) |
| Funnel | nilai To Do / Done / Hold / Cancel (sama dengan count status) |

---

## 3. Leads & Opportunities — `/dashboard/leads-opps`
**Sumber:** `leads` + `opportunities`. **Tanggal:** lead = `lead_date`, opportunity = `created_at`.

| Metrik | Rumus |
|---|---|
| Total Leads | `COUNT(leads)` setelah filter |
| Total Opportunities | `COUNT(opportunities)` setelah filter |
| Total Opp Value | `SUM(opportunities.value)` |
| Conversion Rate | `DISTINCT_COUNT(opportunities.lead_id) / Total Leads × 100` |
| By Lead Status (donut) | `COUNT(leads) GROUP BY status` |
| By Opp Stage / Status (donut) | `COUNT(opportunities) GROUP BY stage / status` |
| Lead Trend (stacked) | `COUNT(leads) GROUP BY bulan(lead_date), status` |
| Opp Value Trend | `SUM(value) GROUP BY bulan(created_at)` |
| Top Opportunities | opportunities diurut `value` desc (top 10) |

---

## 4. Invoices & Receivables — `/dashboard/invoices`
**Sumber:** `invoices` + `payment_details` (join `pd_inv_id = inv_id`) + `orders` (status project). **Tanggal:** `inv_date`.
**Status invoice** (per baris): `pct = inv_payment_percentage`; `pct≥100`→Paid; selain itu jika `inv_est_payment_date < hari_ini`→Overdue; jika `pct>0`→Partial; sisanya Unpaid.

| Metrik | Rumus |
|---|---|
| Total Invoiced | `SUM(inv_amount)` |
| Total Paid | `SUM(payment_details.pd_total_amount)` (untuk invoice yang lolos filter) |
| Total Outstanding | `SUM( (1 − pct/100) × inv_amount )` |
| Overdue (amount) | `SUM(outstanding WHERE status='Overdue')`; Overdue count = `COUNT(status='Overdue')` |
| Collected % | `Total Invoiced / (Total Invoiced + Total Outstanding) × 100` |
| Status Breakdown (donut) | `COUNT(invoices) GROUP BY status` |
| Invoice vs Payment Trend | Invoice = `SUM(inv_amount) GROUP BY bulan(inv_date)`; Payment = `SUM(pd_total_amount) GROUP BY bulan(pd_date)` |
| Aging Receivables | `SUM(outstanding) GROUP BY bucket(hari telat)` bucket: Current/1-30/31-60/61-90/90+ (hari = hari_ini − inv_est_payment_date) |
| Lead Time | hari dari tanggal project selesai (status→C) ke `inv_date`; chart = distribusi, KPI = rata-rata |
| Outstanding by Due Date | `SUM(outstanding) GROUP BY bulan(inv_est_payment_date)` |
| Customer Summary | per `inv_company_id`: `SUM(inv_amount)`, `SUM(paid)`, `SUM(outstanding)`, `SUM(overdue)` |

---

## 5. Payments Collection — `/dashboard/payments`
**Sumber:** `payments` (+ `payment_details`/`invoices` untuk link no. invoice & project). **Tanggal:** `pay_date`.
**Nilai pembayaran** = `pay_total_amount` bila ada, jika tidak `pay_amount`.

| Metrik | Rumus |
|---|---|
| Total Collected | `SUM(nilai pembayaran)` setelah filter |
| Payments This Month | `SUM(nilai pembayaran WHERE bulan(pay_date)=bulan_ini)` |
| Payment Count | `COUNT(payments)` setelah filter |
| Avg Payment | `Total Collected / Payment Count` |
| Monthly Trend | `SUM(nilai pembayaran) GROUP BY bulan(pay_date)` |
| By Customer | `SUM(nilai pembayaran) GROUP BY pay_company_id` (top 15) |

---

## 6. Finance AP & Reimburse — `/dashboard/finance-ap`
**Sumber:** `payment_requests`, `payments`, `ReimburseCashIn`, `ReimburseCashOut` (+ `orders` untuk nama project).
**Tanggal:** request = `payreq_created_at`, reimburse = `reimburse_date`, payment = `p_created_at`.
**Status request:** `P`=Paid, `CC`=Cancelled, `C`=Created (pending). **Reimburse `A`** = Approved.
**Kategori reimburse** dari prefix `reimburse_type_id_fk`: `O`=Office, `S`=Operational Service, `M`=Materials & Tools, `R`=Repairs & Utilities.

| Metrik | Rumus |
|---|---|
| Total Outstanding AP | `SUM( max(0, payreq_amount − payreq_pay_amount) ) WHERE payreq_status ∉ {P, CC}` |
| Total Cash Outflow | `SUM(payments.p_amount) + SUM(ReimburseCashOut.reimburse_amount WHERE reimburse_status='A')` |
| Pending Approval | `COUNT(payment_requests WHERE payreq_status='C')` — **dari seluruh data, tidak ikut filter** |
| Petty Cash Balance | `SUM(ReimburseCashIn.amount WHERE 'A') − SUM(ReimburseCashOut.amount WHERE 'A')` — **seluruh data** |
| Total Reimburse In / Out | `SUM(ReimburseCashIn/Out.reimburse_amount WHERE status='A')` |
| Cash Outflow Trend | per bulan: Payments=`SUM(p_amount)`, Reimburse=`SUM(approved reimburse_amount)`, Total=keduanya |
| Aging Payables | `SUM(outstanding) GROUP BY bucket(hari telat)` atas request outstanding (hari = hari_ini − payreq_duedate) |
| Reimburse Category (donut) | `SUM(approved reimburse_amount) GROUP BY kategori(reimburse_type_id_fk)` |
| Project Expenses (top 10) | per project: `SUM(payreq_amount)` + `SUM(approved reimburse_amount)` |
| Top Employees (top 10) | per pembuat/user: `SUM(payreq_amount)` + `SUM(approved reimburse_amount)`, plus count |

---

## 7. Purchasing — Purchase Requests — `/dashboard/purchasing/requests`
**Sumber:** `purchase_requests` (+ `Items` nama barang, `orders` nama project, `sales_users` nama orang). **Tanggal:** `created_at`.
**Filter awal:** buang soft-deleted **dan** buang PR yang `pr_item_id` kosong/`"-"`. Purchased = `pr_status='P'`.

**Overdue status (dihitung, BUKAN dari `pr_overdue_status`):** tanggal beli PR diambil via
`POLists` (`pol_pr_id = pr_id`) → `POL_PO_Number_FK` → **`POs.PO_Date`** (ambil yang terbaru;
fallback `pr_completed_at`). Misal `D` = `pr_duedate`, `T` = hari ini:
Ada/tidaknya pembelian dilihat dari adanya baris POLists untuk PR (sebagian **atau** penuh):
- **Overdue** — ada pembelian DAN `max(PO_Date) > D` (telat beli).
- **On Time** — ada pembelian DAN `max(PO_Date) ≤ D` (tepat/sebelum due).
- **Overdue (ongoing)** — **belum ada pembelian** DAN `T > D`, sudah dipegang (status ≠ NS).
- **Unhandled Overdue** — **belum ada pembelian** DAN `T > D`, belum dipegang (`pr_status` = NS/kosong).
- **Due Today** — belum ada pembelian DAN `D = T`.
- **Active** — belum ada pembelian DAN `D > T` (belum lewat due).

| Metrik | Rumus |
|---|---|
| Total PR | `COUNT(rows)` setelah filter |
| Purchased | `COUNT(rows WHERE pr_status='P')` |
| Completion | `Purchased / Total PR × 100` |
| Open PRs | `COUNT(rows WHERE pr_status≠'P')` |
| Overdue | `COUNT(rows WHERE overdue status ∈ {Overdue, Overdue (ongoing), Unhandled Overdue})` (lihat definisi di atas) |
| Total Estimated | `SUM(pr_estimated_price)` |
| Total Purchased | `SUM(pr_purchased_price)` |
| Avg Saving | `(SUM(pr_estimated_price) − SUM(pr_purchased_price)) / SUM(pr_estimated_price) × 100` — hanya baris `pr_status='P'` & `pr_estimated_price>0` |
| Status / Overdue Breakdown (donut) | `COUNT(rows) GROUP BY pr_status / overdue status (terhitung)` |
| Handler Workload | `COUNT(rows) GROUP BY pr_handle_by` (top 12) |
| Estimated vs Purchased (bulanan) | per bulan(`created_at`): `SUM(pr_estimated_price)` vs `SUM(pr_purchased_price)` |
| PR Volume (bulanan) | `COUNT(rows) GROUP BY bulan(created_at)` |
| Top Projects | `SUM(pr_purchased_price) GROUP BY pr_project_id` (top 10) |

---

## 8. Purchasing — Purchase Orders & Spend — `/dashboard/purchasing/orders`
**Sumber:** `POs` (+ `POLists` untuk breakdown project/tipe item, `orders` nama project). Nama vendor = `PO_Company_Name`. **Tanggal:** `PO_Date`.
**Filter:** vendor (`PO_Company_ID_FK`), user/PIC (`PO_P_User_ID_FK`), project & item type (via baris `POLists`), payment type (`PO_PaymentTypes_ID_FK`), status (`PO_Status`).

| Metrik | Rumus |
|---|---|
| **Total Spend** | `SUM(POs.PO_Amount)` setelah filter |
| PO Count | `COUNT(POs)` setelah filter |
| Line Items | `COUNT(POLists)` untuk PO yang lolos filter (sub-baris di kartu PO Count) |
| Avg PO Value | `Total Spend / PO Count` |
| Vendors | `DISTINCT_COUNT(POs.PO_Company_ID_FK)` |
| Net Spend | `SUM(POs.PO_Net)` |
| Total PPN | `SUM(POs.po_ppn)` |
| Total PPH | `SUM(POs.po_pph)` (bisa negatif — pajak potong) |
| Approved / Waiting | `COUNT(PO_Status='A')` / `COUNT(PO_Status='W')` |
| Spend Trend (bulanan) | `SUM(PO_Amount) GROUP BY bulan(PO_Date)` |
| Top Vendors | `SUM(PO_Amount) GROUP BY PO_Company_Name` (top 10) |
| Top Projects | `SUM(POLists.POL_Total) GROUP BY POL_PRJ_ID_FK` — hanya baris dari PO yang lolos filter (top 10) |
| Spend by Item Type (donut) | `SUM(POLists.POL_Total) GROUP BY POL_ItemType_ID_FK` |
| Payment Type Mix (donut) | `SUM(PO_Amount) GROUP BY PO_PaymentTypes_ID_FK` |
| Spend by PO Status (donut) | `SUM(PO_Amount) GROUP BY PO_Status` |
| Net Spend by Purchaser (bar) | `SUM(PO_Net) GROUP BY PO_P_User_ID_FK` (top 12) |
| PO Count by Purchaser (bar) | `COUNT(POs) GROUP BY PO_P_User_ID_FK` (top 12) |
| PO Lines by Purchaser (bar) | `COUNT(POLists) GROUP BY purchaser PO-nya (PO_P_User_ID_FK)` (top 12) |
| Paid % (kolom tabel) | `clamp(PO_PaymentProgress, 0, 100)` |

> Kenapa beda sumber? Vendor/payment/status melekat di **PO** → pakai `PO_Amount`. Satu PO bisa
> mencakup banyak project/tipe item → alokasi project & tipe item pakai nilai **per baris** `POL_Total`.

---

## 9. Purchasing — Vendor Scorecard — `/dashboard/purchasing/vendors`
**Sumber:** `POs` dikelompokkan per vendor (+ `qr_lists` untuk penawaran). **Tanggal:** `PO_Date`. Filter: payment type, **Min Spend** (diterapkan setelah agregasi).

Agregasi per vendor (`GROUP BY PO_Company_ID_FK`):

| Metrik | Rumus |
|---|---|
| Active Vendors | `DISTINCT_COUNT(PO_Company_ID_FK)` yang punya ≥1 PO dalam rentang |
| Total Spend | `SUM(PO_Amount)` semua vendor |
| Top Vendor Share | `SUM(PO_Amount) vendor #1 / Total Spend × 100` |
| Avg / Vendor | `Total Spend / Active Vendors` |
| (tabel) PO count | `COUNT(POs)` per vendor |
| (tabel) Total Spend | `SUM(PO_Amount)` per vendor |
| (tabel) Avg PO | `SUM(PO_Amount) / COUNT(POs)` per vendor |
| (tabel) Share % | `SUM(PO_Amount) vendor / Total Spend × 100` |
| (tabel) Quotes | `COUNT(qr_lists WHERE qrl_vendor = vendor)` — **seluruh waktu, tidak ikut filter tanggal** |
| (tabel) Last PO | `MAX(PO_Date)` per vendor |
| Top Vendors (bar) | vendor diurut Total Spend desc (top 12) |
| Pareto | top 15 vendor; garis kumulatif `cumulative% = (Σ spend s/d vendor ke-i) / Total Spend × 100` |

---

## Catatan & caveat penting

- **Tidak ada "Outstanding" di halaman Orders**: `PO_PaymentProgress`/`PO_AmountPayment` banyak kosong di
  PO lama → akan menyesatkan. Diganti **Net Spend** (`SUM(PO_Net)`).
- **Join PR↔PO** hanya andal lewat `project_id` (100% terisi); `pol_pr_id` (~13,5%) & `qrl_pr_id` (~4,5%) terlalu jarang.
- **`PO_ReceivedDate` kosong ~100%** → belum ada metrik lead-time/on-time delivery.
- **Pending Approval & Petty Cash Balance (Finance AP)** dihitung dari **seluruh data**, bukan data terfilter.
- **`PO_PPH` bisa negatif** (pajak potong) — memang nilai di sheet.
- **`Quotes` (Vendor Scorecard)** dihitung seluruh waktu karena `qr_lists` tak punya tanggal konsisten untuk discoping.
- Baris **soft-deleted** (`deleted_at` terisi) selalu dibuang; **`POs` tidak punya** kolom itu.
- Di chart, project ditampilkan **id** saja (nama saat hover); di tabel & filter ditampilkan **`id - name`** (bisa dicari keduanya).
