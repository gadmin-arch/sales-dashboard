'use client'

import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpen, BarChart3, FolderOpen, CreditCard, ShoppingCart, Banknote, Gauge, Shield,
  Lightbulb, ChevronRight, LogIn, RefreshCw, SlidersHorizontal, MousePointerClick,
  Info, Table2, HelpCircle
} from 'lucide-react'
import { PageSpinner } from '@/components/page-states'
import { SalesPageShell } from '@/components/theme-toggle'

/* ---------- small building blocks ---------- */

function Bullet({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
      <p>{children}</p>
    </div>
  )
}

/** Definition row: term + explanation, used for KPI glossaries. */
function Def({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <p className="pl-1">
      <strong className="text-foreground">{name}</strong>
      <span className="text-muted-foreground"> — {children}</span>
    </p>
  )
}

/** Collapsible manual for one page inside a module. */
function PageManual({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-border bg-muted/20 open:bg-muted/30">
      <summary className="flex cursor-pointer select-none items-start gap-2 p-3 list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform group-open:rotate-90" />
        <span>
          <span className="font-semibold text-foreground text-xs">{title}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">{summary}</span>
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-2 text-xs text-muted-foreground border-t border-border/60 mt-1">
        {children}
      </div>
    </details>
  )
}

function Tip({ color, border, iconColor, children }: { color: string; border: string; iconColor: string; children: React.ReactNode }) {
  return (
    <div className={`p-3 rounded-lg border flex gap-2.5 items-start ${color} ${border}`}>
      <Lightbulb className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
      <p className="text-[11px] leading-relaxed">{children}</p>
    </div>
  )
}

