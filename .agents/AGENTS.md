# Project Rules for Sales Dashboard

## Worker Reports Sanitization
- **Rule**: Selalu batasi jumlah jam kerja (`reportTime` atau sejenisnya) maksimal 16 jam per laporan/hari. 
- **Handling**: Jika data jam kerja > 16 jam, asumsikan salah input dan ubah/default ke 8 jam menggunakan utilitas pembatas (e.g., `clampHours`).

## KPI & Chart Consistency
- **Rule**: Angka KPI (seperti jumlah/persentase proyek overdue) harus selalu disinkronisasikan dan dihitung dengan kriteria filter yang sama seperti grafik visual terkait (misalnya chart Time Status).
- **Handling**: Jangan menghitung proyek yang tidak memiliki data order lengkap, planned end date, atau proyek berstatus Cancelled (`CC`) di dalam KPI overdue jika grafik visual terkait juga mengecualikan proyek tersebut.

## Invoice Amount Source (Finance / Invoices & Receivables)
- **Rule**: Pada halaman finance (invoice & receivables), semua amount invoice harus bersumber dari `inv_total` (kolom 11, field `invTotal`), BUKAN dari `inv_amount` (kolom 16, field `invAmount`).
- **Handling**: Di API route `/api/invoices` dan semua kalkulasi terkait (KPI, trend, aging, outstanding, customer summary), gunakan `inv.invTotal` sebagai `amount`. Field `invAmount` hanya digunakan jika secara eksplisit diminta untuk menampilkan nilai setelah diskon/pajak.

## Invoice vs Payment Trend (By Invoice Date)
- **Rule**: Chart "Invoice vs Payment Trend (By Invoice Date)" harus disandingkan (side-by-side) antara total invoice (`inv_total`) dan nilai cash payment aktual (`payment_details`), disertai informasi persentase collection rate di dalam tooltip.
- **Handling**: Di API route, nilai Payment pada chart ini diambil dari tabel `payment_details` (`r.paid`), dan tambahkan kalkulasi persentase `PaymentPct` sebagai **rata-rata dari `inv_payment_percentage`** (`PctSum / Count`).
