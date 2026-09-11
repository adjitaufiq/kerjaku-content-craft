# Brand Knowledge System — Audit & Blueprint (tanpa implementasi)

## 1. Audit database saat ini

Keempat tabel sudah ada, semuanya milik-pengguna (`user_id` → auth.users, ON DELETE CASCADE), RLS aktif dengan satu kebijakan FOR ALL `auth.uid() = user_id`, GRANT untuk authenticated + service_role, dan trigger `updated_at`.

| Tabel | Kolom domain sekarang | Penilaian |
|---|---|---|
| brand_profile | brand_name, positioning, audience, tone_of_voice, mission, version (1 baris per user, UNIQUE user_id) | Terlalu ringkas: tidak ada description, customer problem, customer desire, personality, writing style, arah visual, gaya terlarang |
| brand_products | name, description, benefit | Kurang: category, features, target user, allowed/forbidden claims, status aktif |
| brand_rules | rule, rule_type ('do'/'dont' bebas teks) | Kurang: kategori allow/forbidden/claim_control, severity, tanpa constraint nilai |
| brand_power_words | word, context | Kurang: category, usage example, forbidden usage |

Temuan lain:
- Halaman pengisian sudah ada sebagian (Brand Knowledge editor di Settings) namun hanya menampung field lama.
- Belum ada satu fungsi resmi "ambil Brand Context" — ATM engine menerima objek brand dari pemanggil, tanpa jaminan kelengkapan.
- `kerjaku_versions.brand_profile_version` sudah ada, tapi versi hanya string `v<timestamp>` yang ditimpa; riwayat isi brand lama tidak tersimpan.
- Penyimpanan sekarang menghapus lalu memasukkan ulang seluruh produk/aturan/power words, sehingga id dan riwayat hilang setiap simpan.

### Strategi migrasi (additive, tanpa hapus data)
```text
Existing        → Required addition                       → Strategy
brand_profile   → description, customer_problem,          → ALTER TABLE ADD COLUMN ... DEFAULT ''
                  customer_desire, personality,
                  writing_style, visual_direction,
                  preferred_style, forbidden_style,
                  completeness_status
brand_products  → category, features text[], target_user, → ADD COLUMN dengan default aman
                  allowed_claims text[], forbidden_claims,
                  status ('active' default)
brand_rules     → rule_category, severity                 → ADD COLUMN default 'allow'/'warning',
                                                             backfill dari rule_type lama
brand_power_words → category, usage_example,              → ADD COLUMN default ''
                    forbidden_usage
baru            → brand_knowledge_versions (snapshot)     → CREATE TABLE + GRANT + RLS owner-only
```
Tidak ada DROP/RENAME. Kolom lama tetap dipakai sebagai sumber utama agar data sekarang aman.

## 2. Blueprint halaman Brand Center

Halaman baru `Brand Center` (menu tersendiri, keluar dari Settings) dengan empat tab:

1. **Profile** — Identity, Audience, Communication, Visual (grup kartu, satu form simpan).
2. **Products** — daftar kartu produk + editor detail, badge Active/Inactive, bagian klaim boleh/terlarang.
3. **Rules** — tiga kolom: Allow, Forbidden, Claim Control; tiap aturan punya severity (warning / hard fail).
4. **Power Words** — tabel kata: kata, kategori, contoh pemakaian, pemakaian terlarang.

Header halaman menampilkan **Brand Readiness**: skor kelengkapan per bagian dan status `Incomplete → Ready`.
Aturan status: Ready jika profil inti terisi (positioning, audience, problem, desire, tone, writing style), minimal 1 produk aktif, minimal 1 aturan forbidden, dan minimal 3 power words. Jika belum: banner "Creative ATM tidak tersedia karena Brand Knowledge belum lengkap" beserta daftar item yang kurang. Tema dark navy/cyan tetap.

## 3. Struktur data final (ringkas)

- brand_profile: identity (brand_name, positioning, description), audience (target_audience/audience, customer_problem, customer_desire), communication (tone_of_voice, personality, writing_style), visual (visual_direction, preferred_style, forbidden_style), version.
- brand_products: name, category, description, features[], benefits/benefit, target_user, allowed_claims[], forbidden_claims[], status.
- brand_rules: rule, rule_category (allow | forbidden | claim_control), severity (warning | hard_fail), rule_type (legacy).
- brand_power_words: word, category, usage_example, forbidden_usage, context (legacy).
- brand_knowledge_versions (baru): user_id, version, snapshot jsonb, created_at — dibuat setiap simpan, dirujuk oleh `kerjaku_versions.brand_profile_version`.

## 4. Validasi keamanan

- RLS: keempat tabel sudah owner-only FOR ALL dengan USING + WITH CHECK; tidak ada akses anon. Tabel versi baru harus mengikuti pola yang sama (authenticated only, SELECT/INSERT owner).
- Server function pembaca brand wajib memakai klien yang membawa sesi pengguna (bukan admin), sehingga AI mustahil membaca brand milik user lain.
- Data brand tidak pernah dikirim ke pihak ketiga selain payload prompt AI milik pengguna itu sendiri.
- Rekomendasi tambahan: CHECK constraint pada rule_category, severity, dan product status agar nilai tidak bebas.

## 5. Persiapan integrasi ATM (belum dibangun)

- Satu fungsi resmi `getBrandContext` (server, authenticated) yang mengembalikan: profil, produk aktif saja, aturan terkelompok, power words, `version`, dan `readiness`.
- Conservative ATM: input hanya Source Content Report — Brand Knowledge tidak dipakai sebagai sumber fakta.
- Creative ATM: input Brand Knowledge, dan hanya boleh dijalankan bila readiness = Ready.
- Quality Gate berbasis kode (bukan hanya prompt): nama produk yang muncul harus ada di daftar produk aktif; forbidden words dan forbidden claims dicek literal; klaim berangka tanpa dukungan data ditolak keras; power words dicek literal dan diberi skor pemakaian (informasional, tidak memblokir).
- Setiap hasil menyimpan brand version, timestamp, dan user.

## 6. Jawaban pertanyaan kunci

- Field profil saat ini **belum cukup** sebagai konteks AI; perlu tambahan pada bagian audience, communication, dan visual.
- Versioning **perlu**; `brand_profile_version` sekarang hanya label, isi lama tidak tersimpan — perlu tabel snapshot.
- Validasi nama produk **harus lewat kode**, dan Creative ATM **harus gagal** bila menyebut produk yang tidak terdaftar.
- Produk lama **perlu status active/inactive**, bukan dihapus.
- Aturan brand **harus menjadi Quality Gate**: severity hard_fail menggagalkan hasil, warning hanya menandai.
- Power words **dicek literal** dan diberi skor pemakaian.
- Setelah penambahan di atas dijalankan, Brand Knowledge **siap** menjadi sumber fakta untuk Prompt 4. Dalam kondisi sekarang: belum siap.