function ModuleCard({
  icon, iconBox, titleColor, title, description, children,
}: {
  icon: React.ReactNode; iconBox: string; titleColor: string; title: string; description: string; children: React.ReactNode
}) {
  return (
    <Card className="border hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <div className={`p-2.5 rounded-xl shrink-0 ${iconBox}`}>{icon}</div>
        <div className="space-y-1">
          <CardTitle className={`text-base font-bold ${titleColor}`}>{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-2 text-xs text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

/* ---------- page ---------- */

export default function UserManualPage() {
  const { user, isLoading } = useAuth()
  const roles = user?.roles as Record<string, boolean> | undefined

  if (isLoading) {
    return <PageSpinner />
  }

  const activeRoles = roles ? Object.keys(roles).filter((roleKey) => roles[roleKey]) : []

  return (
    <SalesPageShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-violet-500" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Manual</h1>
            <p className="text-muted-foreground mt-2">
              Panduan penggunaan dashboard PT. Multi Daya Mitra. Modul yang tampil di bawah mengikuti hak akses akun Anda.
            </p>
          </div>
        </div>

        {/* ====== GETTING STARTED — always visible ====== */}
        <ModuleCard
          icon={<LogIn className="h-6 w-6" />}
          iconBox="bg-slate-500/10 text-slate-500"
          titleColor="text-slate-600 dark:text-slate-300"
          title="Memulai: Login & Navigasi"
          description="Cara masuk ke dashboard dan berpindah antar halaman."
        >
          <Bullet color="text-slate-500">
            <strong className="text-foreground">Login:</strong> klik <em>Sign in with Google</em> di halaman login menggunakan akun email yang sudah didaftarkan oleh Administrator. Email yang belum terdaftar atau belum diberi hak akses tidak dapat masuk.
          </Bullet>
          <Bullet color="text-slate-500">
            <strong className="text-foreground">Sidebar:</strong> menu di sisi kiri dikelompokkan per modul (Sales, Finance, Project Management, Purchasing, Payroll, Cost Control, Admin). Klik nama grup untuk membuka/menutup daftar halamannya. Hanya modul yang sesuai hak akses Anda yang muncul.
          </Bullet>
          <Bullet color="text-slate-500">
            <strong className="text-foreground">Tema terang/gelap:</strong> gunakan tombol tema di kanan atas setiap halaman untuk berganti mode terang/gelap.
          </Bullet>
          <Bullet color="text-slate-500">
            <strong className="text-foreground">Logout:</strong> tombol keluar berada di bagian bawah sidebar.
          </Bullet>
        </ModuleCard>

        {/* ====== COMMON FEATURES — always visible ====== */}
        <ModuleCard
          icon={<SlidersHorizontal className="h-6 w-6" />}
          iconBox="bg-teal-500/10 text-teal-500"
          titleColor="text-teal-600 dark:text-teal-400"
          title="Fitur Umum di Semua Halaman"
          description="Sinkronisasi data, filter, chart interaktif, tooltip, dan tabel — berlaku sama di seluruh dashboard."
        >
          <div className="space-y-2">
            <Bullet color="text-teal-500">
              <strong className="text-foreground"><RefreshCw className="h-3.5 w-3.5 inline mr-1" />Sumber data & sinkronisasi:</strong> seluruh data berasal dari Google Sheets yang disalin (sync) ke database dashboard. Data <em>bukan realtime</em> — dashboard menampilkan kondisi saat sinkronisasi terakhir. Sinkronisasi otomatis dijadwalkan setiap hari (sekitar pukul 06.00 WIB). Untuk memperbarui manual, klik tombol <em>Sync Data</em> di sidebar → konfirmasi → tunggu proses selesai (halaman akan reload otomatis). Waktu sync terakhir tertera di bawah tombol.
            </Bullet>
            <Bullet color="text-teal-500">
              <strong className="text-foreground">Filter tanggal:</strong> setiap halaman memiliki filter rentang tanggal. Isi lewat (1) pilih <em>Bulan &amp; Tahun</em>, (2) tanggal awal–akhir spesifik, atau (3) tombol preset: This Month, Last 30 Days, 6 Months, 1 Year, Last Year, YTD, 5 Years. Default saat halaman dibuka adalah YTD (awal tahun s.d. hari ini).
            </Bullet>
            <Bullet color="text-teal-500">
              <strong className="text-foreground">Filter dropdown &amp; tombol Apply:</strong> sebagian halaman punya dropdown multi-pilih (status, sales, tipe, dsb.). Perubahan filter baru dijalankan setelah menekan <em>Apply</em>; gunakan <em>Reset Filter</em> untuk kembali ke kondisi awal.
            </Bullet>
            <Bullet color="text-teal-500">
              <strong className="text-foreground"><MousePointerClick className="h-3.5 w-3.5 inline mr-1" />Chart interaktif (klik untuk memfilter):</strong> klik potongan donut atau batang chart untuk memfilter tabel di bawahnya. Label filter aktif muncul di dekat judul halaman — klik tanda ✕ pada label untuk menghapusnya.
            </Bullet>
            <Bullet color="text-teal-500">
              <strong className="text-foreground"><Info className="h-3.5 w-3.5 inline mr-1" />Tooltip ⓘ:</strong> arahkan kursor ke ikon ⓘ di samping judul KPI/chart untuk melihat definisi dan rumus perhitungannya.
            </Bullet>
            <Bullet color="text-teal-500">
              <strong className="text-foreground"><Table2 className="h-3.5 w-3.5 inline mr-1" />Tabel:</strong> klik judul kolom untuk mengurutkan, gunakan kotak pencarian untuk mencari, dan tombol <em>Load More</em> untuk memuat baris berikutnya. Di beberapa halaman (Projects, Payroll, Loans, Meal) klik baris untuk membuka detail.
            </Bullet>
          </div>
          <Tip color="bg-teal-500/5" border="border-teal-500/15" iconColor="text-teal-500">
            <strong>Tip:</strong> Jika angka di dashboard terasa berbeda dengan Google Sheets, kemungkinan data belum tersinkron — klik <em>Sync Data</em> lalu bandingkan lagi setelah halaman ter-reload.
          </Tip>
        </ModuleCard>

        {activeRoles.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="p-8 text-center space-y-2">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-semibold text-sm">Tidak ada panduan modul tersedia</h3>
              <p className="text-xs text-muted-foreground">
                Akun Anda belum memiliki hak akses ke modul dashboard apa pun. Silakan hubungi Administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">

            {/* ====== 1. SALES ====== */}
            {roles?.sales && (
              <ModuleCard
                icon={<BarChart3 className="h-6 w-6" />}
                iconBox="bg-sky-500/10 text-sky-500"
                titleColor="text-sky-600 dark:text-sky-400"
                title="Modul Sales"
                description="Memantau performa penjualan, aktivitas sales, prospek, dan performa pelanggan."
              >
                <PageManual title="Sales Overview" summary="Ringkasan performa penjualan: nilai PO, invoice, quotation, dan kontribusi per sales.">
                  <Def name="Total Projects">jumlah proyek aktif (tipe Project) sesuai filter.</Def>
                  <Def name="Total Sales">akumulasi nilai kontrak PO seluruh proyek terfilter.</Def>
                  <Def name="Total Invoice">total invoice terbit; baris kecil di bawahnya menunjukkan total pembayaran yang sudah diterima.</Def>
                  <Def name="Total Quotations / Quotation Value">jumlah dan total nilai akhir penawaran (quotation) aktif.</Def>
                  <p className="pt-1">
                    Chart yang tersedia: tren nilai PO per bulan (dipecah material vs jasa), komposisi penjualan per tipe, rasio Material vs Service, kontribusi bulanan material/jasa, status quotation, serta perbandingan bulanan PO vs Invoice vs Payment. Di bawahnya ada tabel <em>Top Projects</em>, <em>Top Sales Persons</em>, dan ringkasan per tipe.
                  </p>
                </PageManual>

                <PageManual title="Sales Activities" summary="Rekap aktivitas harian sales: kunjungan, meeting, follow-up, dan prioritasnya.">
                  <Def name="Total Activities">jumlah aktivitas dalam rentang filter.</Def>
                  <Def name="Completion Rate">persentase aktivitas berstatus selesai.</Def>
                  <Def name="This Week / High Priority">aktivitas minggu berjalan dan yang berprioritas tinggi.</Def>
                  <p className="pt-1">
                    Chart: tren aktivitas (bisa diganti periode harian/bulanan lewat toggle), komposisi per tipe, per status, per level prioritas, dan ranking sales teraktif.
                  </p>
                </PageManual>

                <PageManual title="Leads & Opportunities" summary="Mengelola prospek baru (leads) hingga menjadi peluang proyek (opportunities).">
                  <Def name="Total Leads / Total Opportunities">jumlah prospek dan peluang dalam filter.</Def>
                  <Def name="Opp. Value">total nilai peluang yang sedang berjalan.</Def>
                  <Def name="Conversion Rate">persentase leads yang terkonversi menjadi opportunity.</Def>
                  <p className="pt-1">
                    Chart: Leads by Rating, Opportunities by Type, Opportunities by Stage, tren leads, dan tren nilai opportunity. Klik potongan chart untuk memfilter tabel leads/opportunities di bawah.
                  </p>
                </PageManual>

                <PageManual title="Customer Scorecard" summary="Kartu nilai pelanggan: nilai PO, piutang tersisa, dan kecepatan bayar.">
                  <Def name="Total Customers / Total PO Value">jumlah pelanggan aktif dan akumulasi nilai kontrak PO.</Def>
                  <Def name="Outstanding Receivables">sisa piutang penagihan yang belum terbayar.</Def>
                  <Def name="PO to Invoice">rata-rata lama penerbitan invoice setelah PO terbit.</Def>
                  <Def name="Invoice to Payment">rata-rata lama pelanggan melunasi invoice.</Def>
                  <p className="pt-1">Tabel scorecard merangkum performa tiap pelanggan — urutkan kolom untuk melihat pelanggan terbaik/terburuk.</p>
                </PageManual>

                <Tip color="bg-sky-500/5" border="border-sky-500/15" iconColor="text-sky-500">
                  <strong>Tip:</strong> Gunakan preset <em>YTD</em> untuk laporan tahun berjalan, lalu klik potongan chart (mis. status quotation) untuk melihat daftar dokumen di baliknya.
                </Tip>
              </ModuleCard>
            )}

            {/* ====== 2. FINANCE ====== */}
            {roles?.finance && (
              <ModuleCard
                icon={<CreditCard className="h-6 w-6" />}
                iconBox="bg-purple-500/10 text-purple-500"
                titleColor="text-purple-600 dark:text-purple-400"
                title="Modul Finance"
                description="Piutang (invoice & pembayaran masuk) dan hutang/pengeluaran (Finance AP lima stream)."
              >
                <PageManual title="Invoices & Receivables" summary="Memantau invoice terbit, pelunasan, piutang tersisa, dan invoice jatuh tempo.">
                  <Def name="Total Invoiced">total nilai seluruh invoice yang terbit sesuai filter.</Def>
                  <Def name="Total Paid">total dana yang sudah diterima.</Def>
                  <Def name="Total Outstanding">sisa invoice yang belum terbayar; angka kecil menunjukkan <em>collection rate</em> (Paid ÷ Invoiced).</Def>
                  <Def name="Overdue">total invoice belum lunas yang sudah melewati estimasi jatuh tempo, beserta jumlah dokumennya.</Def>
                  <p className="pt-1">
                    Chart: status invoice (Paid/Unpaid/Partial/Overdue), perbandingan bulanan invoice vs pembayaran, aging piutang berdasarkan jatuh tempo, perkiraan jadwal penerimaan kas, serta distribusi lead time (selesai proyek → invoice, invoice → jatuh tempo, invoice → pelunasan, dan keterlambatan bayar).
                  </p>
                </PageManual>

                <PageManual title="Payments Collection" summary="Riwayat pembayaran yang diterima dari pelanggan.">
                  <Def name="Total Collected">akumulasi pembayaran diterima sesuai filter.</Def>
                  <Def name="Collected This Month">pembayaran yang diterima bulan berjalan.</Def>
                  <Def name="Payments / Avg Payment">jumlah transaksi dan rata-rata nilai per transaksi.</Def>
                  <p className="pt-1">Chart tren penerimaan bulanan dan ranking pelanggan berdasarkan setoran. Tabel di bawah memuat seluruh transaksi pembayaran.</p>
                </PageManual>

                <PageManual title="Finance AP & AP Reimburse" summary="Dashboard hutang & pengeluaran dengan 6 tab: Overview, PO Payments, Payroll, Meal Benefits, Loans, Reimburse.">
                  <Def name="Tab Overview">gabungan seluruh arus kas keluar (PO Payments + Payroll + Petty Cash + Loans + Meal). KPI utama: Total Cash Outflow, Total Outstanding (hutang berjalan), Payroll Disbursed, dan Petty Cash Balance.</Def>
                  <Def name="Tab PO Payments">pengajuan pembayaran ke vendor. KPI: Outstanding AP, Overdue, Total Paid, On-Time Rate, dan lead time proses (Req → Approval → Paid). Istilah <em>tempo</em> = pembayaran bertermin. Chart AP Aging menunjukkan hutang berdasarkan lamanya lewat jatuh tempo.</Def>
                  <Def name="Tab Payroll">hanya tampil bila akun Anda juga punya akses Payroll — isinya sama dengan halaman Payroll &amp; Salaries.</Def>
                  <Def name="Tab Meal Benefits">tunjangan makan: Approved Benefit (budget disetujui), Net Released (dana dicairkan), Total Evidence (bukti belanja riil), dan Leftover Balance (sisa saldo). Ada tabel saldo per karyawan.</Def>
                  <Def name="Tab Loans">pinjaman karyawan: Outstanding, Total Disbursed, proyeksi angsuran bulanan, dan forecast pelunasan 12 bulan. Catatan: outstanding bersifat saldo berjalan sehingga tab ini tidak dibatasi filter tanggal.</Def>
                  <Def name="Tab Reimburse">kas kecil (petty cash): saldo = Total Refill (Cash In) − Total Klaim (Cash Out), hanya transaksi berstatus approved. Ada ranking pengeluaran per kategori, proyek, dan karyawan, plus tabel saldo petty cash per user.</Def>
                </PageManual>

                <Tip color="bg-purple-500/5" border="border-purple-500/15" iconColor="text-purple-500">
                  <strong>Tip:</strong> Mulailah dari tab <em>Overview</em> untuk melihat stream mana yang pengeluarannya terbesar, lalu klik tab terkait untuk analisis detailnya.
                </Tip>
              </ModuleCard>
            )}

            {/* ====== 3. PROJECT MANAGEMENT ====== */}
            {roles?.project && (
              <ModuleCard
                icon={<FolderOpen className="h-6 w-6" />}
                iconBox="bg-emerald-500/10 text-emerald-500"
                titleColor="text-emerald-600 dark:text-emerald-400"
                title="Modul Project Management"
                description="Kemajuan proyek, ketepatan pengiriman/serah terima (BAST), dan laporan kerja harian."
              >
                <PageManual title="Projects" summary="Utilisasi anggaran material & jasa per proyek, dengan detail transaksi per proyek.">
                  <p>
                    Filter yang tersedia: Sales User, PE PIC, PE Team, Project Type, Project Status, Invoice Status, dan Project Flag. Tabel menampilkan <em>Material Util %</em>, <em>Service Util %</em>, dan <em>Total Util %</em> (persentase pemakaian anggaran) per proyek.
                  </p>
                  <Def name="Detail proyek">klik baris proyek untuk membuka jendela detail berisi tab <em>Purchases</em>, <em>Reimbursements</em>, <em>Meal Benefits</em>, <em>Overtimes</em>, dan <em>Daily Reports</em> milik proyek tersebut.</Def>
                </PageManual>

                <PageManual title="Project Delivery" summary="Ketepatan waktu penyelesaian & serah terima (BAST) proyek: plan vs actual.">
                  <Def name="On-Time Delivery">proyek yang BAST-nya diserahkan pada/sebelum jatuh tempo, dihitung dari proyek yang sudah terkirim.</Def>
                  <Def name="Overtime Deliveries">BAST diserahkan setelah jatuh tempo.</Def>
                  <Def name="Overdue, No BAST">jatuh tempo sudah lewat dan BAST belum ada (berisiko). <em>Pengecualian:</em> proyek berstatus Completed atau sudah ter-invoice 100% dianggap tidak wajib BAST dan tidak dihitung di sini.</Def>
                  <Def name="Median Duration">durasi tengah pengerjaan dari mulai aktual sampai selesai aktual.</Def>
                  <p className="pt-1">
                    Basis tanggal filter bisa diganti (Due Date, Start Date, Actual End Date, Created Date) lewat dropdown di panel filter. Chart mencakup ketepatan BAST vs Due, Done vs Due, status proyek, proyek baru per bulan, distribusi keterlambatan, dan distribusi durasi (plan vs aktual). Tabel <em>At Risk</em> berisi daftar proyek overdue tanpa BAST yang perlu ditindaklanjuti.
                  </p>
                </PageManual>

                <PageManual title="Worker Reports" summary="Laporan harian pekerja lapangan: jam kerja, lembur, dan kedisiplinan pelaporan.">
                  <Def name="Total Reports / Total Hours">jumlah laporan dan akumulasi jam kerja (plus jam lembur).</Def>
                  <Def name="Active Workers / Unique Projects">jumlah pekerja aktif dan proyek yang dikerjakan.</Def>
                  <Def name="Avg. Reporting Delay">rata-rata jeda dari akhir hari kerja sampai laporan disetor (same-day = 0).</Def>
                  <Def name="Avg. Discipline Score">skor 1–4 dari kecepatan lapor: ≤2 hari = 4, 2–7 hari = 3, 7–30 hari = 2, &gt;30 hari = 1.</Def>
                  <p className="pt-1">
                    Chart: laporan &amp; jam per bulan, komposisi skor disiplin, status proyek, dan status waktu (jadwal proyek vs log pekerja). Tersedia ranking <em>Top Workers by Hours</em>, tabel per pekerja, dan tabel <em>Hours per Project</em>.
                  </p>
                </PageManual>

                <Tip color="bg-emerald-500/5" border="border-emerald-500/15" iconColor="text-emerald-500">
                  <strong>Tip:</strong> Jadikan tabel <em>At Risk — Overdue &amp; No BAST</em> di halaman Delivery sebagai daftar prioritas mingguan tim proyek.
                </Tip>
              </ModuleCard>
            )}

            {/* ====== 4. PURCHASING ====== */}
            {roles?.purchasing && (
              <ModuleCard
                icon={<ShoppingCart className="h-6 w-6" />}
                iconBox="bg-amber-500/10 text-amber-500"
                titleColor="text-amber-600 dark:text-amber-400"
                title="Modul Purchasing"
                description="Pipeline pengadaan: permintaan pembelian (PR), purchase order (PO), dan penilaian vendor."
              >
                <PageManual title="Purchase Requests" summary="Permintaan pengadaan (PR) dari unit operasional dan progres pemenuhannya.">
                  <Def name="Total PR / Purchased / Open PRs / Overdue">jumlah PR keseluruhan, yang sudah dibelikan, yang masih terbuka, dan yang terlambat.</Def>
                  <Def name="Total Estimated vs Total Purchased">perbandingan nilai estimasi PR dengan realisasi pembelian; <em>Avg Saving</em> menunjukkan rata-rata penghematan terhadap estimasi.</Def>
                  <Def name="Lead Time (PR → PO) & Goods Received">rata-rata lama PR diproses menjadi PO dan sampai barang diterima.</Def>
                  <p className="pt-1">Chart: breakdown status &amp; overdue, beban kerja handler, Estimated vs Purchased bulanan, volume PR, dan top proyek berdasarkan nilai pembelian.</p>
                </PageManual>

                <PageManual title="Purchase Orders" summary="Belanja PO ke vendor: nilai, pajak, status approval, dan analisis per purchaser.">
                  <Def name="Total Spend / PO Count / Avg PO Value / Vendors">total belanja, jumlah PO (beserta jumlah line item), rata-rata nilai PO, dan jumlah vendor.</Def>
                  <Def name="Net Spend / Total PPN / Total PPH">nilai bersih dan komponen pajaknya.</Def>
                  <Def name="Approved">jumlah PO yang disetujui; angka kecil menunjukkan yang masih menunggu.</Def>
                  <p className="pt-1">Chart: tren belanja bulanan, komposisi tipe pembayaran, belanja per status &amp; tipe barang, top vendor, top proyek, serta perbandingan antar purchaser (nilai, jumlah PO, jumlah line).</p>
                </PageManual>

                <PageManual title="Vendor Scorecard" summary="Konsentrasi belanja per vendor untuk evaluasi supplier.">
                  <Def name="Active Vendors / Total Spend">jumlah vendor aktif dan total belanja pada rentang filter.</Def>
                  <Def name="Top Vendor Share">porsi belanja yang terserap vendor terbesar — indikator ketergantungan pada satu supplier.</Def>
                  <Def name="Spend Concentration (Pareto)">kurva kumulatif belanja 15 vendor teratas.</Def>
                  <p className="pt-1">Klik batang vendor pada chart untuk memfilter tabel vendor di bawahnya.</p>
                </PageManual>
              </ModuleCard>
            )}

            {/* ====== 5. PAYROLL ====== */}
            {roles?.payroll && (
              <ModuleCard
                icon={<Banknote className="h-6 w-6" />}
                iconBox="bg-orange-500/10 text-orange-500"
                titleColor="text-orange-600 dark:text-orange-400"
                title="Modul Payroll"
                description="Penggajian karyawan: slip gaji, pencairan, kekurangan transfer, dan pinjaman via THP."
              >
                <PageManual title="Payroll & Salaries" summary="Rekap slip gaji dan progres pencairan gaji ke karyawan.">
                  <Def name="Total Receipt">total pendapatan kotor seluruh slip pada periode filter.</Def>
                  <Def name="Take-Home Pay">total gaji bersih (THP) yang menjadi hak karyawan; angka kecil = median per slip.</Def>
                  <Def name="Transferred / Total Disbursed">gaji yang sudah dicairkan dari rekening perusahaan, termasuk penyesuaian pinjaman/angsuran via THP.</Def>
                  <Def name="Shortfall / Total Unpaid">selisih yang belum ditransfer dibanding THP, beserta jumlah slip yang belum terbayar.</Def>
                  <Def name="Active Loans (THP)">pinjaman karyawan baru yang dicairkan lewat payroll pada periode berjalan.</Def>
                  <p className="pt-1">
                    Tabel <em>Payslips</em> memuat semua slip — klik baris untuk melihat rincian komponen gaji. Bila Anda juga punya akses Finance, chart pendukung (THP vs Disbursed bulanan, status slip, top tunjangan/potongan) tersedia di tab Payroll pada halaman Finance AP.
                  </p>
                </PageManual>
              </ModuleCard>
            )}

            {/* ====== 6. COST CONTROL ====== */}
            {roles?.['cost control'] && (
              <ModuleCard
                icon={<Gauge className="h-6 w-6" />}
                iconBox="bg-pink-500/10 text-pink-500"
                titleColor="text-pink-600 dark:text-pink-400"
                title="Modul Cost Control"
                description="Budget vs realisasi biaya per proyek dan KPI produktivitas pekerja."
              >
                <PageManual title="Cost Control Overview" summary="Membandingkan budget PO jual dengan seluruh pengeluaran riil per proyek.">
                  <Def name="Total Budget">budget material + jasa dari PO pelanggan.</Def>
                  <Def name="Total Spent (Adjusted)">realisasi belanja material + jasa, termasuk biaya tenaga kerja hasil <em>Workforce Pricing Calculator</em>; angka kecil menunjukkan jumlah proyek yang overbudget.</Def>
                  <p className="pt-1">
                    Pengeluaran riil dihitung dari PO pembelian + klaim reimburse + tunjangan makan + biaya lembur/laporan pekerja. Panel <em>Portfolio Progress &amp; Sub-Expenses</em> merangkum posisi portofolio, dan tiap kartu proyek menampilkan PIC serta tim pelaksananya. Klik proyek untuk melihat rincian transaksinya.
                  </p>
                </PageManual>

                <PageManual title="Worker KPIs" summary="Kinerja pekerja disandingkan dengan nilai order proyek yang mereka tangani.">
                  <Def name="Total Reports / Total Hours / Active Workers">volume laporan, jam kerja (plus lembur), dan pekerja aktif.</Def>
                  <Def name="Avg. Reporting Delay">kecepatan setor laporan (same-day = terbaik).</Def>
                  <Def name="Total Value Handled">akumulasi nilai PO proyek-proyek yang sedang dikerjakan pekerja aktif pada periode tersebut.</Def>
                  <p className="pt-1">Gunakan halaman ini untuk menilai beban kerja vs nilai pekerjaan: pekerja dengan jam tinggi tetapi nilai order kecil bisa jadi indikasi alokasi yang kurang efisien.</p>
                </PageManual>
              </ModuleCard>
            )}

            {/* ====== 7. ADMIN ====== */}
            {roles?.admin && (
              <ModuleCard
                icon={<Shield className="h-6 w-6" />}
                iconBox="bg-violet-500/10 text-violet-500"
                titleColor="text-violet-600 dark:text-violet-400"
                title="Modul Admin"
                description="Manajemen pengguna dan hak akses modul dashboard."
              >
                <PageManual title="User Management" summary="Mendaftarkan user baru dan mengatur hak akses per modul.">
                  <Def name="Kartu ringkasan">Total User, jumlah IT Administrator, dan jumlah user dengan akses dashboard aktif.</Def>
                  <Def name="Add User">daftarkan email Google karyawan agar bisa login ke dashboard.</Def>
                  <Def name="Edit Permissions">klik ikon edit pada baris user untuk mencentang modul yang boleh diakses (Sales, Finance, Project, Purchasing, Payroll, Cost Control, Admin), lalu tekan <em>Save Permissions</em>.</Def>
                  <p className="pt-1">
                    Perubahan hak akses langsung berlaku — sidebar user yang bersangkutan akan menyesuaikan saat halaman berikutnya dimuat. Hak akses divalidasi ulang ke server pada setiap sesi, sehingga akses yang dicabut tidak bisa dipakai lagi meski user masih membuka dashboard.
                  </p>
                </PageManual>

                <Tip color="bg-violet-500/5" border="border-violet-500/15" iconColor="text-violet-500">
                  <strong>Tip:</strong> Berikan role <em>Admin</em> seminimal mungkin — role ini dapat mengubah hak akses semua user.
                </Tip>
              </ModuleCard>
            )}

          </div>
        )}

        {/* ====== FAQ — always visible ====== */}
        <ModuleCard
          icon={<HelpCircle className="h-6 w-6" />}
          iconBox="bg-rose-500/10 text-rose-500"
          titleColor="text-rose-600 dark:text-rose-400"
          title="FAQ & Pemecahan Masalah"
          description="Jawaban untuk kendala yang paling sering ditemui."
        >
          <Bullet color="text-rose-500">
            <strong className="text-foreground">Data tidak muncul / tabel kosong?</strong> Periksa filter tanggal (mungkin rentangnya terlalu sempit) dan pastikan tidak ada label filter chart aktif di dekat judul halaman — klik ✕ untuk menghapusnya, atau tekan <em>Reset Filter</em>.
          </Bullet>
          <Bullet color="text-rose-500">
            <strong className="text-foreground">Angka berbeda dengan Google Sheets?</strong> Dashboard menampilkan data per waktu sync terakhir. Klik <em>Sync Data</em> di sidebar, tunggu selesai, lalu periksa kembali.
          </Bullet>
          <Bullet color="text-rose-500">
            <strong className="text-foreground">Tidak bisa login / menu tertentu tidak tampil?</strong> Akun Anda belum terdaftar atau belum diberi hak akses modul tersebut. Hubungi Administrator untuk didaftarkan lewat halaman User Management.
          </Bullet>
          <Bullet color="text-rose-500">
            <strong className="text-foreground">Sync gagal?</strong> Coba ulangi beberapa saat lagi. Jika masih gagal, catat pesan errornya dan laporkan ke Administrator.
          </Bullet>
        </ModuleCard>

      </div>
    </SalesPageShell>
  )
}
