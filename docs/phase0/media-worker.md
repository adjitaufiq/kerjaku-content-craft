# Dedicated media worker — kontrak Phase 0

Status: desain dan interface disiapkan; tidak ada worker/server/vendor baru yang dibeli atau dijalankan.

## Batas runtime
- Aplikasi edge hanya autentikasi, ownership, antrean, status, dan request HTTP provider.
- FFmpeg, Remotion, pemrosesan gambar native, local TTS dan alignment berjalan di container terpisah; jangan menjalankan subprocess/native binary di aplikasi edge.
- `src/lib/media-providers.ts` merupakan kontrak lintas provider, bukan implementasi generator gambar, suara, atau MP4.

## Worker hemat biaya
- Container Debian slim dengan FFmpeg dan Node LTS; Python dapat ditambahkan untuk alignment/TTS lokal sesuai pengujian bahasa/lisensi fase berikutnya.
- CPU worker terlebih dahulu. GPU dan provider generative video hanya opt-in untuk mode yang memerlukannya.
- Queue persisten milik aplikasi; worker mengambil job lewat endpoint terautentikasi dan owner-scoped, bukan menerima akses administrator database ke semua data.
- Kontrak job: jobId, userId, idempotencyKey, mode, budget, provider capability, input asset references, output object path, checksum, deadline.
- Claim atomik, lease, heartbeat setiap 15–30 detik, progress tersimpan, retry terbatas, cancellation kooperatif, checksum dan hasil tersimpan sebelum completion.
- Output gambar PNG/JPG, suara MP3/WAV, subtitle SRT/VTT + word timings, video MP4 H.264/AAC; inspeksi MIME, ukuran, durasi dan dimensi sebelum quality gate.
- Signed URLs untuk input/output dibuat ulang per job; credential worker disimpan sebagai secret dan dibatasi ke job yang diklaim.
- Docker deployment dan persistent media queue/worker endpoint belum dibuat pada Phase 0: tidak ada eksekutor render yang diklaim tersedia.

## Estimasi perencanaan, bukan quotation
- CPU VPS kecil: sekitar US$5–15/bulan sebagai kisaran awal; kapasitas render dan harga provider perlu benchmark.
- Storage/bandwidth/AI: terpisah, berdasarkan pemakaian aktual dan plan Lovable Cloud; belum terverifikasi untuk akun ini.
- FFmpeg/Remotion bukan alasan mengasumsikan seluruh pipeline gratis; review lisensi Remotion dan footage/TTS sebelum penggunaan komersial.
- Tidak ada langganan/API key media berbayar ditambahkan pada fase ini.