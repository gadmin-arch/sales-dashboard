# Handover: Optimasi Egress Neon & Lazy Loading

> Dokumen serah-terima pekerjaan optimasi transfer data (egress) Neon dan lazy loading.
> Update terakhir: 2026-07-15 (malam — semua route berat sudah row-sliced + column pruning
> terpasang; sisa pekerjaan tinggal CRON_SECRET di Vercel & item opsional). Untuk
> melanjutkan pekerjaan ini dengan AI agent, pakai prompt di bagian paling bawah.

## 1. Konteks & Masalah

- Database: **Neon Postgres free tier** (ap-southeast-1) — limit **5GB data transfer (egress) / bulan**. Egress = byte yang DIBACA dari Neon; write (sync) gratis.
- Alur data: Google Sheets → sync harian (`lib/sync-engine.ts`, cron Vercel 23:00 UTC = 06:00 WIB) → tabel `sheet_*` di Neon → API route compute (baca full table) → di-cache oleh `lib/route-cache.ts` (Next `unstable_cache`, key = params + versi sync) → UI.
- **Akar masalah**: Vercel data cache punya limit **~2MB per entry** — response yang lebih besar diam-diam TIDAK di-cache, sehingga setiap kunjungan halaman mengulang compute = baca full table dari Neon (15–35MB per compute). finance-ap YTD = 3.9MB, cost-control = 2.0MB → dua halaman ini adalah sumber egress terbesar.
- Semua interaksi tabel dulunya client-side di atas full rows (sort/search/load-more) — nol egress tambahan, tapi payload-nya yang bikin tidak ter-cache.

## 2. Yang Sudah Selesai (dengan commit)

| Commit | Isi |
|---|---|
| `8bd1448` | Rewrite user manual in-app (per-page guides) |
| `c0393dd` | Hapus Workforce Pricing Calculator (hidden) dari manual Projects |
| `e0ea6b0` | Diagnostik auth cron di `/api/sync` + perbaiki blind spot log egress di `database/db.ts` |
| `139ce7f` | **Inti optimasi**: `cachedRouteView` + finance-ap per-tab + cost-control `?detail=` + purchasing/orders row-slice + `useServerRows` + `lib/sort-utils.ts` |
| `4328854` | Sync pakai `values.batchGet` per spreadsheet (74→~24 request); fallback Google menulis balik ke Neon; `vercel.json` pin region `sin1` |
| `988abe8` | `/api/projects` + page: item arrays per proyek pindah ke `?detail=<prjId>` |
| `e26a17a` | Row-slice `/api/purchasing/requests` via `view=rows` (1.88MB → 59KB); page pakai `useServerRows` |
| `0f860dc` | Row-slice tab poPayments & reimburse finance-ap (1.78MB → 20KB / 18KB); agregasi poPayments pindah ke server, filter dropdown per-tab jadi param server, history petty-cash per user via `balanceUser=`; komponen `ServerDataTable`; bump cache `finance-ap-tab-v2` |
| `8a2bed0` | Column pruning `fetchAllRows(…, columns)`: POs −76% · POLists −50% · Items −28% byte per compute-miss; fix blind spot regex log `[db]` untuk SELECT berkolom |
| `755b923` | Fix bug data payroll: sheet dapat kolom `occupation_id` di indeks 1 → semua indeks bergeser; filter deleted_at membuang semua payslip (KPI 0). Sekarang 1.679 payslip / Rp3.75B tampil |
| `725d03a` | Column pruning round 2 — 8 tabel lagi, total −41% (~3.9MB/sapuan compute): reimbursecashout −48% (drop Reimburse_Image) · payments −67% (drop p_evidence) · invoices −49% · overtimes −57% · orders −24% · quotations −31% · payment_requests −27% · purchase_requests −21%. Field mati dihapus dari interface (dijaga tsc) |
| `0808ba3` | Tab payroll 2.77MB → **337KB**: array detail slip (8 array bersarang + meta) di-strip dari list, drawer fetch `slipUser=<userId>` (~14KB) on-demand; merge tahunan pindah ke handler drawer. Bump cache `finance-ap-tab-v3` |
| `08e6d49` | Fallback Google Sheets di `fetchAllRows` dikoalesensi: burst miss untuk satu spreadsheet (jendela 25ms) → SATU `values.batchGet`, bukan satu `values.get` per sheet. Kuota baca Sheets (60 req/menit/user) = sumber daya langkanya, bukan byte |

