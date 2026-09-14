# Navigation and Cliper Workspace Lock

## Hasil
- Navigasi utama dikunci berurutan menjadi **Grid → Editor → Cliper → Settings**.
- Semua URL lama tetap tersedia agar data, bookmark, dan alur lama tidak rusak.
- `/sources` tetap menjadi URL utama Cliper; detail source tetap memakai `/source-detail` dan menandai menu Cliper aktif.

## Implementasi
1. Sederhanakan header menjadi empat menu dengan label persis yang diminta dan pertahankan active state pada halaman detail Cliper.
2. Jadikan halaman source dan detail sebagai satu workspace Cliper dengan progress internal: Source, Analysis, ATM KERJAKU, Hook Matrix, Selected Concept, Output Prompt.
3. Pertahankan Snapshot, Transcript, OCR, Scene Understanding, Source Facts, Viral DNA, ATM, Hook Matrix, dan pemilihan konsep di dalam Cliper.
4. Tampilkan Selected Concept dari data hook yang sudah tersimpan; jangan membuka generator Carousel/Reels pada Step 1.
5. Tempatkan Brand Center di Settings sebagai bagian internal tanpa menghapus route lama `/brand`.
6. Verifikasi Grid, Editor, Cliper, Settings, refresh, active state, back/forward, persistence konsep, dan tampilan desktop/mobile.

## Detail teknis
- Tidak ada migrasi database baru; selected concept tetap menggunakan `kerjaku_versions.selected_hook` dan `hook_selected_at`.
- Tidak menghapus atau mengganti URL existing.
- Route modul lama tetap dapat dibuka melalui tautan kontekstual existing, tetapi tidak menjadi navigasi utama.
