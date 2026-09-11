# Selesaikan Viral DNA & KERJAKU ATM Engine

## Tujuan
Melengkapi tahap setelah Video Understanding: analisis formula viral, pembuatan adaptasi strategis KERJAKU, koneksi Brand Knowledge, serta persetujuan manusia sebelum produksi. Tidak membuat carousel, caption, storyboard, atau konten siap terbit.

## Implementasi
- Tambahkan mesin AI server-side untuk **Viral DNA Analysis** yang hanya menerima Source Content Report yang lolos quality gate. Hasil mencakup hook, pattern interrupt, psychological trigger, curiosity gap, power words, struktur cerita, retensi, engagement, dan bukti sumber.
- Tambahkan mesin **KERJAKU ATM** dengan dua mode:
  - **Conservative:** mempertahankan struktur/formula utama, mengganti konteks dan angle sesuai brand.
  - **Creative:** mengambil prinsip viral, lalu mengubah angle dan storytelling direction lebih jauh.
- Hubungkan ATM dengan Brand Knowledge milik pengguna: profil, produk, aturan do/don't, dan power words. Simpan versi Brand Knowledge yang digunakan bersama hasil ATM.
- Tambahkan fungsi aman untuk membaca, menghasilkan, menyimpan, dan memperbarui status Viral DNA/ATM; seluruh akses tetap owner-only.
- Tambahkan area **Viral DNA & ATM** pada halaman detail sumber: laporan DNA, pemilih mode, input angle, hasil pemetaan sumber ke adaptasi, alasan strategi, dan status persetujuan.
- Tambahkan **approval checkpoint**: approve/reject beserta catatan. Hanya versi approved yang ditandai siap memasuki tahap produksi berikutnya; tidak ada produksi otomatis.
- Tambahkan pengelolaan Brand Knowledge di Settings untuk profil, produk, aturan, dan power words.

## Ketentuan Teknis
- Gunakan tabel yang sudah tersedia: `viral_intelligence`, `kerjaku_versions`, `brand_profile`, `brand_products`, `brand_rules`, dan `brand_power_words`.
- Panggilan AI memakai Lovable AI server-side, streaming, strict JSON schema, dan error gateway yang jelas.
- Bukti Viral DNA harus merujuk pada evidence terverifikasi dari Source Content Report; AI tidak boleh mengarang fakta sumber.
- Quality gate tetap: hanya `completed`, atau `partial` dengan confidence minimal 70%.

## Verifikasi
- Uji quality gate menolak `needs_review`, `failed`, dan partial di bawah 70%.
- Uji nyata satu panggilan Viral DNA dan satu ATM melalui jalur aplikasi.
- Uji simpan Brand Knowledge, pilihan mode, approve/reject, dan pemuatan ulang hasil.
- Periksa tampilan desktop/mobile, error browser, dan build akhir.
