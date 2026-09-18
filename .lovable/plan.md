# Terapkan SOP Photo-to-Video pada generator existing

## Hasil yang dibangun
- Pertahankan alur existing: Selected Concept → Prompt Carousel → Photo-to-Video Prompt.
- Setiap slide tetap menghasilkan tepat satu prompt video siap tempel, tanpa membuat gambar, video, storyboard, atau konsep baru.
- Gunakan data slide existing sebagai sumber terkunci:
  - visual/image prompt sebagai acuan gambar awal dan prompt gambar asli,
  - headline, supporting text, dan key message sebagai konteks VO,
  - narrative function sebagai posisi cerita,
  - durasi pilihan user sebagai durasi video.
- Susun prompt final berbahasa Inggris dengan urutan: camera movement, subject movement, environment movement, VO synchronization, ending frame, preservation rules, motion style, dan negative prompt.
- Sinkronkan gerakan dengan fase cerita: problem, solution, result/payoff, atau CTA tanpa mengubah makna carousel.
- Perketat validator agar prompt menjaga identitas, komposisi, objek, warna, lighting, realisme, durasi, rasio 9:16, ending frame, serta larangan perubahan visual.
- Aksi salin per scene menghasilkan hanya prompt final siap tempel, sesuai SOP “output only”. Aksi paket lengkap tetap tersedia untuk menyalin semua scene sekaligus.

## Batasan
- Tidak menambah workflow, halaman, navigasi, generator media, atau integrasi video.
- Tidak mengubah Selected Concept, hook, problem, solution, payoff, CTA, atau struktur carousel.
- Karena aplikasi saat ini menyimpan prompt visual carousel, bukan file gambar hasil render atau naskah VO terpisah, generator memakai visual slide dan teks slide existing sebagai sumber paling dekat tanpa mengarang input baru.

## Verifikasi
- Pastikan build berhasil.
- Uji validator dan format salin secara lokal tanpa memakai kredit AI.
- Uji panggilan AI nyata hanya bila kredit workspace tersedia; bila tetap tidak tersedia, tampilkan penyebabnya secara jelas seperti perilaku existing.
