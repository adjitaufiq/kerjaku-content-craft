# Posting Carousel (Banyak Foto dalam 1 Postingan)

Ya, Instagram mendukung carousel (2–10 foto dalam satu postingan) lewat API yang sama seperti yang sudah dipakai aplikasi ini. Rencana berikut menambahkannya tanpa mengubah alur publish langsung maupun penjadwalan yang sudah jalan.

## Yang akan Anda lihat

- Di halaman editor, kotak unggah foto bisa memilih beberapa foto sekaligus (maks. 10).
- Foto tampil sebagai deretan kecil dengan nomor urut; bisa dihapus satu-satu dan diubah urutannya (geser kiri/kanan).
- Preview menampilkan foto pertama dengan penanda "1/5" dan panah untuk melihat foto lain.
- Tombol Simpan Draft, Publish Sekarang, dan Jadwalkan tetap sama — otomatis mengirim sebagai carousel bila fotonya lebih dari satu, dan sebagai foto tunggal bila hanya satu.
- Di halaman grid, kartu konten menampilkan penanda jumlah foto.

## Catatan penting

- Instagram membatasi 10 foto per postingan; unggahan lebih dari itu akan ditolak dengan pesan yang jelas.
- Postingan lama yang sudah ada tetap tampil normal.

## Detail teknis

1. Migrasi database: tambah kolom `image_urls text[] not null default '{}'` pada `content_logs`; isi awal dari `image_url` yang sudah ada. `image_url` tetap dipertahankan sebagai foto pertama agar tampilan grid dan data lama tidak rusak.
2. `src/lib/content-data.ts`: `uploadImage` dipakai berulang untuk tiap file; tambah tipe `image_urls` pada `ContentLog` dan helper `imagesOf(log)` yang jatuh balik ke `image_url`.
3. `src/lib/instagram.functions.ts`: input berubah jadi `imageUrls: string[]`. Bila 1 foto → alur 2 langkah yang sekarang. Bila >1 → buat container tiap foto dengan `is_carousel_item=true`, lalu container induk `media_type=CAROUSEL` + `children`, lalu `media_publish`. Penanganan error/token expired tidak berubah.
4. `src/routes/api/public/hooks/publish-due.ts`: baca `image_urls` (fallback ke `image_url`) dan pakai logika carousel yang sama; claim job, batch, dan circuit breaker token tetap.
5. `src/lib/use-schedule-runner.ts`: kirim array URL.
6. `src/routes/_authenticated/editor.tsx`: input file `multiple`, state array URL, daftar thumbnail dengan hapus/urutkan, preview 4:5 dengan navigasi, simpan `image_urls` + `image_url` (foto pertama).
7. `src/routes/_authenticated/index.tsx`: badge jumlah foto pada kartu.
