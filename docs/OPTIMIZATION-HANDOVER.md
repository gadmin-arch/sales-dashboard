# Handover: Optimasi Egress Neon & Lazy Loading

> Dokumen serah-terima pekerjaan optimasi transfer data (egress) Neon dan lazy loading.
> Update terakhir: 2026-07-15. Untuk melanjutkan pekerjaan ini dengan AI agent, pakai
> prompt di bagian paling bawah.

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

Ukuran response YTD sesudah optimasi (semua ter-cache, sebelumnya finance-ap & cost-control TIDAK PERNAH ter-cache):

- finance-ap: per tab — overview 1.6KB · poPayments 1.76MB · reimburse 1.74MB · meal 409KB · loans 42KB
- cost-control: 2.0MB → **398KB** (detail per proyek on-demand)
- projects: → **304KB** (detail per proyek on-demand)
- purchasing/orders: 1.3MB → **297KB** (25 baris pertama; sisanya via `view=rows`)

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

### Gotchas (pelajaran mahal — jangan diulang)
- **Bump nama cache** (`'x' → 'x-v2'`) setiap kali BENTUK response berubah — entry cache hidup melewati deploy; tanpa bump, client baru menerima JSON bentuk lama.
- **`initialRows` ke `useServerRows` harus referensi STABIL** — `data?.rows ?? []` inline bikin array baru tiap render → infinite loop "Maximum update depth exceeded". Pakai module const `EMPTY_ROWS`.
- `offset/limit/q` HARUS di `drop`, bukan `view` — kalau tidak, satu entry cache per klik/ketikan.
- Log egress: `database/db.ts` mencetak `[db] sheet read <tabel> rows=N ~KB` untuk SELECT ke `sheet_*` — cache hit = tidak ada baris log ini.
- Verifikasi page role-gated tanpa login: mount temp route di luar `/dashboard` (mis. `app/temp-verify/x/page.tsx` berisi `export { default } from '../../dashboard/xxx/page'`), hapus sebelum commit. Chart recharts tidak mount di browser pane — verifikasi angka via API/text, bukan pixel chart.
- Dev server lama bocor worker `postcss.js` → RAM penuh; sweep: `pkill -f "postcss.js"`.

## 4. Pekerjaan Tersisa (urut prioritas)

1. **`/api/purchasing/requests` = 1.88MB YTD — HAMPIR menembus limit 2MB.** Terapkan pola #3 (row-slice `view=rows`) seperti purchasing/orders; tabel PR di page-nya juga client-side sekarang.
2. **Tab poPayments (1.76MB) & reimburse (1.74MB) di finance-ap** akan melewati 2MB seiring data tumbuh — terapkan row-slice untuk `rows` di dalam tab (kombinasi pola #1+#3). Perhatikan `useRowFilters`/`FilterBar` di `shared.tsx` yang butuh full rows → filter dropdown per-tab harus ikut jadi param server.
3. **Route ringan sisanya** ("global bertahap", opsional): invoices, delivery (760KB), reports, sales, dll — konversi ke `useServerRows` hanya kalau mau konsistensi UX; egress mereka sudah aman karena ter-cache.
4. **Column pruning**: repo-repo masih `SELECT *` full table (mis. `polists` 8.2MB, `pos` 7.5MB, `reports` 6.9+5.6MB). Ganti ke daftar kolom yang dipakai mapper → potong 50–80% byte per compute-miss.
5. **Cron sync**: config OK di `vercel.json`, tapi **belum pernah jalan**. Penyebab hampir pasti env **`CRON_SECRET` belum di-set di Vercel** (route balas 401; log diagnostik sudah dipasang — cek Vercel → Deployments → Functions log jam 06:00–07:00 WIB). Region sudah dipin `sin1` + batchGet supaya sync muat di maxDuration 60s. Kalau masih timeout, naikkan `maxDuration` (butuh Fluid Compute) atau pecah sync.
6. **Bug data payroll**: KPI tab Payroll semua 0 (rows kosong, totalAdditions terisi) — pre-existing, kemungkinan parsing `endDate` slip. Cek `computePayroll` di `lib/finance-ap-helpers.ts` + tabel `sheet_1ky_pc_z_payroll`.
7. (Opsional) Cache warming pasca-sync — bukan penghemat egress (hanya UX first-load); tunda.

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
