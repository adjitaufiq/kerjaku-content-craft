# Kerjaku Scheduler Pro

Role & Goal:
Buat aplikasi web Instagram Content Manager & Scheduler internal untuk brand @kerjaku.space. Aplikasi ini memangkas workflow manual dengan cara mengunggah foto hasil AI, otomatis mencocokkan nomor konten dengan Excel bank data, lalu mengeksekusi Auto-Publish Langsung atau Scheduling Meta via Instagram Graph API.

App Workflow Architecture & Step-by-Step Flow:

1. ARCHITECTURE & DATA FLOW DIAGRAM:
[ User Uploads Excel ] ──> Parse "Bank Konten 1-30" ──> Store in App State / Supabase
                                                              │
[ User Drops Image (e.g. 7.png) ] ─────────────────────────────┤
        │                                                     │
        ▼                                                     ▼
[ Upload to Supabase Storage ]                      [ Auto Match No = 7 ]
  bucket: "instagram-media"                                   │
        │                                                     │
        ▼                                                     ▼
  Get Public Image URL ─────────────────────────> [ Auto Fill Caption #7 ]
                                                              │
                                                              ▼
                                               [ Split-Screen Preview UI ]
                                                              │
                             ┌────────────────────────────────┴────────────────────────────────┐
                             ▼                                                                 ▼
                    [ Mode A: Publish Now ]                                           [ Mode B: Schedule Post ]
                             │                                                                 │
                             ▼                                                                 ▼
                   POST /v19.0/{IG_ID}/media                                         POST /v19.0/{IG_ID}/media
                   (image_url, caption)                                              (image_url, caption, published=false,
                             │                                                        scheduled_publish_time=UNIX_TIMESTAMP)
                             ▼                                                                 │
               POST /v19.0/{IG_ID}/media_publish                                                ▼
                   (creation_id)                                                       Meta Engine Schedules Directly
                             │                                                                 │
                             └────────────────────────────────┬────────────────────────────────┘
                                                              ▼
                                                   [ Update status in content_logs ]

2. UI & SCREEN WORKFLOWS:

Screen 1: Settings & Config
- Inputs for Instagram Business Account ID and Meta Long-Lived Access Token.
- Button to upload Bank_Konten_KERJAKU_1-30_LOCKED.xlsx to parse rows (Columns: No, Judul / Alur Konten, Prompt Generate Foto, Caption).

Screen 2: Content Grid Overview
- Show grid/table of 30 content items parsed from Excel.
- Indicators: Status (Draft, Scheduled, Published), Thumbnail Preview, Title, Content Number.

Screen 3: Split-Screen Editor & Publisher (Meta Scheduler Style)
- Left Side: Feed Preview (4:5 Portrait Aspect Ratio, 1080x1350).
- Right Side:
  * Dropzone for AI Photo upload (Auto detect filename like "7.png" or manual dropdown selector "No. 7").
  * Auto-populated Caption Textarea (Editable, auto-filled from Excel match).
  * Toggle Switch / Radio Option: "Publish Instan" vs "Schedule Post".
  * Date-Time Picker (Active when "Schedule Post" is selected).
  * Action Buttons: "Publish Now" (Executes instant 2-step Meta publish) or "Schedule Content" (Executes scheduled container API).

3. DATABASE & STORAGE SETUP:
- Supabase Storage Bucket: `instagram-media` (Public Access).
- Database Table `content_logs`: id (uuid), content_number (int), title (text), image_url (text), caption (text), status (text), scheduled_at (timestamp), created_at (timestamp).

4. API EDGE FUNCTION SPECS (`instagram-publisher`):
- Mode 1 (Publish Now):
  Step 1: POST https://graph.facebook.com/v19.0/{IG_ACCOUNT_ID}/media (body: image_url, caption, access_token) -> Returns creation_id
  Step 2: POST https://graph.facebook.com/v19.0/{IG_ACCOUNT_ID}/media_publish (body: creation_id, access_token) -> Returns post_id

- Mode 2 (Meta Scheduling):
  Step 1: POST https://graph.facebook.com/v19.0/{IG_ACCOUNT_ID}/media (body: image_url, caption, published=false, scheduled_publish_time=UNIX_TIMESTAMP, access_token) -> Meta handles posting automatically at scheduled time.

Design Theme:
KERJAKU Brand Identity: Dark navy background (#0B1120), Cyan/Turquoise accents (#06B6D4 / #14B8A6), Clean modern enterprise SaaS UI.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kerjaku-content-craft.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bea045f1-08f8-4833-ade0-cab199ca5fdf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
