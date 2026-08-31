# Perbaikan pertukaran token Meta 60 hari

## Tujuan
Mencegah CMS menyimpan atau menandai token 2 jam sebagai long-lived, dan memastikan hanya hasil pertukaran yang benar-benar memiliki masa berlaku panjang yang diterima.

## Perubahan
- Gunakan App Access Token (`App ID|App Secret`) untuk inspeksi `/debug_token` secara server-side, bukan token pengguna untuk memeriksa dirinya sendiri.
- Setelah pertukaran `fb_exchange_token`, validasi ulang token hasil pertukaran dan masa berlaku aktual dari Meta.
- Anggap pertukaran gagal bila token hasilnya masih short-lived; jangan timpa token runtime yang sebelumnya tersimpan.
- Simpan dan tampilkan tipe token berdasarkan masa berlaku aktual, bukan label asumsi.
- Berikan pesan CMS yang jelas bila token Graph API Explorer tidak dapat ditukar, termasuk kemungkinan token dibuat untuk App ID yang berbeda.

## Verifikasi
- Jalankan pemeriksaan TypeScript/build otomatis.
- Pastikan status database lama tetap utuh sampai token long-lived yang valid berhasil disimpan.
- Uji jalur status tanpa pernah membaca atau menampilkan raw token.

## Catatan
Meta dapat menerbitkan token sekitar 60 hari hanya jika token pendek berasal dari aplikasi Meta yang sama dengan `META_APP_ID`/`META_APP_SECRET` dan memenuhi syarat pertukaran. Aplikasi akan memverifikasi syarat ini, bukan menjanjikan 60 hari secara palsu.
