# Cost Control Dashboard & Dashboard Suggestions

Fitur baru ini akan membandingkan **Budget (PO Pelanggan)** dengan **Actual Cost (Pengeluaran Asli)** yang terbagi menjadi kategori Material dan Service untuk setiap Project. Selain itu, aksesnya akan dilindungi secara ketat hanya untuk role `cost control`.

## User Review Required

> [!IMPORTANT]
> Fitur ini memerlukan integrasi data dari banyak Spreadsheet sekaligus (Orders, Procurement, Finance AP, Payroll, dan Reports). Saya sudah merancang struktur dasarnya, namun butuh jawaban Anda di bagian **Open Questions** di bawah agar perhitungannya akurat.

## Open Questions

> [!WARNING]
> Mohon jawab pertanyaan berikut sebelum saya mulai membuat kodenya:
> 1. **"Table Overtime":** Anda menyebut "ambil overtimenya dari table overtime". Saat ini kode belum mendeteksi adanya Sheet bernama Overtime. Apakah Anda punya Spreadsheet/Sheet baru untuk ini? Mohon berikan link atau konfirmasi posisinya.
> 2. **Reimburse Material vs Service:** Bagaimana cara persisnya mengetahui sebuah Reimburse itu Material atau Service? Apakah ada patokan teks tertentu atau ID (misalnya tipe tertentu)?
> 3. **Purchasing PO Material vs Service:** Sama halnya dengan Purchasing, apakah kita melihat dari Item Type di daftar barang (PO Lines) atau ada tanda di PO Induk-nya?
> 4. **Konversi Harga Overtime & Meal:** Untuk Overtime dan Meal Request, apakah kita hanya menampilkan *angka/jumlah jam* saja sebagai perbandingan metrik, atau ada *nilai Rupiah-nya* yang harus ditambahkan sebagai total pengeluaran Service?

## Proposed Changes

### 1. Hak Akses (Role) & Navigasi
- **[MODIFY] `lib/nav.ts`**: Menambahkan role baru `cost control` dan mendaftarkan menu Cost Control di *sidebar*.
- **[MODIFY] `app/api/auth/validate/route.ts`**: Menambahkan role `cost control` ke dalam logika validasi *login*.

### 2. Backend (API Aggregator)
- **[NEW] `app/api/cost-control/route.ts`**: API baru yang akan:
  - Mengambil data Project dari `getAllOrders()` untuk mendapatkan Budget Material & Service.
  - Membaca Purchasing PO untuk mendapatkan total belanja PO Material & Service per proyek.
  - Membaca Reimburse (Cash Out) untuk memisahkan pengeluaran kas Material & Service per proyek.
  - Membaca Meal Request (Payroll) per proyek.
  - Membaca Worker Reports (jam dan jumlah report) serta data dari Table Overtime.
  - Menghasilkan rekap agregasi final per *Project ID*.

### 3. Frontend (Dashboard)
- **[NEW] `app/dashboard/cost-control/page.tsx`**: 
  - Akan menampilkan tabel utama berisi: **Project Name**, **Budget Material vs Pengeluaran Material**, dan **Budget Service vs Pengeluaran Service**.
  - Kolom khusus untuk memantau metrik operasional: **Total Report**, **Total Jam**, dan **Total Overtime**.
  - Komponen grafik dan *Progress Bar* (misalnya berwarna merah jika pengeluaran melebihi nilai PO Pelanggan).

---

## 💡 Ide & Saran untuk Dashboard Lainnya

Menjawab pertanyaan Anda tentang *"apalagi yang bisa diisi di dashboard project, delivery, dan worker"*, berikut adalah hal-hal keren yang bisa kita kembangkan nanti:

### 1. Dashboard Project
- **Gantt Chart Timeline:** Visualisasi jadwal proyek (Plan vs Actual Start/End Date).
- **Profitability Indicator:** Menampilkan margin keuntungan estimasi vs aktual dari tiap proyek.
- **Alert System:** Daftar proyek yang *Overdue* (telat dari jadwal) atau macet di status tertentu (seperti BAST belum turun).

### 2. Dashboard Delivery
- **Logistics Live Tracking:** Metrik rata-rata hari dari pengiriman PO sampai barang diterima (Delivery Lead Time).
- **Vendor Performance:** Menampilkan vendor mana yang paling sering telat mengirim barang ke lokasi proyek.
- **Geographic Map:** Menampilkan sebaran lokasi instalasi/delivery jika ada data kotanya.

### 3. Worker Reports
- **Leaderboard Teknisi:** Menampilkan daftar teknisi dengan laporan paling rajin atau dengan jam kerja tertinggi.
- **Overtime Ratio:** Grafik yang menunjukkan rasio jam normal vs overtime per minggu (untuk mencegah kelelahan pekerja).
- **Issue Tracker:** Pengecekan kata kunci di kolom *Remarks* (misal: "hujan", "rusak", "komplain") untuk mendeteksi kendala lapangan yang paling sering terjadi.

## Verification Plan

### Manual Verification
- Anda akan login dengan user yang memiliki centang `TRUE` di kolom `cost control` pada sheet Roles.
- Anda akan mengecek tabel agregasi, lalu membandingkannya dengan data mentah di spreadsheet Purchasing, Reimburse, dan Reports untuk memastikan kalkulasinya valid.
