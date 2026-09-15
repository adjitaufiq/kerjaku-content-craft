# Cliper: Timeout, Pemulihan, dan Hapus Source yang Aman

Tujuan: proses analisis video tidak pernah "menggantung". Setiap proses punya batas waktu, bisa diulang, dan setiap source bisa dihapus dengan konfirmasi yang jelas.

## 1. Batas waktu analisis

- Selama analisis berjalan, aplikasi mengirim tanda "masih hidup" setiap 30 detik.
- Jika tidak ada kemajuan selama 4 menit, status otomatis berubah jadi **Timeout** dengan pesan:
  "Proses analisis berhenti karena melewati batas waktu. Silakan coba proses ulang atau hapus source dan upload kembali."
- Jika tanda hidup berhenti tanpa batas waktu terlampaui (mis. browser ditutup) dan halaman dibuka lagi, status jadi **Interrupted** dengan pilihan Proses Ulang atau Hapus Source.
- Pengecekan ini berjalan otomatis saat data source dimuat, jadi status tidak pernah tertinggal di "Processing" selamanya.

## 2. Tombol Proses Ulang Video

Muncul saat status Failed, Timeout, atau Interrupted:
- menghapus hasil analisis lama (transkrip, teks layar, snapshot, scene, skor) beserta file sementara snapshot/audio,
- mengembalikan source ke status Uploaded,
- menjalankan ekstraksi dari awal,
- file video asli tetap dipertahankan.
Toast: "Analisis berhasil direset".

## 3. Hapus source dengan konfirmasi

- Tombol Hapus di daftar source dan di halaman analisis.
- Memakai dialog milik aplikasi (bukan pop-up bawaan browser).
  - Judul: "Hapus Source Video?"
  - Isi: peringatan bahwa transcript, OCR, snapshot, scene analysis, Viral DNA, dan hasil ATM ikut terhapus.
  - Tombol: Batal / Ya, Hapus Source.
- Jika source sedang diproses, dialog menambahkan peringatan:
  "Source sedang diproses. Menghapus akan membatalkan proses analisis berjalan."
- Penghapusan membatalkan proses yang berjalan, lalu menghapus hasil analisis, Viral DNA, hasil ATM, file video dan file sementara, dan terakhir baris source.
- Toast: "Source berhasil dihapus", daftar langsung menyegarkan sendiri.

## 4. Label status baru

Uploaded · Processing · Extracting Evidence · Analyzing Scene · Ready · Failed · Timeout · Interrupted.
Label "Understanding" dihilangkan dari tampilan (data lama tetap terbaca dan dipetakan ke label baru).

## 5. Penyegaran otomatis

Setelah hapus, proses ulang, atau pemulihan timeout, daftar dan halaman analisis memuat ulang datanya sendiri tanpa reload manual. Selama proses berjalan, halaman analisis memantau status berkala agar perubahan langsung terlihat.

## Catatan teknis

- `src/lib/video-understanding.functions.ts`: tambah stage `ANALYSIS_TIMEOUT` dan `PROCESS_INTERRUPTED`, fungsi `heartbeatExtraction`, `recoverStalledExtraction` (dipanggil di dalam `getSourceDetail` dan daftar source), serta `resetSourceExtraction`.
- `src/lib/viral-sources.functions.ts`: `deleteViralSource` diperluas menjadi cascade — hapus `source_extractions`, `viral_intelligence`, `kerjaku_versions`, objek storage `viral-sources` (video + folder extraction), lalu baris source. Tambah pemetaan status tampilan baru.
- `src/routes/_authenticated/source-detail.tsx`: heartbeat 30 detik saat mutation berjalan, polling detail saat status processing, banner Timeout/Interrupted, tombol Proses Ulang + Hapus Source dengan `AlertDialog`.
- `src/routes/_authenticated/sources.tsx`: tombol hapus memakai `AlertDialog` (bukan `confirm()`), label status baru, invalidate query setelah aksi.
- Tanpa migration: kolom status bertipe teks tanpa constraint, `updated_at` sudah dikelola trigger.
