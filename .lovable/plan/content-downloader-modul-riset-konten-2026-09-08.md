# Content Downloader — Modul Riset Konten

Modul baru di dalam KERJAKU Publisher (bukan aplikasi baru), memakai tema dark navy + aksen cyan yang sudah ada.

## 1. Perubahan database

Tabel baru `content_downloads`:

- Identitas sumber: `source_platform` (default `instagram`), `source_url`, `creator_username`, `content_type` (reel/post/video)
- Media: `caption`, `thumbnail_url`, `video_url`, `thumbnail_path`, `video_path` (file di storage internal), `resolution`, `duration`
- Riset: `category` (Hook Reference, Storytelling, Sales Content, Educational, Branding, Viral Reference), `notes`, `tags` (array), `is_favorite`
- Persiapan AI (boleh kosong dulu): `hook_analysis`, `content_structure`, `cta_analysis`, `editing_style`, `audience_type`, `viral_pattern`
- Proses: `status` (processing / completed / failed), `error_message`, `created_at`, `updated_at` + trigger update

Akses: hanya pengguna yang sudah login yang bisa melihat dan mengelola isinya (sama seperti tabel konten lain di aplikasi ini). Bucket privat `content-research` dibuat untuk menyimpan thumbnail dan video.

## 2. File yang berubah / ditambah

- `src/routes/_authenticated/downloader.tsx` — halaman baru: input URL, tombol Analyze & Download, tabel antrean, dan Content Research Library (kategori, catatan, tag, favorit, filter, "Add to Content Bank").
- `src/lib/downloads.functions.ts` — server functions: `analyzeUrl`, `startDownload`, `listDownloads`, `updateDownloadMeta`, `deleteDownload`, `addToContentBank`.
- `src/lib/downloads.server.ts` — validasi URL, pengambilan metadata publik, unduh media ke storage, penulisan baris database.
- `src/lib/content-data.ts` — helper kecil untuk membuat draft dari referensi.
- `src/components/AppShell.tsx` — menu jadi: Content Grid, Editor & Publisher, Content Downloader, Settings.
- `src/routes/_authenticated/editor.tsx` — menerima referensi yang dikirim dari library sebagai draft baru (judul + caption terisi).

## 3. Kebutuhan storage

- Thumbnail ± 100–300 KB per item; video Reel 30 detik biasanya 3–10 MB.
- 200 referensi ≈ 1–2 GB. Bucket dibuat privat dengan batas ukuran file 100 MB, dan tampilan memakai tautan bertanda tangan berjangka waktu.

## 4. Catatan penting soal pengunduhan

Instagram tidak menyediakan cara resmi untuk mengunduh video kreator lain. Yang bisa dilakukan tanpa melanggar aturan platform:

- **Analyze**: mengambil informasi publik dari tautan (pembuat, caption, thumbnail) — ini berjalan langsung.
- **Download video**: butuh salah satu dari dua jalur:
  1. Anda mengunggah file videonya sendiri ke referensi tersebut (selalu bisa, tanpa layanan luar), atau
  2. Menghubungkan layanan pihak ketiga berlisensi (mis. Apify) dengan kunci API Anda — saya siapkan tempat kuncinya, unduhan otomatis aktif begitu kunci diisi.

Modul dibangun dengan kedua jalur: unggah manual selalu tersedia, unduhan otomatis menyala saat kunci layanan diisi. Tidak ada bypass login, konten privat, atau proteksi platform.

## 5. Rencana pengujian

- Tempel tautan Reel publik → Analyze menampilkan pembuat, caption, thumbnail, dan baris berstatus processing → completed.
- Tautan tidak valid / privat → status failed dengan pesan jelas, tidak membuat data sampah.
- Unggah video manual ke sebuah referensi → file tersimpan, pemutar berjalan.
- Beri kategori, catatan, tag, dan favorit → tersimpan dan bertahan setelah muat ulang.
- "Add to Content Bank" → membuka Editor dengan judul dan caption terisi, lalu bisa disimpan sebagai draft dan muncul di Content Grid.
- Cek Content Grid, publish, dan penjadwalan tidak berubah perilakunya.