Ukuran response YTD sesudah optimasi (semua ter-cache, sebelumnya finance-ap & cost-control TIDAK PERNAH ter-cache):

- finance-ap: per tab — overview 1.6KB · poPayments 1.76MB→**20KB** · reimburse 1.74MB→**18KB** · meal 409KB · loans 42KB · payroll 2.77MB→**337KB** (payroll baru terisi setelah fix 755b923 dan langsung menembus limit)
- cost-control: 2.0MB → **398KB** (detail per proyek on-demand)
- projects: → **304KB** (detail per proyek on-demand)
- purchasing/orders: 1.3MB → **297KB** (25 baris pertama; sisanya via `view=rows`)
- purchasing/requests: 1.88MB → **59KB** (25 baris pertama; sisanya via `view=rows`)

## 3. Arsitektur Pola (WAJIB dipahami sebelum lanjut)

### `cachedRouteView` (lib/route-cache.ts)
Satu compute mahal → banyak proyeksi kecil yang di-cache terpisah (per tab / per detail / per sort).
```ts
const getView = cachedRouteView('nama-route-vN', compute,
  { view: ['view', 'sortKey', 'sortDir'],   // ikut jadi kunci cache entry
    drop: ['offset', 'limit', 'q'] },       // TIDAK jadi kunci — diterapkan di handler SETELAH ambil cache
  (full, view) => { /* potong full jadi response kecil */ })
```
- Ada **memo in-process 5 menit (3 entri)**: beberapa proyeksi yang miss berurutan pada instance yang sama berbagi SATU eksekusi compute — tidak ada baca ulang Neon.
- `rowsCache` di `database/client.ts` (TTL 5 menit) juga men-dedupe baca sheet di level bawah.

### Pola per jenis halaman
1. **Tabbed page** (finance-ap): `?tab=<key>` → response cuma slice tab itu. Page fetch per tab saat dibuka, ganti filter menghapus cache tab lain. UI dalam tab tak berubah (tetap client-side).
2. **List + modal detail** (cost-control, projects): list TANPA array item per baris (agregat/count tetap); modal fetch `?detail=<prjId>`. Merge di `selectedCalculatedProject` supaya JSX modal tak berubah.
3. **Tabel besar server-backed** (purchasing/orders): response utama bawa 25 baris pertama + `totalRows`; sort/search/load-more panggil `view=rows&sortKey&sortDir&offset&limit&q`. Client pakai hook **`hooks/use-server-rows.ts`** (pengganti drop-in useSort+useLoadMore+search). Komparator server = `lib/sort-utils.ts` (identik dengan client lama).

