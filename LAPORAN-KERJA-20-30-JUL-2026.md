# Laporan Kerja — Senin 20 Juli s/d Kamis 30 Juli 2026

**Nama:** Irfan Zuhdi Abdillah
**Periode:** 20 Jul 2026 (Senin) – 30 Jul 2026 (Kamis) · 9 hari kerja aktif
**Total output:** 172 commit di 6 repository, 2 akun GitHub
**Estimasi waktu kerja:** ± 38 jam

---

## 1. Sumber Data

| Sumber | Cakupan |
|---|---|
| Git log 6 repo lokal | 172 commit (deduplikasi lintas author alias) |
| GitHub `irfanzuhdia` | push ke `payroll`, `daily-report`, `erp-mdm`, `mdm-payslip`, `compro` |
| GitHub `gadmin-arch` | push ke `sales-dashboard` |
| Claude Code (mdm.ai.indonesia@gmail.com) | 10,65 jam sesi aktif (7.700+ event) |
| Antigravity IDE + Antigravity agent manager | 6 sesi agent, log IDE 20 Jul – 30 Jul |
| Riwayat edit file Antigravity IDE | konfigurasi `.env` payroll & daily-report |

> Catatan metode: kolom "estimasi jam" dihitung dari clustering commit (jeda ≤ 90 menit = satu sesi kerja, ditambah 30 menit persiapan sebelum commit pertama), lalu divalidasi silang dengan durasi sesi Claude Code dan rentang sesi agent Antigravity. Ini estimasi waktu kerja efektif, bukan absensi.

---

## 2. Ringkasan per Proyek

| Proyek | Repo | Commit | Fokus utama |
|---|---|---:|---|
| **Payroll MDM** | `irfanzuhdia/payroll` | 111 | Aturan perhitungan gaji, sinkronisasi Google Sheets, pengiriman slip via email |
| **Daily Report** | `irfanzuhdia/daily-report` | 36 | PWA + Web Push, ticketing realtime, mobile-first UI |
| **Sales Dashboard** | `gadmin-arch/sales-dashboard` | 10 | Export CSV & cetak laporan resmi (PDF) |
| **ERP MDM** | `irfanzuhdia/erp-mdm` | 5 | Modul Purchasing & HR, mirror sheet, arsitektur enterprise |
| **MDM Compro** | `irfanzuhdia/compro` | 5 | Keamanan backend, dark mode admin, logging & audit |
| **MDM Payslip Portal** | `irfanzuhdia/mdm-payslip` | 5 | **Proyek baru** — portal slip gaji untuk karyawan |

---

## 3. Rincian Harian

### Senin, 20 Juli — ± 5,8 jam (35 commit)
*Payroll MDM (30) · MDM Compro (5) · aktif 05:16 – 14:18*

**Payroll MDM — restrukturisasi halaman Settings**
- Merombak Employee Settings & Types dari sistem tab menjadi sub-halaman
- Menggabungkan Periods dan Tax Statuses ke dalam General Settings
- Mengubah General Settings menjadi "mega employee profile hub"
- Mengganti editor kategori dari form inline menjadi modal, menghapus kolom aksi
- Perbaikan tampilan: form input & modal premium, lebar kolom User ID, rounded corner tabel
- Performa frontend: Vercel RUM, bundle analyzer, logo teroptimasi, Turbopack analyzer
- Aksesibilitas: skip link, scope header tabel, label untuk kontrol ikon
- Mengganti Vercel cron dengan sinkronisasi berbasis staleness saat sign-in
- Perbaikan geocoding perbatasan Pasuruan & ambang batas uang makan lembur

**MDM Compro — pengamanan backend**
- Menerapkan role user read-only dan menutup celah keamanan backend
- Dark mode admin, error/loading state per route, shared container
- Request logging, audit diff, index pencarian trigram, tes, dan CI
- Perbaikan dialog delete/archive yang gagal submit tanpa notifikasi

---

### Selasa, 21 Juli — ± 2,6 jam + sesi arsitektur ERP (5 commit)
*Payroll MDM (4) · Sales Dashboard (1) · sesi Antigravity "Building Enterprise ERP Architecture" 09:08–14:46*

- Menyusun dokumen rencana optimasi lintas UI/UX, frontend, dan backend
- Perbaikan bug offset timezone + penambahan manajemen user untuk akses admin
- Perbaikan nama tab sheet Users di SyncService dan nama kolom lookup profil di NextAuth
- Sales Dashboard: penanganan error koneksi database, perbaikan fallback autentikasi
- Sesi desain arsitektur ERP enterprise (erp-mdm) di Antigravity IDE

---

### Rabu, 22 Juli — ± 4,1 jam (11 commit)
*Payroll MDM (10) · Daily Report (1) · aktif 09:18 – 18:05*

