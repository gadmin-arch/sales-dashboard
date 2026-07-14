'use client'

import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, BarChart3, FolderOpen, CreditCard, ShoppingCart, Banknote, Gauge, Shield, Lightbulb, ChevronRight } from 'lucide-react'
import { PageSpinner } from '@/components/page-states'
import { SalesPageShell } from '@/components/theme-toggle'

export default function UserManualPage() {
  const { user, isLoading } = useAuth()
  const roles = user?.roles as Record<string, boolean> | undefined

  if (isLoading) {
    return <PageSpinner />
  }

  // Count active modules the user has access to
  const activeRoles = roles ? Object.keys(roles).filter(roleKey => roles[roleKey]) : []

  return (
    <SalesPageShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-violet-500" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Manual</h1>
            <p className="text-muted-foreground mt-2">
              Panduan penggunaan modul dashboard berdasarkan hak akses (*permissions*) akun Anda.
            </p>
          </div>
        </div>

        {activeRoles.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="p-8 text-center space-y-2">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-semibold text-sm">Tidak ada panduan tersedia</h3>
              <p className="text-xs text-muted-foreground">
                Akun Anda belum memiliki hak akses ke modul dashboard apa pun. Silakan hubungi Administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            
            {/* 1. SALES MANUAL */}
            {roles?.sales && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 shrink-0">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-sky-600 dark:text-sky-400">Modul Sales</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan mengelola aktivitas penjualan, prospek, dan performa pelanggan.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Sales Overview:</strong> Memantau performa penjualan secara keseluruhan, grafik omset bulanan, dan kontribusi masing-masing sales.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Sales Activities:</strong> Mencatat dan memantau aktivitas harian (kunjungan, meeting, follow-up) beserta level prioritasnya.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Leads & Opportunities:</strong> Mengelola prospek baru (*leads*) hingga penawaran proyek aktif (*opportunities*) beserta peringkat/rating keberhasilannya.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-sky-500/5 rounded-lg border border-sky-500/15 flex gap-2.5 items-start">
                    <Lightbulb className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tip:</strong> Gunakan fitur filter tanggal di bagian atas untuk melihat aktivitas penjualan pada rentang waktu tertentu.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. PROJECT MANAGEMENT MANUAL */}
            {roles?.project && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-emerald-600 dark:text-emerald-400">Modul Project Management</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan mengawasi kemajuan proyek, pengiriman barang, dan laporan kerja harian.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Projects Dashboard:</strong> Memantau penggunaan anggaran proyek secara dinamis tanpa menampilkan nominal keuangan sensitif jika akun Anda tidak memiliki akses ke Cost Control.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Project Delivery:</strong> Melacak status serah terima pekerjaan (BAST) dan *milestone* pengiriman lapangan.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Worker Reports:</strong> Menginput dan mengawasi lembar kerja harian teknisi/pekerja lapangan beserta akumulasi jam kerja mereka.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/15 flex gap-2.5 items-start">
                    <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tip:</strong> Di dalam detail proyek, tab *Meal Benefits* kini dapat diakses untuk melihat rincian pengajuan konsumsi pekerja di lapangan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. FINANCE MANUAL */}
            {roles?.finance && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-purple-600 dark:text-purple-400">Modul Finance</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan melacak invoicing (piutang), pencairan dana supplier, dan reimbursment kas.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Invoices & Receivables:</strong> Mengawasi termin penagihan (*invoices*) pelanggan dan status sisa piutang proyek.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Payments Collection:</strong> Mencatat riwayat pembayaran yang diterima dari pelanggan.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Finance AP & AP Reimburse:</strong> Memproses pengajuan pembayaran hutang (*payment requests*) ke vendor dan klaim rembesan operasional (*reimbursements*).</p>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/15 flex gap-2.5 items-start">
                    <Lightbulb className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tip:</strong> Pastikan status pembayaran telah divalidasi ke rekening koran sebelum memperbarui status invoice di lembar kerja Google Sheets.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. PURCHASING MANUAL */}
            {roles?.purchasing && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-amber-600 dark:text-amber-400">Modul Purchasing</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan memproses pengadaan barang, pembuatan PO, dan penilaian vendor.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Purchase Requests:</strong> Mengelola permintaan pengadaan material/jasa dari unit operasional (*PR*).</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Purchase Orders:</strong> Menerbitkan dokumen PO resmi ke vendor/penyedia jasa beserta data termin pembayarannya.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Vendor Scorecard:</strong> Menganalisis ketepatan waktu pengiriman vendor dan membandingkan harga penawaran terbaik.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. PAYROLL MANUAL */}
            {roles?.payroll && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 shrink-0">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-orange-600 dark:text-orange-400">Modul Payroll</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan mengelola penggajian karyawan, potongan pinjaman, dan tunjangan konsumsi.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Payroll & Salaries:</strong> Merekap absen bulanan, menghitung upah lembur pekerja, serta potongan angsuran pinjaman karyawan.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Meal Tunjangan:</strong> Mengawasi dan merilis tunjangan makan harian teknisi/tim di lapangan.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 6. COST CONTROL MANUAL */}
            {roles?.['cost control'] && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500 shrink-0">
                    <Gauge className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-pink-600 dark:text-pink-400">Modul Cost Control</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan mengendalikan anggaran proyek, evaluasi selisih margin, dan KPI produktivitas pekerja.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Cost Control Overview:</strong> Membandingkan nilai PO jual dengan total pengeluaran riil (PO beli + reimbursement kas + biaya tunjangan makan) di level proyek untuk mengidentifikasi pembengkakan biaya (*overbudget*).</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">Worker KPIs:</strong> Menganalisis rasio keterlambatan proyek, skor disiplin, serta efisiensi lembur para teknisi lapangan.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 7. ADMIN MANUAL */}
            {roles?.admin && (
              <Card className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 shrink-0">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-violet-600 dark:text-violet-400">Modul Admin</CardTitle>
                    <CardDescription className="text-xs">
                      Panduan konfigurasi otorisasi sistem dan manajemen pengguna.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                      <p><strong className="text-foreground">User Management:</strong> Mendaftarkan akun pengguna baru, menyetel kata sandi, serta memberikan hak akses modul (Roles).</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}
      </div>
    </SalesPageShell>
  )
}
