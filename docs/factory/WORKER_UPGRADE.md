# Pembaruan worker VPS — belum di-deploy

Gunakan worker dari revisi terbaru proyek ini; tidak perlu membangun ulang aplikasi atau mengubah Cliper.

## Isi pembaruan
- `runner.py`, `media.py`, `production.py`, `design.py`, `word_alignment.py`, `neural_voice.py`, `music_assets.py`.
- `requirements.txt` dan seluruh `assets/bgm/*.asset.json` serta `checksums.json`.
- Dockerfile membawa file tersebut dan FFmpeg/fonts. eSpeak tidak lagi dipasang untuk produksi.

## Pasang dan cek di VPS
```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -c "import edge_tts; print('neural speech dependency ready')"
ffmpeg -version
```
Pertahankan konfigurasi `CRAFT_APP_ORIGIN`, `CRAFT_STORAGE_ORIGIN`, `CRAFT_WORKER_SECRET` milik worker; jangan menyalin rahasia ke kode atau chat. Hapus `CRAFT_TTS_PROVIDER=espeak_test` bila pernah digunakan untuk tes offline.

Uji akses suara dari VPS sebelum mengaktifkan consumer:
```sh
python - <<'PY'
from media import synthesize
result = synthesize('Mulai dari satu proses. Periksa hasilnya bersama KERJAKU.', '/tmp/craft-voice-check', persona='female')
print('Duration:', result['duration'], 'Words:', len(result['words']))
PY
```
Jika koneksi suara ditolak, proses ditahan. Jangan mengaku VO alami berhasil dan jangan menggantinya otomatis dengan eSpeak. edge-tts memakai layanan daring Microsoft; repositori open-source tidak berarti jaminan akses, SLA, atau penggunaan tanpa batas.

Setelah migrasi/gate Cloud dan kredensial worker terverifikasi, restart layanan worker yang **sudah** ada atau jalankan:
```sh
python -u runner.py
```
Musik diunduh melalui `CRAFT_APP_ORIGIN` dan diperiksa checksum sebelum dipakai. Tidak ada musik tren atau hak penggunaan katalog platform yang diasumsikan.

## Batas
Pembaruan ini merakit gerak kamera dari beberapa gambar. Belum menghasilkan gerakan tubuh UGC, lip-sync, atau animasi clay generatif; model/provider AI video harus disambungkan dan diuji secara terpisah. Belum ada publikasi otomatis/izin posting baru.
