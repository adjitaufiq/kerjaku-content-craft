# Preflight, recovery dan aktivasi Phase 0

## Kondisi aktual
Database Lovable Cloud dijeda. Migration history, schema live, ownership inventory, bucket settings, cron schedule dan backup aktual belum dapat diperiksa. Tidak ada migrasi diterapkan.

## Sebelum perubahan live
1. Aktifkan database melalui pengaturan Cloud; periksa status sehat dan migration history kembali.
2. Jalankan inventaris read-only `docs/phase0/preflight.sql`, cocokkan schema live dengan migration history dan generated types. Periksa seluruh tabel yang belum memiliki user_id/workspace_id dan relasi lintas pemilik.
3. Verifikasi backup database beserta backup object storage. Catat waktu backup, cakupan objek, dan bukti restore rehearsal. Export database saja tidak mencadangkan isi storage.
4. Jangan mulai hardening sebelum snapshot/recovery tersedia. Restore hanya melalui mekanisme Cloud yang didukung dan persetujuan owner; jangan menghapus/mengganti data untuk memperbaiki ownership.
5. Apply `001_ownership_review.sql` melalui tool migration, byte-for-byte. Isi manifest berdasarkan bukti ownership yang direview architect/owner; jangan otomatis menganggap semua data milik admin pertama.
6. Review legacy asset ownership dari uploader/object owner dan referensi record yang sah; konflik atau orphan harus ditahan. Aset tetap disimpan, tidak dihapus.
7. Apply `002_security_isolation.sql` byte-for-byte. Unresolved ownership membatalkan seluruh transaksi. Set bucket instagram-media, viral-sources, content-research private melalui Storage API; migrasi SQL sendiri tidak mengubah public flag bucket.
8. Apply `003_durable_runtime.sql` byte-for-byte. Regenerate tipe integration melalui tool resmi; extension tipe Phase 0 tetap terpisah sampai saat itu.
9. Jalankan dua akun nyata untuk read/write/delete row dan object isolation; cek semua Brand, Library, Editor, Cliper dan publisher secara signed-in.

## Scheduler cutover
1. Inspect schedules memakai tool schedule; klasifikasikan managed/unmanaged. Authentication lama dipertahankan karena schedule belum dapat diinspeksi.
2. Callback baru hanya mencatat verification setelah kredensial valid; default server_scheduler_enabled=false. Tidak ada schedule ditambah/diubah saat database dijeda.
3. Deployment memerlukan persetujuan terpisah. Jangan enable eksekusi/posting publik untuk sekadar menguji callback.
4. Sesudah callback benar-benar teramati pada deployment yang disetujui, lakukan atomic activation server_scheduler_enabled=true. Browser membaca readiness; setelah enabled browser berhenti menjadi pemicu dan tidak kembali saat heartbeat terlambat.
5. Sebelum verification, transisi browser dipertahankan di source tetapi status unknown fail-closed. Semua publikasi memakai server durable executor, bukan HTTP Meta langsung dari browser.
6. Atomic claiming hanya satu job per callback; lease 180 detik, maksimum 5 attempts, backoff 30/60/120/240/480 detik, cap 900 detik, network calls bounded.
7. `publishing` yang stale masuk reconciliation_required; tidak kembali pending. Unknown platform outcome tidak boleh dipublish ulang.
8. Platform post ID yang sudah tercatat di job direkonsiliasi ke content_logs tanpa request publish. Jika response post ID hilang setelah platform menerima posting, container status saja belum membuktikan post ID; perlu verifikasi platform/manual. Ini batas yang sengaja fail-closed, bukan klaim exactly-once di API Meta.

## Recovery dan rollback
- SQL preparation diuji dengan PostgreSQL WASM lokal; bukan bukti database live atau concurrency dua koneksi produksi.
- Semua migration berbentuk transaksi. Kegagalan unresolved ownership rollback sebelum policy diketatkan.
- Setelah apply, jangan membuka kembali policy public untuk menyelesaikan regresi; pause eksekutor dan perbaiki ownership/delivery.
- Pause job executor sebelum recovery. Jangan menghapus posting atau mereset semua state publishing menjadi scheduled.
- AI credit/policy failure mengunci router sampai owner memulihkan kondisi dan clearing pause yang disetujui; rate limit memiliki waktu defer tersimpan.
- Backup/recovery aktual tetap BLOCKED sampai database sehat dan bukti tersedia; tidak ada restore atau deployment dilakukan.