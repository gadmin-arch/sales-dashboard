# Project Rules for Sales Dashboard

## Worker Reports Sanitization
- **Rule**: Selalu batasi jumlah jam kerja (`reportTime` atau sejenisnya) maksimal 16 jam per laporan/hari. 
- **Handling**: Jika data jam kerja > 16 jam, asumsikan salah input dan ubah/default ke 8 jam menggunakan utilitas pembatas (e.g., `clampHours`).

## KPI & Chart Consistency
- **Rule**: Angka KPI (seperti jumlah/persentase proyek overdue) harus selalu disinkronisasikan dan dihitung dengan kriteria filter yang sama seperti grafik visual terkait (misalnya chart Time Status).
- **Handling**: Jangan menghitung proyek yang tidak memiliki data order lengkap, planned end date, atau proyek berstatus Cancelled (`CC`) di dalam KPI overdue jika grafik visual terkait juga mengecualikan proyek tersebut.