- Membatasi akses login secara ketat hanya ke tabel `payroll_user`
- Tombol hapus di daftar payroll + penyaringan payroll yang sudah soft-delete
- Tombol hapus untuk log rilis Finance
- Seleksi rentang baris dengan Shift+Click di tabel payroll
- Mencegah baris sintetis duplikat & menyelaraskan total di SlipService
- Membatasi tunjangan perjalanan sintetis pada sisa saldo receipt
- Auto-generate tunjangan perjalanan + perbaikan kategorisasi THP pinjaman/cicilan
- Merge batch dengan rentang tanggal duplikat + auto-grouping payroll yatim
- Pembaruan dokumentasi user guide & PRD

---

### Kamis, 23 Juli — ± 4,6 jam (25 commit)
*Daily Report (15) · Payroll MDM (9) · ERP MDM (1) · aktif 09:35 – 23:10*

**Daily Report — PWA & notifikasi**
- Dukungan PWA + Web Push lintas perangkat, termasuk panduan khusus iOS
- Mengambil VAPID public key secara dinamis dari endpoint API
- Persistensi push subscription ke PostgreSQL untuk deployment Vercel
- Menargetkan notifikasi ke `user_id` penerima, bukan broadcast ke semua perangkat
- Notifikasi Web Push otomatis setiap kali notifikasi inbox dibuat
- Realtime chat & inbox ticketing (Supabase Realtime WebSocket + auto-polling)
- Branding logo resmi PT MDM di ikon, PWA manifest, sidebar, dan login
- Perbaikan error foreign key saat menghapus project + `ON DELETE CASCADE`

**Payroll MDM — slip gaji**
- Breakdown total uang makan per kategori di aktivitas periode dan slip
- Mengganti estimasi gaji pokok dengan breakdown Gaji Pokok dan Lembur
- Remarks sebagai sub-baris terpisah di tabel HTML slip
- Antrean pending payroll adjustment, badge selisih visual, auto-calculate saat ganti okupasi, pembuatan kategori on-the-fly

---

### Jumat, 24 Juli — ± 7,2 jam (40 commit) — **hari tersibuk**
*Daily Report (17) · Payroll MDM (19) · ERP MDM (4) · aktif 09:35 – 17:25, sesi agent lanjut 17:51–22:53*

**Daily Report — stabilisasi & mobile**
- Perbaikan kegagalan pembuatan Project/Task/Report (validasi Zod, duplikasi sequence ID, atribusi user sesi, feedback error di UI)
- Fitur export CSV dengan breakdown reporter untuk Projects, Tasks, Daily Reports, Ticketing
- Perpanjangan sesi login jadi 30 hari dengan sliding renewal ala Instagram
- Bottom navigation bar mobile + perbaikan clipping layout list view
- Optimasi UI/UX mobile-first untuk filter dan papan Kanban
- Perbaikan tab spinner menggantung & freeze saat idle
- Perbaikan pelanggaran constraint NOT NULL di `project_logs` dan `task_logs`

**Payroll MDM — pajak, audit, dan migrasi data**
- Migrasi data `travel_allowances` dari Google Sheets ke PostgreSQL
- Mode seleksi baris + bulk delete + modal history dengan fungsi restore
- Perhitungan persentase Tarif TER PPh21 yang akurat di semua status payroll
- Pengurangan PPh21 pada kartu ringkasan THP dan kalkulasi selisih
- Format timestamp Asia/Jakarta (WIB) di history, log, dan metadata
- Tampilan created by / updated by di modal edit dan baris tabel detail

**ERP MDM**
- Modul Purchasing + HR, mirror sheet, dan perbaikan sesi autentikasi
- Infinite scroll untuk tabel Projects, Customers, Products, Purchasing, HR
- Dashboard dibuat layak pakai di perangkat mobile

---

### Sabtu–Minggu, 25–26 Juli — libur
Tidak ada aktivitas commit maupun sesi.

---

### Senin, 27 Juli — ± 7,8 jam (28 commit)
*Payroll MDM (25) · Sales Dashboard (3) · aktif 08:38 – 17:49*

**Payroll MDM — aturan perhitungan & timezone**
- Aturan tunjangan perjalanan bertingkat: hari 1–7 = 100%, hari 8–21 = 50%, hari 22+ = 25%
- Pemetaan typeId reimbursement (P-3 / P-9) dan PPh21 virtual ke P-8 agar THP benar
- Potongan Absensi (Sistem) dipetakan ke P-2 (Pengurangan)
- Dukungan catatan multiline untuk Travel Allowance di modal, tabel, dan slip
- Perbaikan nominal approved meal request dan sinkronisasi total summary bar
- Rangkaian perbaikan timezone: parsing timestamp WIB (+07:00) dari Google Sheets, sanitasi koma liar, `parseDateOnly` untuk kolom date-only
- Membatasi penghapusan "Calculate Auto" hanya pada baris sistem (C-115..C-120, C-123) agar baris "Adjust to Next Period" aman
- Editing nama okupasi di modal master

**Sales Dashboard**
- Export CSV + layout cetak laporan resmi yang ringkas di halaman project management
- Tombol export CSV dan print di halaman Worker Reports