### Pola tambahan (commit `0f860dc` & `8a2bed0`)
4. **Tab berat dengan filter dropdown yang mempengaruhi KPI** (finance-ap poPayments): agregasi client-side (useMemo atas full rows) dipindah ke fungsi proyeksi server (`projectPoPaymentsTab` di `lib/finance-ap-helpers.ts`); filter dropdown jadi view param (`fStatus/fTimeliness/fRequester/fTempo`, comma-joined oleh `buildQuery`). Tab component refetch view agregat saat filter berubah; `ServerDataTable` (di `shared.tsx`) = kembaran DataTable berbasis `useServerRows`. Search HANYA memfilter tabel (dulu ikut mempengaruhi KPI — perubahan perilaku yang disengaja; q per keystroke tidak boleh jadi kunci cache).
5. **Payload didominasi detail bersarang** (reimburse `userBalances[].history`, 690KB): kirim list tanpa nested array, detail via param view (`balanceUser=<nama>`) saat drawer dibuka.
6. **Column pruning**: `fetchAllRows(ssId, sheet, columns?)` — daftar indeks kolom 0-based; jalur Neon SELECT hanya kolom itu dan mengembalikan baris SPARSE dengan nilai di indeks ASLI, jadi mapper posisional tak berubah. Semua indeks yang dibaca caller (termasuk filter soft-delete!) wajib masuk daftar. Terpasang di 11 tabel (procurement `PO_COLS`/`POL_COLS`/`ITEM_COLS`; round 2 di finance-ap/orders/quotations/invoicing/purchasing/overtimes). Ronde 2 juga MENGHAPUS field mapped-tapi-mati dari interface (payreqFile, pEvidence, reimburseImage, qFile, prjPoFile, prRemarks, dst.) supaya tsc menjaga regresi. `reports` TIDAK dipruning — mapper-nya memakai semua 11 kolom (tidak ada yang bisa dihemat).
7. **Payload didominasi detail bersarang per baris** (payroll rows × 8 array detail): strip array dari list view di proyeksi, drawer fetch `slipUser=<userId>` on-demand; agregasi lintas-baris untuk mode grouping (Tahunan) pindah ke handler drawer di client. KPI & filter dropdown tab payroll tetap client-side (baris ringan cukup).
8. **Dua sumber daya langka yang BERBEDA**: Neon = **byte egress** (5GB/bulan) → optimasi = column pruning + proyeksi kecil + cache; Google Sheets = **jumlah request** (60 baca/menit/user) → optimasi = batchGet (sync per spreadsheet, dan fallback `fetchSheetCoalesced` di client.ts: burst miss satu spreadsheet dalam jendela 25ms → 1 request). Jangan tertukar — memangkas kolom TIDAK menghemat kuota Google, dan mengurangi request TIDAK menghemat egress Neon.

### Gotchas (pelajaran mahal — jangan diulang)
- **Bump nama cache** (`'x' → 'x-v2'`) setiap kali BENTUK response berubah — entry cache hidup melewati deploy; tanpa bump, client baru menerima JSON bentuk lama.
- **`initialRows` ke `useServerRows` harus referensi STABIL** — `data?.rows ?? []` inline bikin array baru tiap render → infinite loop "Maximum update depth exceeded". Pakai module const `EMPTY_ROWS`.
- `offset/limit/q` HARUS di `drop`, bukan `view` — kalau tidak, satu entry cache per klik/ketikan.
- Log egress: `database/db.ts` mencetak `[db] sheet read <tabel> rows=N ~KB` untuk SELECT ke `sheet_*` — cache hit = tidak ada baris log ini. Regex-nya sudah mencakup SELECT berkolom (pruned); kalau menambah bentuk query sheet baru, cek log ini tidak buta lagi.
- **Sheet bisa dapat kolom baru di tengah** → semua indeks mapper bergeser (kasus payroll: `occupation_id` disisipkan di indeks 1, filter deleted_at membaca created_at → SEMUA baris terbuang, KPI 0 tanpa error). Kalau sebuah dashboard tiba-tiba kosong/nol semua, bandingkan `headers` di `sheet_metadata` dengan komentar indeks di mapper.
- Verifikasi page role-gated tanpa login: mount temp route di luar `/dashboard` (mis. `app/temp-verify/x/page.tsx` berisi `export { default } from '../../dashboard/xxx/page'`), hapus sebelum commit. Chart recharts tidak mount di browser pane — verifikasi angka via API/text, bukan pixel chart.
- Paksa compute-miss saat verifikasi (route cache menempel di params+versi sync): tambah param dummy `&zz=1` → kunci cache beda, dataset sama. `fresh=1` hanya membersihkan rowsCache, TIDAK menembus route cache.
- Dev server lama bocor worker `postcss.js` → RAM penuh; sweep: `pkill -f "postcss.js"`. Kalau port 3000 terpakai sesi lain, Next menolak dev server kedua dari direktori yang sama — pakai server yang ada (HMR ikut memuat perubahanmu) atau matikan dulu.

