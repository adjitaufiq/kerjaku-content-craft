# Audit & Perbaikan Video Understanding Pipeline

Dua perbaikan saja, tanpa fitur baru dan tanpa memulai modul Viral DNA.

## Temuan audit

1. **Validasi bukti belum memeriksa waktu.** Saat ini kutipan hanya dicocokkan ke satu gabungan teks besar (seluruh transkrip disatukan, seluruh teks layar disatukan). Artinya kutipan dari detik ke-2 bisa lolos walau AI menuliskan waktunya detik ke-40, dan bukti visual tidak dicek apakah frame pada waktu itu benar-benar ada.
2. **Belum ada gerbang mutu.** Hasil pemahaman video dengan status "Perlu Ditinjau" atau "Gagal" saat ini tidak dibedakan sebagai bahan yang belum layak dipakai untuk tahap analisis berikutnya.

## Perbaikan 1 — Validasi kutipan + waktu

Pada pemeriksaan otomatis setelah laporan dibuat:

- Kutipan transkrip dicocokkan ke **potongan transkrip pada waktu yang disebut**, bukan ke seluruh transkrip.
- Kutipan teks layar dicocokkan ke **teks layar pada frame di waktu tersebut**.
- Bukti visual harus menunjuk ke **frame/snapshot yang benar-benar ada** pada waktu itu, dan isi deskripsinya harus cocok.
- Toleransi waktu wajar (frame/potongan terdekat dalam beberapa detik) supaya pembulatan waktu tidak dianggap salah.
- Setiap bukti mendapat alasan singkat bila ditolak: kutipan tidak ditemukan, waktu tidak cocok, atau frame tidak ada. Alasan ini tampil di halaman detail sumber.

Skor keyakinan dan status (Selesai / Sebagian / Perlu Ditinjau) tetap dihitung dari rasio bukti yang lolos, kini dengan aturan yang lebih ketat.

## Perbaikan 2 — Gerbang mutu ekstraksi

Aturan tunggal yang dipakai bersama:

- **Boleh lanjut:** status Selesai, atau Sebagian dengan keyakinan minimal 70%.
- **Tidak boleh lanjut otomatis:** Perlu Ditinjau, Gagal, atau Sebagian di bawah 70%.

Di halaman detail sumber muncul panel kesiapan: hijau "Siap untuk analisis lanjutan" atau kuning/merah dengan alasan dan saran (proses ulang video / periksa bukti yang ditolak). Tidak ada proses lanjutan yang berjalan otomatis saat gerbang tertutup.

## Detail teknis

- `src/lib/video-understanding.server.ts`: `validateReport` diubah menjadi berbasis indeks bersegmen — parsing timestamp (`mm:ss` / detik) ke angka, pencarian segmen dalam jendela toleransi (±3 detik untuk transkrip/OCR, dan frame snapshot terdekat untuk visual), pencocokan kutipan ternormalisasi di dalam segmen tersebut, plus `reason` pada tiap `Evidence`. Menerima `snapshots` sebagai bahan tambahan.
- `src/lib/video-understanding.functions.ts`: meneruskan `data.snapshots` ke `validateReport`.
- `src/lib/extraction-gate.ts` (baru, kecil): konstanta `MIN_PARTIAL_CONFIDENCE = 70` dan `evaluateExtractionGate(extraction)` → `{ allowed, level, reason }`, dipakai UI sekarang dan modul Viral DNA nanti.
- `src/routes/_authenticated/source-detail.tsx`: panel kesiapan + label alasan pada badge bukti yang tidak terverifikasi. Tipe `ReportEvidence` menambah `reason?: string`.
- Tanpa migrasi database, tanpa perubahan alur publish/scheduling.

## Verifikasi

- Typecheck + build.
- Uji unit kecil untuk `validateReport`: bukti waktu benar lolos, bukti waktu salah ditolak, bukti visual tanpa frame ditolak.
- Cek halaman detail sumber merender panel kesiapan tanpa error.