---

### Selasa, 28 Juli — ± 1,8 jam (10 commit)
*Sales Dashboard (6) · Payroll MDM (4) · aktif 08:18 – 10:10*

**Sales Dashboard — perbaikan render chart di PDF**
Rangkaian iterasi sampai chart ter-render 100% saat print:
- Memaksa `print-color-adjust: exact` + dimensi SVG eksplisit untuk recharts
- Override variabel CSS dark theme & aspect ratio auto saat print
- Bypass kalkulasi ukuran nol `ResponsiveContainer` lewat hook `beforeprint`
- Mengganti variabel print OKLCH dengan HEX standar (kompatibilitas parser SVG Chrome)
- Render node SVG statis langsung untuk mode print

**Payroll MDM**
- Rate lembur 1x flat untuk semua hari; bonus 2x daily earning untuk kerja hari libur/Minggu (gaji tetap)
- Perbaikan parsing tanggal TypeScript di `sync-service.ts` untuk memulihkan deployment produksi Vercel

---

### Rabu, 29 Juli — ± 3,5 jam (15 commit)
*Payroll MDM (10) · MDM Payslip Portal (5, repo baru) · aktif 08:52 – 17:02*

**Payroll MDM — pengiriman email massal**
- Optimasi bulk email: 5 worker paralel + batasan `maxDuration` 60 detik Vercel
- SMTP connection pooling & rate-pacing untuk mencegah koneksi Gmail terputus
- Dukungan port SMTP kustom dan flag secure untuk SMTP domain hosting
- Dukungan sertifikat SSL bersama pada SMTP web hosting
- Plain-text fallback otomatis + header mailer agar lolos filter spam outbound
- Link Google Maps memakai koordinat GPS + horizontal touch-scroll untuk tabel slip email
- Pengali gaji hari libur (`salary_holiday_multiplier`) yang dapat dikonfigurasi, default 2x
- Cascade delete baris adjustment lintas periode pada kedua payroll yang terhubung

**MDM Payslip Portal — proyek baru**
- Inisiasi portal slip gaji karyawan MDM
- Perbaikan parsing RSA private key di Vercel (escaping newline, `crypto.createPrivateKey`)
- Streaming file Drive dengan response Buffer

---

### Kamis, 30 Juli (hari ini) — ± 0,6 jam (3 commit)
*Daily Report · aktif 10:26 – 10:33*

- Perbaikan kegagalan simpan tiket (perbandingan `due_date` kosong, payload `team_user_ids` kosong, validasi URL)
- Perbaikan PostgreSQL 500 Internal Server Error (escape string regex di query + nilai undefined saat insert tiket)
- Audit keamanan menyeluruh lintas repository: proteksi query insert terhadap nilai undefined

---

## 4. Rekapitulasi Waktu

| Hari | Tanggal | Commit | Estimasi jam |
|---|---|---:|---:|
| Senin | 20 Jul | 35 | 5,8 |
| Selasa | 21 Jul | 5 | 2,6 |
| Rabu | 22 Jul | 11 | 4,1 |
| Kamis | 23 Jul | 25 | 4,6 |
| Jumat | 24 Jul | 40 | 7,2 |
| Sabtu–Minggu | 25–26 Jul | 0 | — |
| Senin | 27 Jul | 28 | 7,8 |
| Selasa | 28 Jul | 10 | 1,8 |
| Rabu | 29 Jul | 15 | 3,5 |
| Kamis | 30 Jul | 3 | 0,6 |
| **Total** | | **172** | **± 38,1** |

Rata-rata ± 4,2 jam kerja efektif per hari aktif.

## 5. Distribusi Waktu per Proyek

| Proyek | Estimasi jam | Porsi |
|---|---:|---:|
| Payroll MDM | 25,2 | 66% |
| Daily Report | 5,8 | 15% |
| Sales Dashboard | 2,6 | 7% |
| ERP MDM | 2,3 | 6% |
| MDM Payslip Portal | 1,1 | 3% |
| MDM Compro | 1,0 | 3% |

---

## 6. Catatan

- **Hari paling padat:** Jumat 24 Juli (40 commit lintas 3 proyek) dan Senin 27 Juli (28 commit, sesi terpanjang 08:38–17:49).
- **Tema besar periode ini:** akurasi perhitungan payroll (pajak TER, tunjangan perjalanan bertingkat, pengali hari libur), penanganan timezone WIB pada sinkronisasi Google Sheets, dan pengiriman slip gaji lewat email massal.
- **Proyek baru:** MDM Payslip Portal (`irfanzuhdia/mdm-payslip`) dimulai 29 Juli.
- **Estimasi jam bersifat konservatif.** Waktu yang tidak menghasilkan commit — riset, debugging, review, dan diskusi dengan agent — sebagian tidak tercakup. Sebagai pembanding: sesi Claude Code saja tercatat 10,65 jam aktif, dan sesi agent Antigravity punya rentang sampai 12 jam (termasuk waktu idle).