## 4. Pekerjaan Tersisa (urut prioritas)

> Status 2026-07-16 (dini hari): semua pekerjaan sisi-repo SELESAI — row-slice semua route/tab berat, column pruning 2 ronde (11 tabel), bug payroll fixed, tab payroll detail-on-demand (commit `e26a17a` `0f860dc` `8a2bed0` `755b923` `725d03a` `0808ba3`). Sisa di bawah.

1. **Cron sync**: halaman Cron Jobs di Vercel sudah benar (job `/api/sync` @ `0 23 * * *`, Enabled) — yang kurang BUKAN di halaman itu, tapi env var. Langkah: (a) Vercel → Settings → **Environment Variables** → tambah `CRON_SECRET` (Production, nilai acak panjang); (b) **redeploy** (env baru tidak berlaku ke deployment lama); (c) di halaman Cron Jobs klik **Run** lalu **View Logs**: `[sync] Sync start {via:'vercel-cron'}` = beres; `[sync] Unauthorized… cronSecretConfigured:false` = env belum kebaca. Catatan Hobby plan: jendela fleksibel 1 jam (sync jalan antara 06:00–07:00 WIB). Kalau timeout 60s, naikkan `maxDuration` (butuh Fluid Compute) atau pecah sync.
2. **Route ringan sisanya** ("global bertahap", opsional): invoices, delivery (760KB), reports (1.1MB — mendekati limit seiring data tumbuh, pantau), sales, dll — konversi ke `useServerRows` hanya kalau mau konsistensi UX; egress mereka sudah aman karena ter-cache.
3. (Opsional) Column pruning sisa: tabel yang belum dipruning tinggal yang kecil/terpakai-penuh (`reports` 11/11 kolom terpakai — tidak bisa; meal_benefit*, sheet referensi — tidak signifikan).
4. (Opsional) Cache warming pasca-sync — bukan penghemat egress (hanya UX first-load); tunda.

## 5. Resep Verifikasi

```bash
# ukur payload & pastikan cacheable (<2MB)
curl -s "http://localhost:3000/api/<route>?dateFrom=2026-01-01&dateTo=<hari-ini>" -o /dev/null -w "%{size_download} bytes\n"
# uji view rows (sort/search/slice)
curl -s ".../api/<route>?...&view=rows&sortKey=amount&sortDir=desc&offset=0&limit=3"
# uji detail
curl -s ".../api/<route>?...&detail=<prjId>"
```
Lalu verifikasi UI via temp route (lihat Gotchas), cek console error (khususnya "Maximum update depth"), uji: load more, load all, collapse, sort tiap kolom, search, ganti filter + Apply, buka modal. Terakhir: commit per unit kerja, push ke `main` (auto-deploy Vercel).

## 6. Prompt untuk Melanjutkan (copy-paste ke sesi Claude Code baru)

```
Baca docs/OPTIMIZATION-HANDOVER.md lalu lanjutkan pekerjaan optimasi egress Neon
dari bagian "Pekerjaan Tersisa" sesuai urutan prioritas. Ikuti pola & gotchas di
dokumen itu persis (cachedRouteView, bump nama cache saat bentuk response berubah,
useServerRows dengan initialRows stabil, offset/limit/q di drop bukan view).
Verifikasi tiap perubahan dengan resep di bagian 5 (curl ukuran payload + temp
route untuk UI), lalu commit per unit kerja dan push ke main. Update dokumen
handover ini (tabel commit + status pekerjaan tersisa) sebelum selesai.
```
